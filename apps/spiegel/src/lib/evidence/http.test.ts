import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeEvidenceFile } from "./files"
import { contentDisposition, evidenceResponse } from "./http"

const db = createPrismaClient()
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9])
const SHA = createHash("sha256").update(`${randomUUID()}-png`).digest("hex")

let site: TestSite
let previousUploadDir: string | undefined
let dir: string
let evidenceId: string
let cardId: string

beforeAll(async () => {
  site = await createTestSite(db, "evidence-http")
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-evidence-http-"))
  process.env.UPLOAD_DIR = dir
  cardId = (
    await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: false,
        origin: "manual",
      },
    })
  ).id
  await writeEvidenceFile(SHA, "image/png", PNG)
  evidenceId = (
    await db.cardEvidence.create({
      data: { cardId, sha256: SHA, contentType: "image/png", size: PNG.length },
    })
  ).id
})
afterAll(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await site.remove()
  await db.$disconnect()
})

describe("evidenceResponse", () => {
  it("der Besitzer bekommt die Datei mit Typ, ohne Cache, in einer Sandbox", async () => {
    const response = await evidenceResponse(db, evidenceId, site.ownerId)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("content-disposition")).toBe('inline; filename="beleg.png"')
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe("sandbox")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG)
  })

  it("mit Namen trägt der Kopf ihn zusätzlich in UTF-8", async () => {
    const other = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: false,
        origin: "raw",
      },
    })
    const { id } = await db.cardEvidence.create({
      data: {
        cardId: other.id,
        sha256: SHA,
        contentType: "image/png",
        size: PNG.length,
        fileName: "Ergebnisliste Kreisliga.png",
      },
    })
    const response = await evidenceResponse(db, id, site.ownerId)
    expect(response.headers.get("content-disposition")).toBe(
      "inline; filename=\"beleg.png\"; filename*=UTF-8''Ergebnisliste%20Kreisliga.png"
    )
  })

  it("ein PDF ohne Sandbox, damit der Browser es anzeigt", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    const sha = createHash("sha256").update(`${randomUUID()}-pdf`).digest("hex")
    await writeEvidenceFile(sha, "application/pdf", pdf)
    const other = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: false,
        origin: "manual",
      },
    })
    const { id } = await db.cardEvidence.create({
      data: { cardId: other.id, sha256: sha, contentType: "application/pdf", size: pdf.length },
    })
    const response = await evidenceResponse(db, id, site.ownerId)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-security-policy")).toBeNull()
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("auch eine geteilte Scheibe gibt ihren Beleg nur dem Besitzer", async () => {
    const shared = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: false,
        origin: "manual",
        shareId: randomUUID(),
        sharedAt: new Date(),
      },
    })
    const { id } = await db.cardEvidence.create({
      data: { cardId: shared.id, sha256: SHA, contentType: "image/png", size: PNG.length },
    })
    expect((await evidenceResponse(db, id, null)).status).toBe(401)
    expect((await evidenceResponse(db, id, "someone-else")).status).toBe(404)
    expect((await evidenceResponse(db, id, site.ownerId)).status).toBe(200)
  })

  it("ohne Sitzung 401, fremd, unbekannt oder im Papierkorb 404", async () => {
    expect((await evidenceResponse(db, evidenceId, null)).status).toBe(401)
    expect((await evidenceResponse(db, evidenceId, "someone-else")).status).toBe(404)
    expect((await evidenceResponse(db, "../etc/passwd", site.ownerId)).status).toBe(404)
    await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
    expect((await evidenceResponse(db, evidenceId, site.ownerId)).status).toBe(404)
  })
})

describe("contentDisposition", () => {
  it("ohne Namen nur beleg.<Endung>", () => {
    expect(contentDisposition("application/pdf", null)).toBe('inline; filename="beleg.pdf"')
  })

  it("Umlaute, Leerzeichen, Anführungszeichen und '()* kodiert", () => {
    expect(contentDisposition("image/jpeg", "Müller (2) 'a'*\"b\".jpg")).toBe(
      "inline; filename=\"beleg.jpg\"; filename*=UTF-8''M%C3%BCller%20%282%29%20%27a%27%2A%22b%22.jpg"
    )
  })
})
