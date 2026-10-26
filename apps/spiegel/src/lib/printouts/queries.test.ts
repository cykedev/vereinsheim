import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writePrintoutFile } from "./files"
import { attachPrintout, printoutFile } from "./queries"
import type { StoredPrintout } from "./store"

const db = createPrismaClient()

const BYTES = new TextEncoder().encode("%PDF-1.4 erfundener Ausdruck")
// je Lauf andere Prüfsummen: Die Dev-Datenbank teilen sich Läufe, auch liegengebliebene
const RUN = randomUUID()
const stored = (text: string, hex = "ff914420"): StoredPrintout => ({
  sha256: createHash("sha256").update(`${RUN}-${text}`).digest("hex"),
  size: text.length,
  fileName: `ausdruck-${hex}.pdf`,
  hex,
  scheibenId: -7257056,
  printedAt: new Date("2026-10-02T17:52:12Z"),
})

let site: TestSite
let other: TestSite
let previousUploadDir: string | undefined
let dir: string

beforeAll(async () => {
  site = await createTestSite(db, "printout-queries")
  other = await createTestSite(db, "printout-queries-other")
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-queries-"))
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

const pdfCard = (ownerPending = false) =>
  db.card.create({
    data: {
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      ownerPending,
      startedAt: new Date(),
      kind: "training",
      state: "final",
      complete: true,
      origin: "pdf",
    },
  })

describe("attachPrintout", () => {
  it("derselbe Ausdruck zweimal: eine Zeile; zwei Ausdrucke derselben Scheibe (SF-43): zwei", async () => {
    const card = await pdfCard()
    const first = await attachPrintout(db, stored("a"), card.id)
    expect(await attachPrintout(db, stored("a"), card.id)).toBe(first)
    await attachPrintout(db, stored("b"), card.id)
    const rows = await db.printout.findMany({ where: { cardId: card.id } })
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === first)).toMatchObject({
      footerId: "ff914420",
      fileName: "ausdruck-ff914420.pdf",
      size: 1,
      printedAt: new Date("2026-10-02T17:52:12Z"),
    })
  })

  it("in einer Transaktion", async () => {
    const card = await pdfCard()
    const id = await db.$transaction((tx) => attachPrintout(tx, stored("c"), card.id))
    expect(await db.printout.count({ where: { id } })).toBe(1)
  })

  it("Scheibe löschen nimmt ihre Zeilen mit", async () => {
    const card = await pdfCard()
    await attachPrintout(db, stored("d"), card.id)
    await db.card.delete({ where: { id: card.id } })
    expect(await db.printout.count({ where: { cardId: card.id } })).toBe(0)
  })
})

describe("printoutFile", () => {
  it("nur für den Besitzer und nicht, solange die Scheibe wartet", async () => {
    const file = { ...stored("e"), size: BYTES.length }
    await writePrintoutFile(file.sha256, BYTES)
    const card = await pdfCard()
    const id = await attachPrintout(db, file, card.id)
    const own = await printoutFile(db, id, site.ownerId)
    expect(own?.fileName).toBe("ausdruck-ff914420.pdf")
    expect(own && new Uint8Array(own.bytes)).toEqual(BYTES)
    expect(await printoutFile(db, id, other.ownerId)).toBeNull()

    const waiting = await pdfCard(true)
    const waitingId = await attachPrintout(db, file, waiting.id)
    expect(await printoutFile(db, waitingId, site.ownerId)).toBeNull()
  })

  it("Zeile ohne Datei: null", async () => {
    const card = await pdfCard()
    const id = await attachPrintout(db, stored("ohne Datei"), card.id)
    expect(await printoutFile(db, id, site.ownerId)).toBeNull()
  })
})
