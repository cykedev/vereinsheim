import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writePrintoutFile } from "./files"
import { printoutResponse } from "./http"
import { attachPrintout } from "./queries"
import { NO_VALUES, type StoredPrintout } from "./store"

const db = createPrismaClient()
const BYTES = new TextEncoder().encode("%PDF-1.4 erfundener Ausdruck")
const RUN = randomUUID()

let site: TestSite
let other: TestSite
let previousUploadDir: string | undefined
let dir: string

beforeAll(async () => {
  site = await createTestSite(db, "printout-http")
  other = await createTestSite(db, "printout-http-other")
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-http-"))
  process.env.UPLOAD_DIR = dir
})
afterAll(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await site.remove()
  await other.remove()
  await db.$disconnect()
})

/** ein Ausdruck an einer Scheibe vom Ausdruck; `withFile`: die Datei liegt im Upload-Verzeichnis */
async function printout(card: { ownerPending?: boolean; deletedAt?: Date } = {}, withFile = true) {
  const file: StoredPrintout = {
    sha256: createHash("sha256").update(`${RUN}-${randomUUID()}`).digest("hex"),
    size: BYTES.length,
    fileName: "upload.pdf",
    hex: "ff914420",
    scheibenId: -7257056,
    printedAt: new Date("2026-10-02T17:52:12Z"),
    values: NO_VALUES,
  }
  if (withFile) await writePrintoutFile(file.sha256, BYTES)
  const row = await db.card.create({
    data: {
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      startedAt: new Date(),
      kind: "training",
      state: "final",
      complete: true,
      origin: "pdf",
      ...card,
    },
  })
  return attachPrintout(db, file, row.id)
}

describe("printoutResponse", () => {
  it("der Besitzer bekommt das PDF mit den Köpfen", async () => {
    const id = await printout()
    const response = await printoutResponse(db, id, site.ownerId)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="ausdruck-ff914420.pdf"'
    )
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES)
  })

  it("anderes Konto, Papierkorb, wartend, Datei fehlt, fremde Form: 404; ohne Konto 401", async () => {
    const id = await printout()
    expect((await printoutResponse(db, id, other.ownerId)).status).toBe(404)
    expect(
      (await printoutResponse(db, await printout({ deletedAt: new Date() }), site.ownerId)).status
    ).toBe(404)
    expect(
      (await printoutResponse(db, await printout({ ownerPending: true }), site.ownerId)).status
    ).toBe(404)
    expect((await printoutResponse(db, await printout({}, false), site.ownerId)).status).toBe(404)
    expect((await printoutResponse(db, "../etc/passwd", site.ownerId)).status).toBe(404)
    expect((await printoutResponse(db, id, null)).status).toBe(401)
  })
})
