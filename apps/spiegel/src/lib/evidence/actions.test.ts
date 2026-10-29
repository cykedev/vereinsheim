import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { samplePrintout } from "../../../tools/printout-sample"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { generateSeason } from "../../../test/generate"

import { writeRevision } from "../db/cards"
import { writeEnteredCard } from "../db/entered"
import { lockCard } from "../db/purge"
import { evidenceDir } from "./files"
import { EVIDENCE_GONE, EVIDENCE_LIMIT, EVIDENCE_MAX_BYTES } from "./texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  sweeps: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("@/lib/uploads", () => ({
  sweepUploadsSoon: () => {
    mocks.sweeps += 1
  },
}))

const { attachEvidence, removeEvidence } = await import("./actions")

let site: TestSite
let otherId: string
let previousUploadDir: string | undefined
let dir: string
let base = 8600
beforeAll(async () => {
  site = await createTestSite(db, "evidence-actions")
  otherId = (
    await db.user.create({
      data: { email: `evidence-other-${randomUUID()}@example.com`, passwordHash: "-" },
    })
  ).id
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-evidence-actions-"))
  process.env.UPLOAD_DIR = dir
})
afterAll(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: site.ownerId, role: "USER" } }
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
/** ein JPEG mit eigenen Bytes: verschiedene Zahlen ergeben verschiedene Dateien */
const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, n >> 8, n & 0xff, 7])

/** eine eingetragene oder vom Ausdruck */
async function enteredCard(origin: "manual" | "pdf", ownerId = site.ownerId) {
  const saved = await writeEnteredCard(db, {
    ownerId,
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

/** eine Scheibe der Anlage mit Rohdaten und Revision */
async function rawCard({ pending = false } = {}) {
  const [input] = generateSeason({
    seed: base,
    cards: 1,
    firstMs: Date.UTC(2026, 5, 2, 17) + base * 60_000,
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: base,
  })
  base += 1
  return (await writeRevision(db, { ...input, card: { ...input.card, ownerPending: pending } }))
    .cardId
}

const form = (cardId: string, bytes: Uint8Array<ArrayBuffer>, name = "beleg.jpg") => {
  const data = new FormData()
  data.set("cardId", cardId)
  data.set("file", new File([bytes], name))
  return data
}
const rowsOf = (cardId: string) =>
  db.cardEvidence.findMany({
    where: { cardId },
    orderBy: [{ storedAt: "asc" }, { id: "asc" }],
  })
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")

/** `count` Zeilen direkt anlegen, ohne Dateien: für die Grenze */
async function fill(cardId: string, count: number) {
  await db.cardEvidence.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      cardId,
      sha256: sha(new TextEncoder().encode(`${cardId}-${i}`)),
      contentType: "image/jpeg",
      size: 10,
    })),
  })
}

const revisionsOf = async (cardId: string) => ({
  revisions: await db.cardRevision.count({ where: { cardId } }),
  current: (await db.card.findUniqueOrThrow({ where: { id: cardId } })).currentRevisionId,
})

describe("attachEvidence", () => {
  it("an Scheiben jeder Herkunft, mit Namen, Typ an den Bytes", async () => {
    for (const id of [await enteredCard("manual"), await enteredCard("pdf"), await rawCard()]) {
      expect(await attachEvidence(form(id, PNG, "C:\\Fotos\\Liste.pdf"))).toEqual({ success: true })
      expect(await rowsOf(id)).toMatchObject([
        { contentType: "image/png", size: PNG.length, fileName: "Liste.pdf", sha256: sha(PNG) },
      ])
    }
  })

  it("mehrere nacheinander in der Folge des Anhängens", async () => {
    const id = await enteredCard("manual")
    for (const [i, name] of ["a.jpg", "b.jpg", "c.jpg"].entries())
      expect(await attachEvidence(form(id, jpeg(i), name))).toEqual({ success: true })
    expect((await rowsOf(id)).map((row) => row.fileName)).toEqual(["a.jpg", "b.jpg", "c.jpg"])
  })

  it("dieselbe Datei an einer Scheibe nur einmal, an zwei Scheiben zweimal mit einer Datei", async () => {
    const one = await enteredCard("manual")
    const two = await enteredCard("manual")
    const bytes = jpeg(500)
    expect(await attachEvidence(form(one, bytes, "IMG_1.jpg"))).toEqual({ success: true })
    expect(await attachEvidence(form(one, bytes, "IMG_1 Kopie.jpg"))).toEqual({
      error: "„IMG_1 Kopie.jpg“ hängt schon an dieser Scheibe.",
    })
    expect(await rowsOf(one)).toHaveLength(1)
    expect(await attachEvidence(form(two, bytes, "IMG_1.jpg"))).toEqual({ success: true })
    expect(await rowsOf(two)).toHaveLength(1)
    const files = (await readdir(evidenceDir())).filter((file) => file.startsWith(sha(bytes)))
    expect(files).toEqual([`${sha(bytes)}.jpg`])
  })

  it("Grenze: mit 10 keine elfte", async () => {
    const id = await enteredCard("manual")
    await fill(id, EVIDENCE_LIMIT)
    expect(await attachEvidence(form(id, jpeg(600), "elf.jpg"))).toEqual({
      error: "„elf.jpg“ ist nicht angehängt. An einer Scheibe hängen höchstens 10 Belege.",
    })
    expect(await rowsOf(id)).toHaveLength(EVIDENCE_LIMIT)
  })

  it("Grenze: mit 9 zwei zugleich, genau eine hängt an", async () => {
    const id = await rawCard()
    await fill(id, EVIDENCE_LIMIT - 1)
    const results = await Promise.all([
      attachEvidence(form(id, jpeg(700), "x.jpg")),
      attachEvidence(form(id, jpeg(701), "y.jpg")),
    ])
    expect(results.filter((result) => "success" in result)).toHaveLength(1)
    expect(results.filter((result) => "error" in result)).toEqual([
      { error: expect.stringContaining("An einer Scheibe hängen höchstens 10 Belege.") },
    ])
    expect(await db.cardEvidence.count({ where: { cardId: id } })).toBe(EVIDENCE_LIMIT)
  })

  it("Grenze unter der Sperre: Anhängen wartet auf eine Transaktion, die die Scheibe hält", async () => {
    const id = await rawCard()
    await fill(id, EVIDENCE_LIMIT - 1)
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    let locked = () => {}
    const isLocked = new Promise<void>((resolve) => (locked = resolve))
    const holder = db.$transaction(
      async (tx) => {
        await lockCard(tx, id)
        locked()
        await held
        await tx.cardEvidence.create({
          data: { cardId: id, sha256: sha(jpeg(710)), contentType: "image/jpeg", size: 7 },
        })
      },
      { timeout: 20_000 }
    )
    await isLocked
    const attaching = attachEvidence(form(id, jpeg(711), "z.jpg"))
    // ohne Sperre zählte das Anhängen jetzt 9 und legte die zehnte Zeile an
    await new Promise((resolve) => setTimeout(resolve, 500))
    release()
    await holder
    expect(await attaching).toEqual({
      error: "„z.jpg“ ist nicht angehängt. An einer Scheibe hängen höchstens 10 Belege.",
    })
    expect(await db.cardEvidence.count({ where: { cardId: id } })).toBe(EVIDENCE_LIMIT)
  })

  it("abgewiesen: fremd, wartend, im Papierkorb", async () => {
    const foreign = await enteredCard("manual", otherId)
    const pending = await rawCard({ pending: true })
    const trashed = await enteredCard("manual")
    await db.card.update({ where: { id: trashed }, data: { deletedAt: new Date() } })
    for (const id of [foreign, pending, trashed]) {
      expect(await attachEvidence(form(id, PNG))).toEqual({ error: EVIDENCE_GONE })
      expect(await rowsOf(id)).toEqual([])
    }
  })

  it("abgewiesen: zu groß, unbekannter Typ", async () => {
    const id = await enteredCard("manual")
    expect(
      await attachEvidence(form(id, new Uint8Array(EVIDENCE_MAX_BYTES + 1).fill(0xff), "gross.jpg"))
    ).toEqual({ error: "„gross.jpg“ ist zu groß, auch verkleinert." })
    expect(await attachEvidence(form(id, new TextEncoder().encode("<svg/>"), "x.jpg"))).toEqual({
      error: "Spiegel kann „x.jpg“ nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF.",
    })
    expect(await rowsOf(id)).toEqual([])
  })

  it("ein Meyton-Ausdruck wird kein Beleg, ein anderes PDF schon", async () => {
    const id = await rawCard()
    const printout = await samplePrintout({ hex: "7fff0b01", printed: "2026-10-20T19:30:00+02:00" })
    expect(await attachEvidence(form(id, new Uint8Array(printout), "print_7f.pdf"))).toEqual({
      error:
        "„print_7f.pdf“ ist ein Ausdruck von Meyton und kein Beleg. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann liest Spiegel seine Werte.",
    })
    expect(await rowsOf(id)).toEqual([])
    const other = new TextEncoder().encode("%PDF-1.4\n%%EOF\n")
    expect(await attachEvidence(form(id, other, "scan.pdf"))).toEqual({ success: true })
    expect(await rowsOf(id)).toMatchObject([
      { contentType: "application/pdf", fileName: "scan.pdf" },
    ])
  })

  it("schreibt keine Revision, auch nicht an einer Scheibe der Anlage", async () => {
    for (const id of [await enteredCard("manual"), await rawCard()]) {
      const before = await revisionsOf(id)
      expect(before.current).not.toBeNull()
      expect(await attachEvidence(form(id, PNG))).toEqual({ success: true })
      const [row] = await rowsOf(id)
      expect(await removeEvidence(row!.id)).toEqual({ success: true })
      expect(await revisionsOf(id)).toEqual(before)
    }
  })
})

describe("removeEvidence", () => {
  it("entfernt nur den gewählten Beleg, die anderen bleiben", async () => {
    const id = await enteredCard("manual")
    for (const [i, name] of ["a.jpg", "b.jpg", "c.jpg"].entries())
      await attachEvidence(form(id, jpeg(800 + i), name))
    const [, middle] = await rowsOf(id)
    const sweeps = mocks.sweeps
    expect(await removeEvidence(middle!.id)).toEqual({ success: true })
    expect(mocks.sweeps).toBe(sweeps + 1)
    expect((await rowsOf(id)).map((row) => row.fileName)).toEqual(["a.jpg", "c.jpg"])
  })

  it("fremd und im Papierkorb: die Scheibe gibt es nicht mehr", async () => {
    const id = await enteredCard("manual")
    await attachEvidence(form(id, jpeg(900)))
    const [row] = await rowsOf(id)
    mocks.session = { user: { id: otherId, role: "USER" } }
    expect(await removeEvidence(row!.id)).toEqual({ error: EVIDENCE_GONE })
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    await db.card.update({ where: { id }, data: { deletedAt: new Date() } })
    expect(await removeEvidence(row!.id)).toEqual({ error: EVIDENCE_GONE })
    expect(await rowsOf(id)).toHaveLength(1)
  })

  it("eine ungültige Kennung fragt die Datenbank gar nicht erst", async () => {
    const spy = vi.spyOn(db.cardEvidence, "deleteMany")
    expect(await removeEvidence("../etc")).toEqual({ error: EVIDENCE_GONE })
    expect(await removeEvidence("")).toEqual({ error: EVIDENCE_GONE })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
