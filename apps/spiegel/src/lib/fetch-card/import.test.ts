import { createHash, randomUUID } from "node:crypto"

import { printoutReading } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { generateSeason } from "../../../test/generate"
import { valuedSpec, type ValuedPrintoutSpec } from "../../../test/printout"
import { writeRevision } from "../db/cards"
import { valuesReadOf, type StoredPrintout } from "../printouts/store"
import { writeTransferCard } from "../transfer/write"
import { importPrintout, importPrintoutIn } from "./import"

// Gegen die Dev-Datenbank, eigene Anlage mit eingeordneter Disziplin „LP 40“; je Fall eine eigene ScheibenID.

const db = createPrismaClient()
const RUN = randomUUID()
let site: TestSite
let nextId = 95_000

beforeAll(async () => {
  site = await createTestSite(db, "printout-import")
  await db.discipline.update({
    where: { id: site.disciplineId },
    data: { confirmedAt: new Date() },
  })
})

afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

/** 2. Oktober 2026, 19:52 Uhr in Berlin, wie die Vorgabe von `valuedSpec` */
const PRINTED = new Date("2026-10-02T17:52:12Z")

async function stored(scheibenId: number, spec: ValuedPrintoutSpec = {}): Promise<StoredPrintout> {
  const printout = valuedSpec(spec)
  const values = await readPrintoutValues(await printoutPdf(printout))
  return {
    sha256: createHash("sha256")
      .update(`${RUN}-${scheibenId}-${JSON.stringify(spec)}`)
      .digest("hex"),
    size: 1,
    fileName: "ausdruck.pdf",
    hex: (scheibenId >>> 0).toString(16).padStart(8, "0"),
    scheibenId,
    printedAt: PRINTED,
    values: valuesReadOf(printoutReading(values, { producer: "Qt 5.12.8" })),
  }
}

const run = (file: StoredPrintout, dryRun = false) =>
  importPrintout(db, { userId: site.ownerId, siteId: site.siteId, file, dryRun })
const cardsOf = (scheibenId: number) =>
  db.card.findMany({
    where: {
      ownerId: site.ownerId,
      printouts: { some: { footerId: (scheibenId >>> 0).toString(16).padStart(8, "0") } },
    },
    include: { printouts: true },
  })

describe("importPrintout", () => {
  it("neu: Scheibe vom Ausdruck mit Werten, Training, ohne Auftrag; zweimal ändert nichts", async () => {
    const id = nextId++
    const file = await stored(id)
    const first = await run(file)
    if (first.kind !== "created") throw new Error(first.kind)
    expect(first.values).toBe(true)
    const card = await db.card.findUniqueOrThrow({
      where: { id: first.cardId },
      include: { printouts: true, requests: true },
    })
    expect(card).toMatchObject({
      origin: "pdf",
      sourceId: null,
      kind: "training",
      kindChoice: "training",
      place: null,
      startedAt: PRINTED,
      disciplineId: site.disciplineId,
    })
    expect(card.requests).toEqual([])
    const revisions = await db.cardRevision.count({ where: { cardId: first.cardId } })
    expect(await run(file)).toEqual({ kind: "attached", cardId: first.cardId, values: true })
    expect(await db.cardRevision.count({ where: { cardId: first.cardId } })).toBe(revisions)
    expect(await cardsOf(id)).toHaveLength(1)
    expect((await cardsOf(id))[0].printouts).toHaveLength(1)
  })

  it("die eigene Scheibe der Brücke am Abend bekommt nur das PDF", async () => {
    const id = nextId++
    const [season] = generateSeason({
      seed: id,
      cards: 1,
      firstMs: Date.UTC(2026, 9, 2, 17, 0),
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: id,
    })
    const { cardId } = await writeRevision(db, season)
    const revisions = await db.cardRevision.count({ where: { cardId } })
    expect(await run(await stored(id))).toEqual({ kind: "attached", cardId, values: true })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { printouts: true },
    })
    expect(card.origin).toBe("raw")
    expect(card.printouts).toHaveLength(1)
    expect(await db.cardRevision.count({ where: { cardId } })).toBe(revisions)
  })

  it("Kopf ohne passende Disziplin: übersprungen, nichts geschrieben", async () => {
    const id = nextId++
    expect(await run(await stored(id, { discipline: "LP 40 alt" }))).toEqual({
      kind: "noDiscipline",
    })
    expect(await cardsOf(id)).toEqual([])
  })

  it("Probelauf: dasselbe Ergebnis, nichts geschrieben", async () => {
    const id = nextId++
    const result = await run(await stored(id), true)
    expect(result).toMatchObject({ kind: "created", values: true })
    expect(await cardsOf(id)).toEqual([])
    expect(await db.card.count({ where: { id: (result as { cardId: string }).cardId } })).toBe(0)
  })

  it("eine Löschsperre am Abend: gesperrt", async () => {
    const id = nextId++
    await db.deleteLock.create({
      data: {
        userId: site.ownerId,
        sourceId: site.sourceId,
        scheibenId: id,
        cycle: 0,
        startedAt: new Date("2026-10-02T17:00:00Z"),
      },
    })
    expect(await run(await stored(id))).toEqual({ kind: "blocked" })
  })
})

describe("importPrintout und Scheiben aus Treffsicher", () => {
  let nextEvening = 0
  /** ein eigener Abend im Juli 2026 mit einem stimmigen Ausdruck um 19:52 Uhr in Berlin */
  async function evening(id: number) {
    const n = nextEvening++
    const at = (hour: number, minute = 0) => Date.UTC(2026, 6, 1 + 2 * n, hour, minute)
    const file = { ...(await stored(id)), printedAt: new Date(at(17, 52)) }
    return { file, at }
  }
  /** eine Scheibe aus Treffsicher mit dem Ergebnis des Ausdrucks in ganzen Ringen */
  async function transferCard(startedAtMs: number, file: StoredPrintout) {
    const saved = await db.$transaction((tx) =>
      writeTransferCard(tx, {
        ownerId: site.ownerId,
        disciplineId: site.disciplineId,
        startedAtMs,
        kind: "training",
        place: null,
        importKey: `treffsicher:import-${RUN}-${nextId++}`,
        details: { total: { shots: 40, rings: file.values.reading!.total!.rings } },
      })
    )
    if (saved.kind !== "saved") throw new Error(saved.kind)
    return saved.cardId
  }
  const stateOf = (cardId: string) =>
    db.card.findUniqueOrThrow({
      where: { id: cardId },
      select: {
        origin: true,
        _count: { select: { printouts: true, revisions: true, requests: true } },
      },
    })
  const UNTOUCHED = {
    origin: "treffsicher",
    _count: { printouts: 0, revisions: 1, requests: 0 },
  }

  it("genau eine passt: der Ausdruck ergänzt sie ohne Auftrag; noch einmal hängt er nur an", async () => {
    const id = nextId++
    const { file, at } = await evening(id)
    const cardId = await transferCard(at(17), file)
    expect(await run(file)).toEqual({ kind: "matched", cardId, values: true })
    expect(await stateOf(cardId)).toEqual({
      origin: "pdf",
      _count: { printouts: 1, revisions: 2, requests: 0 },
    })
    expect((await cardsOf(id)).map((card) => card.id)).toEqual([cardId])
    expect(await run(file)).toMatchObject({ kind: "attached", cardId })
    expect((await stateOf(cardId))._count).toEqual({ printouts: 1, revisions: 2, requests: 0 })
  })

  it("Probelauf: matched, nichts geschrieben", async () => {
    const id = nextId++
    const { file, at } = await evening(id)
    const cardId = await transferCard(at(17), file)
    expect(await run(file, true)).toEqual({ kind: "matched", cardId, values: true })
    expect(await stateOf(cardId)).toEqual(UNTOUCHED)
  })

  it("mehrere passen: eine neue Scheibe, der Fall gezählt, die übrigen bleiben, wie sie sind", async () => {
    const id = nextId++
    const { file, at } = await evening(id)
    const first = await transferCard(at(17), file)
    const second = await transferCard(at(18, 30), file)
    const result = await run(file)
    expect(result).toMatchObject({ kind: "created", values: true, several: true })
    expect([first, second]).not.toContain((result as { cardId: string }).cardId)
    expect(await stateOf(first)).toEqual(UNTOUCHED)
    expect(await stateOf(second)).toEqual(UNTOUCHED)
  })

  it("ohne Suche (matchTransferred: false): eine neue Scheibe, die aus Treffsicher bleibt", async () => {
    const id = nextId++
    const { file, at } = await evening(id)
    const cardId = await transferCard(at(17), file)
    const result = await db.$transaction((tx) =>
      importPrintoutIn(tx, {
        userId: site.ownerId,
        siteId: site.siteId,
        file,
        matchTransferred: false,
      })
    )
    expect(result).toMatchObject({ kind: "created", values: true, several: false })
    expect(await stateOf(cardId)).toEqual(UNTOUCHED)
  })
})
