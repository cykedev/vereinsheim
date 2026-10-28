import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { samplePrintout } from "../../../tools/printout-sample"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeEnteredCard } from "../db/entered"
import { evidenceDir } from "../evidence/files"
import { EVIDENCE_MAX_BYTES, EVIDENCE_TEXTS } from "../evidence/texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))

const { attachEvidence, removeEvidence } = await import("./evidence-actions")

let site: TestSite
let previousUploadDir: string | undefined
let dir: string
beforeAll(async () => {
  site = await createTestSite(db, "evidence-actions")
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-evidence-actions-"))
  process.env.UPLOAD_DIR = dir
})
afterAll(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await site.remove()
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: site.ownerId, role: "USER" } }
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6])
const card = async (origin: "manual" | "pdf") => {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin,
    disciplineId: site.disciplineId,
    startedAtMs: Date.UTC(2026, 9, 20, 17),
    kind: "training",
    details: origin === "manual" ? { total: { rings: 380, shots: 40 } } : {},
    reason: "Test",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}
const form = (cardId: string, bytes: Uint8Array<ArrayBuffer>, name = "beleg.jpg") => {
  const data = new FormData()
  data.set("cardId", cardId)
  data.set("file", new File([bytes], name))
  return data
}
const evidenceOf = (cardId: string) => db.cardEvidence.findUnique({ where: { cardId } })

describe("attachEvidence", () => {
  it("ein Foto, nach dem Typ der Bytes; ein zweites ersetzt es", async () => {
    const id = await card("manual")
    expect(await attachEvidence(form(id, PNG, "beleg.pdf"))).toEqual({ success: true })
    expect(await evidenceOf(id)).toMatchObject({ contentType: "image/png", size: PNG.length })
    expect(await attachEvidence(form(id, JPEG))).toEqual({ success: true })
    expect(await evidenceOf(id)).toMatchObject({ contentType: "image/jpeg", size: JPEG.length })
    // die alte Datei bleibt, bis das Aufräumen sie holt
    expect((await readdir(evidenceDir())).sort()).toHaveLength(2)
  })

  it("abgewiesen: unbekannter Typ, zu groß, Scheibe vom Ausdruck, fremd", async () => {
    const id = await card("manual")
    expect(await attachEvidence(form(id, new TextEncoder().encode("<svg/>"), "x.jpg"))).toEqual({
      error: EVIDENCE_TEXTS.unreadable,
    })
    expect(
      await attachEvidence(form(id, new Uint8Array(EVIDENCE_MAX_BYTES + 1).fill(0xff)))
    ).toEqual({ error: EVIDENCE_TEXTS.tooLarge })
    expect(await attachEvidence(form(await card("pdf"), PNG))).toEqual({
      error: "Diese Scheibe gibt es nicht mehr.",
    })
    mocks.session = { user: { id: "someone-else", role: "USER" } }
    expect(await attachEvidence(form(id, PNG))).toEqual({
      error: "Diese Scheibe gibt es nicht mehr.",
    })
    expect(await evidenceOf(id)).toBeNull()
  })

  it("ein Meyton-Ausdruck wird kein Beleg; ein anderes PDF schon", async () => {
    const id = await card("manual")
    const printout = await samplePrintout({ hex: "7fff0b01", printed: "2026-10-20T19:30:00+02:00" })
    expect(await attachEvidence(form(id, new Uint8Array(printout), "ausdruck.pdf"))).toEqual({
      error: EVIDENCE_TEXTS.printout,
    })
    expect(await evidenceOf(id)).toBeNull()
    const other = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    expect(await attachEvidence(form(id, other, "scan.pdf"))).toEqual({ success: true })
    expect(await evidenceOf(id)).toMatchObject({ contentType: "application/pdf" })
  })
})

describe("removeEvidence", () => {
  it("nur der eigene; danach ohne Beleg", async () => {
    const id = await card("manual")
    await attachEvidence(form(id, PNG))
    mocks.session = { user: { id: "someone-else", role: "USER" } }
    expect(await removeEvidence(id)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await removeEvidence(id)).toEqual({ success: true })
    expect(await evidenceOf(id)).toBeNull()
    expect(await removeEvidence(id)).toEqual({ error: "Diese Scheibe gibt es nicht mehr." })
  })
})
