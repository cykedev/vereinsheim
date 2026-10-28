import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LG_10M } from "@vereinsheim/shot-core/targets"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import type { DetailsInput, EnteredShot } from "../entered/details"

import { refreshDisciplineCards, refreshProjections, writeRevision } from "./cards"
import { writeEnteredCard, type EnteredCardInput } from "./entered"

const db = createPrismaClient()
let site: TestSite
let disciplineId: number
const DAY = 86_400_000
const START = Date.UTC(2026, 4, 1, 17)

beforeAll(async () => {
  site = await createTestSite(db, "entered")
  // eine Disziplin vom Admin ohne Meyton: 40 Schuss in Serien zu zehn
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LG 40 eingetragen",
        familyId: site.familyId,
        targetId: "lg-10m",
        plannedShots: 40,
        seriesShots: 10,
        confirmedAt: new Date(),
      },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

let day = 0
const input = (details: DetailsInput, extra: Partial<EnteredCardInput> = {}): EnteredCardInput => ({
  ownerId: site.ownerId,
  origin: "manual",
  disciplineId,
  startedAtMs: START + day++ * DAY,
  kind: "training",
  details,
  reason: "eingetragen",
  ...extra,
})

/** eine Scheibe schreiben, die gespeichert werden muss; ihre Kennung */
async function saved(details: DetailsInput, extra: Partial<EnteredCardInput> = {}) {
  const result = await writeEnteredCard(db, input(details, extra))
  if (result.kind !== "saved") throw new Error(`nicht gespeichert: ${result.kind}`)
  return result
}

const cardOf = (id: string) =>
  db.card.findUniqueOrThrow({
    where: { id },
    include: {
      projection: true,
      currentRevision: {
        include: { shots: { orderBy: { seq: "asc" } }, seriesSums: { orderBy: { series: "asc" } } },
      },
    },
  })
type Values = Record<string, { value: number; n: number } | undefined>
const valuesOf = async (id: string) => (await cardOf(id)).projection?.values as Values
type Detail = { rings: string | null; tenths: string | null; positions: number; times: number }
const detailOf = async (id: string) => (await cardOf(id)).projection?.detail as Detail

/** zehn Wertungsschüsse in Serie 1: 94 Ringe, 5 Zehner */
const RINGS = [10, 9, 10, 8, 9, 10, 10, 9, 9, 10]
const ringShots = (series = 1): EnteredShot[] =>
  RINGS.map((ring) => ({ series, ring, decimalTenths: null }))

const ids: Record<string, string> = {}

describe("Scheiben in jeder Detailtiefe", () => {
  it("1. nur der Ausdruck: ohne Werte, weder leer noch nur Probe", async () => {
    const { cardId } = await saved({}, { origin: "pdf" })
    ids.empty = cardId
    const card = await cardOf(cardId)
    expect(card.currentRevision?.shots).toEqual([])
    expect(card.currentRevision?.seriesSums).toEqual([])
    expect(card.currentRevision?.totalShots).toBeNull()
    expect(card.projection).toMatchObject({ probeOnly: false, printedShots: 0, values: {} })
    expect((card.projection?.detail as Detail).rings).toBeNull()
    expect(card.flags).not.toContain("leer")
    expect(card.flags).not.toContain("nur-probe")
    expect(card).toMatchObject({
      complete: false,
      standScoring: null,
      origin: "pdf",
      sourceId: null,
    })
  })

  it("2. nur das Gesamtergebnis in ganzen Ringen: Schusszahl der Disziplin gespeichert", async () => {
    const { cardId } = await saved({ total: { rings: 371 } })
    ids.total = cardId
    const card = await cardOf(cardId)
    expect(card.currentRevision).toMatchObject({
      totalRings: 371,
      totalShots: 40,
      totalDecimalTenths: null,
    })
    const values = card.projection?.values as Values
    expect(values["result.rings"]).toEqual({ value: 371, n: 40 })
    expect(values["result.decimal"]).toBeUndefined()
    expect(card).toMatchObject({ complete: true, standScoring: "rings", origin: "manual" })
  })

  it("3. das Gesamtergebnis in Zehnteln", async () => {
    const { cardId } = await saved({ total: { decimalTenths: 3804 } })
    const values = await valuesOf(cardId)
    expect(values["result.decimal"]).toEqual({ value: 380.4, n: 40 })
    expect(values["result.rings"]).toBeUndefined()
  })

  it("4. Serien-Summen in ganzen Ringen, ohne Schusszahl: je eine volle Serie", async () => {
    const { cardId } = await saved({
      series: [93, 95, 94, 96].map((rings, i) => ({ series: i + 1, rings })),
    })
    const card = await cardOf(cardId)
    expect(card.currentRevision?.seriesSums.map((s) => s.shots)).toEqual([10, 10, 10, 10])
    expect((card.projection?.values as Values)["result.rings"]).toEqual({ value: 378, n: 40 })
    const records = card.projection?.records as { rings: { bestSeries: unknown } }
    expect(records.rings.bestSeries).toEqual({ length: 10, value: 96, series: 4 })
  })

  it("5. Serien mit Ringen und Zehnteln: beide Werte", async () => {
    const { cardId } = await saved({
      series: [
        { series: 1, rings: 93, decimalTenths: 978 },
        { series: 2, rings: 95, decimalTenths: 991 },
        { series: 3, rings: 94, decimalTenths: 984 },
        { series: 4, rings: 96, decimalTenths: 1002 },
      ],
    })
    const values = await valuesOf(cardId)
    expect(values["result.rings"]?.value).toBe(378)
    expect(values["result.decimal"]?.value).toBe(395.5)
  })

  it("6. Schüsse in ganzen Ringen: Innenzehner unbekannt, Zehner da", async () => {
    const { cardId } = await saved({ shots: ringShots() })
    const card = await cardOf(cardId)
    expect(card.currentRevision?.shots.map((s) => s.innerTen)).toEqual(RINGS.map(() => null))
    const values = card.projection?.values as Values
    expect(values["result.innerTens"]).toBeUndefined()
    expect(values["result.tens"]).not.toBeUndefined()
    expect(values["result.tens"]?.value).toBe(5)
    expect(values["result.rings"]?.value).toBe(94)
  })

  it("7. Schüsse mit Zehnteln", async () => {
    const tenths = [104, 98, 101, 87, 95, 100, 106, 93, 96, 103]
    const { cardId } = await saved({
      shots: tenths.map((decimalTenths) => ({ series: 1, ring: null, decimalTenths })),
    })
    const card = await cardOf(cardId)
    expect((card.projection?.values as Values)["result.decimal"]?.value).toBe(98.3)
    expect(card.standScoring).toBe("decimal")
    expect(card.currentRevision?.shots.map((s) => s.ring)).toEqual([
      10, 9, 10, 8, 9, 10, 10, 9, 9, 10,
    ])
  })

  it("8. Gesamtergebnis und Trefferlage: Abstand der Lage, keine Streuung", async () => {
    const { cardId } = await saved({ total: { rings: 380 }, center: { xUm: 1200, yUm: -500 } })
    const values = await valuesOf(cardId)
    expect(values["group.mpiDistance"]).toEqual({ value: 1.3, n: 40 })
    expect(values["group.sigma"]).toBeUndefined()
  })

  it("9. Schüsse mit Lage und Zeit", async () => {
    const shots: EnteredShot[] = RINGS.map((_, i) => {
      const xUm = 400 * (i - 5)
      const yUm = 300 * ((i % 3) - 1)
      return {
        series: 1,
        ring: scoreFromCoordinates(LG_10M, xUm, yUm).ring,
        decimalTenths: null,
        xUm,
        yUm,
        firedAtMs: START + i * 40_000,
      }
    })
    const { cardId } = await saved({ shots })
    const card = await cardOf(cardId)
    expect(card.currentRevision?.shots.every((s) => !s.flags.includes("verdaechtig"))).toBe(true)
    expect(await detailOf(cardId)).toMatchObject({ positions: 10, times: 10 })
  })

  it("10. unvollständig: drei Serien bei 40 Schuss", async () => {
    const { cardId } = await saved({
      series: [93, 95, 94].map((rings, i) => ({ series: i + 1, rings })),
    })
    const card = await cardOf(cardId)
    expect(card.flags).toContain("unvollstaendig")
    expect(card.complete).toBe(false)
    expect((card.projection?.values as Values)["result.ringsMean"]).toEqual({ value: 9.4, n: 30 })
  })
})

describe("Ändern", () => {
  it("neue Serien: neue Revision, die alte behält ihre Summen; dieselben noch einmal: unverändert", async () => {
    const first = await saved({ series: [{ series: 1, rings: 90 }] })
    const series = [{ series: 1, rings: 91 }]
    const revised = await writeEnteredCard(db, input({ series }, { cardId: first.cardId }))
    expect(revised).toMatchObject({ kind: "saved", change: "revised", number: 2 })
    const old = await db.seriesSum.findMany({ where: { revisionId: first.revisionId } })
    expect(old.map((s) => s.rings)).toEqual([90])
    const card = await cardOf(first.cardId)
    expect(card.projection?.revisionId).toBe(card.currentRevisionId)
    expect((card.projection?.values as Values)["result.rings"]?.value).toBe(91)
    const again = await writeEnteredCard(db, input({ series }, { cardId: first.cardId }))
    expect(again).toMatchObject({ kind: "saved", change: "unchanged", number: 2 })
  })

  it("ohne Uhrzeit: gesetzt beim Anlegen, beim Ändern ohne Angabe unberührt, mit Angabe neu", async () => {
    const first = await saved({ total: { rings: 380 } }, { timeUnknown: true })
    const timeUnknownOf = async () =>
      (await db.card.findUniqueOrThrow({ where: { id: first.cardId } })).timeUnknown
    expect(await timeUnknownOf()).toBe(true)
    await writeEnteredCard(db, input({ total: { rings: 381 } }, { cardId: first.cardId }))
    expect(await timeUnknownOf()).toBe(true)
    await writeEnteredCard(
      db,
      input({ total: { rings: 381 } }, { cardId: first.cardId, timeUnknown: false })
    )
    expect(await timeUnknownOf()).toBe(false)
    const known = await saved({ total: { rings: 380 } })
    expect((await db.card.findUniqueOrThrow({ where: { id: known.cardId } })).timeUnknown).toBe(
      false
    )
  })

  it("vom Ausdruck nicht von Hand, die Brücke nie, eine fremde gar nicht", async () => {
    expect(
      await writeEnteredCard(db, input({ total: { rings: 370 } }, { cardId: ids.empty }))
    ).toEqual({ kind: "notEditable" })
    const [generated] = generateSeason({
      seed: 11,
      cards: 1,
      firstMs: START,
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: 3000,
    })
    const { cardId: raw } = await writeRevision(db, generated)
    expect(await writeEnteredCard(db, input({ total: { rings: 370 } }, { cardId: raw }))).toEqual({
      kind: "notEditable",
    })
    const other = await db.user.create({
      data: { email: `entered-${raw}@example.com`, passwordHash: "-" },
    })
    try {
      expect(
        await writeEnteredCard(
          db,
          input({ total: { rings: 370 } }, { cardId: ids.total, ownerId: other.id })
        )
      ).toEqual({ kind: "missing" })
    } finally {
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("aus Treffsicher von Hand geändert: eingetragen, der Schlüssel bleibt", async () => {
    const importKey = `treffsicher:aendern-${site.siteId}`
    const { cardId } = await saved({ total: { rings: 360 } }, { origin: "treffsicher", importKey })
    const changed = await writeEnteredCard(db, input({ total: { rings: 361 } }, { cardId }))
    expect(changed).toMatchObject({ kind: "saved", change: "revised" })
    expect(await cardOf(cardId)).toMatchObject({ origin: "manual", importKey })
    // eine wiederholte Übernahme überschreibt die von Hand geänderte nicht
    expect(
      await writeEnteredCard(
        db,
        input({ total: { rings: 360 } }, { origin: "treffsicher", importKey })
      )
    ).toEqual({ kind: "notEditable" })
  })
})

describe("Übernahme und ungültige Angaben", () => {
  it("derselbe Schlüssel zweimal: dieselbe Scheibe, unverändert; ein anderer Besitzer: vergeben", async () => {
    const importKey = `treffsicher:zweimal-${site.siteId}`
    const details = { total: { rings: 355 } }
    const first = await saved(details, { origin: "treffsicher", importKey })
    const second = await writeEnteredCard(db, input(details, { origin: "treffsicher", importKey }))
    expect(second).toMatchObject({ kind: "saved", change: "unchanged", cardId: first.cardId })
    const other = await db.user.create({
      data: { email: `entered-key-${first.cardId}@example.com`, passwordHash: "-" },
    })
    try {
      expect(
        await writeEnteredCard(
          db,
          input(details, { origin: "treffsicher", importKey, ownerId: other.id })
        )
      ).toEqual({ kind: "keyTaken" })
    } finally {
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("Gesamtergebnis und Serien widersprechen sich: nichts geschrieben", async () => {
    const before = await db.card.count({ where: { disciplineId } })
    const result = await writeEnteredCard(
      db,
      input({
        total: { rings: 371 },
        series: [92, 92, 93, 93].map((rings, i) => ({ series: i + 1, rings })),
      })
    )
    expect(result).toEqual({ kind: "invalid", problem: "totalMismatch" })
    expect(await db.card.count({ where: { disciplineId } })).toBe(before)
    expect(
      await writeEnteredCard(db, input({ total: { rings: 371 } }, { startedAtMs: Number.NaN }))
    ).toEqual({ kind: "invalid", problem: "startedAt" })
    expect(await db.card.count({ where: { disciplineId } })).toBe(before)
  })
})

describe("Rohdaten an einer Scheibe vom Ausdruck", () => {
  const season = (scheibenIdBase: number) =>
    generateSeason({
      seed: 20261027,
      cards: 3,
      firstMs: START,
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase,
    }).find((card) => card.shots.some((shot) => shot.stellung !== 0))!

  it("eine leere vom Ausdruck bekommt ihre Rohdaten als neue Revision, ohne „korrigiert“", async () => {
    const pdf = await saved({}, { origin: "pdf", place: "Schützenhaus Nord" })
    expect((await cardOf(pdf.cardId)).place).toBe("Schützenhaus Nord")
    const generated = season(3100)
    const raw = await writeRevision(db, { ...generated, cardId: pdf.cardId })
    expect(raw).toMatchObject({ number: 2, change: "created" })
    const card = await cardOf(pdf.cardId)
    expect(card).toMatchObject({ origin: "raw", place: null, sourceId: site.sourceId })
    expect(card.flags).not.toContain("korrigiert")
    expect(await db.shot.count({ where: { revisionId: pdf.revisionId } })).toBe(0)
  })

  it("Angaben einer Scheibe ohne Brücke schreibt writeRevision nicht", async () => {
    const pdf = await saved({}, { origin: "pdf" })
    const generated = season(3300)
    await expect(
      writeRevision(db, {
        ...generated,
        cardId: pdf.cardId,
        card: { ...generated.card, sourceId: null, scheibenId: null, origin: "pdf" },
      })
    ).rejects.toThrow(RangeError)
  })

  it("eine eingetragene bekommt keine Rohdaten", async () => {
    const manual = await saved({ total: { rings: 370 } })
    await expect(writeRevision(db, { ...season(3200), cardId: manual.cardId })).rejects.toThrow(
      RangeError
    )
  })
})

describe("Nachrechnen", () => {
  it("eine neue Schusszahl der Disziplin: über Soll für 40 Schuss, die leere bleibt ohne „leer“", async () => {
    await db.discipline.update({
      where: { id: disciplineId },
      data: { plannedShots: 30, version: { increment: 1 } },
    })
    await refreshDisciplineCards(db, { cardIds: [ids.total, ids.empty] })
    const total = await cardOf(ids.total)
    expect(total.flags).toContain("ueber-soll")
    expect((await cardOf(ids.empty)).flags).not.toContain("leer")
  })

  it("nach dem Nachrechnen bleiben gleiche Angaben unverändert (die Prüfsumme hält die Angaben)", async () => {
    const own = await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LG 10 Prüfsumme",
        familyId: site.familyId,
        targetId: "lg-10m",
        plannedShots: 10,
        confirmedAt: new Date(),
      },
    })
    // neun Schüsse passen zu ihrer Lage, einer nicht: verdächtig, solange das Scheibenbild gilt
    const shots: EnteredShot[] = RINGS.map((_, i) => {
      const xUm = i === 9 ? 3000 : 300 * i
      const fitting = scoreFromCoordinates(LG_10M, xUm, 0).decimalTenths
      return { series: 1, ring: null, decimalTenths: i === 9 ? 109 : fitting, xUm, yUm: 0 }
    })
    const details = { shots, series: undefined }
    const first = await saved(details, { disciplineId: own.id })
    const flagged = await db.shot.findMany({ where: { revisionId: first.revisionId } })
    expect(flagged.filter((shot) => shot.flags.includes("verdaechtig"))).toHaveLength(1)
    await db.discipline.update({
      where: { id: own.id },
      data: { targetId: null, version: { increment: 1 } },
    })
    await refreshDisciplineCards(db, { cardIds: [first.cardId] })
    const again = await writeEnteredCard(
      db,
      input(details, { disciplineId: own.id, cardId: first.cardId })
    )
    expect(again).toMatchObject({ kind: "saved", change: "unchanged", number: 1 })
  })

  it("eine veraltete Projektion rechnet aus den gespeicherten Angaben gleich", async () => {
    const before = await valuesOf(ids.total)
    await db.cardProjection.update({ where: { cardId: ids.total }, data: { version: "alt" } })
    expect(await refreshProjections(db, { cardIds: [ids.total] })).toBe(1)
    expect(await valuesOf(ids.total)).toEqual(before)
  })
})
