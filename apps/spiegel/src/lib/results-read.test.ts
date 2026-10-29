import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { projectedValues } from "@vereinsheim/shot-core/projection"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeEnteredCard, type EnteredCardInput } from "./db/entered"
import type { DetailsInput } from "./entered/details"
import { overviewCards } from "./overview"
import { listable, withFamily } from "./pages"
import {
  resultCards,
  resultCardSeries,
  resultFamilies,
  resultFormCards,
  resultGoalCards,
  resultGoalDefaults,
} from "./results-read"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
let site: TestSite
let disciplineId: number
let otherId: string

beforeAll(async () => {
  site = await createTestSite(db, "results-read")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 20 eingetragen",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
  otherId = (
    await db.user.create({
      data: { email: `results-read-${site.siteId}@example.com`, name: "Test", passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

async function card(
  startedAtMs: number,
  details: DetailsInput,
  extra: Partial<EnteredCardInput> = {}
) {
  const result = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs,
    kind: "training",
    details,
    reason: "eingetragen",
    ...extra,
  })
  if (result.kind !== "saved") throw new Error(`nicht gespeichert: ${result.kind}`)
  return result.cardId
}

const TEN = (ring: number) => Array.from({ length: 10 }, () => ring)
// 2. Mai 2026, 0:30 Uhr in Berlin: zählt zum Abend des 1. Mai
const NIGHT = Date.UTC(2026, 4, 1, 22, 30)
const EVENING = Date.UTC(2026, 4, 3, 17)

describe("resultCards", () => {
  let sums: string
  let shots: string
  let foreign: string
  let deleted: string

  beforeAll(async () => {
    sums = await card(NIGHT, {
      series: [
        { series: 1, shots: 10, rings: 94 },
        { series: 2, shots: 10, rings: 95 },
      ],
    })
    shots = await card(EVENING, {
      shots: [
        ...TEN(9).map((ring) => ({ series: 1, ring, decimalTenths: null })),
        ...TEN(10).map((ring) => ({ series: 2, ring, decimalTenths: null })),
      ],
    })
    foreign = await card(
      EVENING + 3_600_000,
      { total: { shots: 20, rings: 180 } },
      { ownerId: otherId }
    )
    deleted = await card(EVENING + 7_200_000, { total: { shots: 20, rings: 170 } })
    await db.card.update({ where: { id: deleted }, data: { deletedAt: new Date() } })
  })

  it("liefert eigene, sichtbare Scheiben mit Abend, Familie und Herkunft", async () => {
    const cards = await resultCards(db, {
      ownerId: site.ownerId,
      timeZone: ZONE,
      ids: [sums, shots, foreign, deleted],
    })
    expect(cards.map((c) => c.id).sort()).toEqual([sums, shots].sort())
    const night = cards.find((c) => c.id === sums)!
    expect(night.day).toBe("2026-05-01")
    expect(night.family).toEqual({
      id: site.familyId,
      slug: expect.any(String),
      name: expect.any(String),
    })
    expect(night.provenance).toBe("entered")
    expect(night.shots).toBe(20)
    expect(cards.find((c) => c.id === shots)!.day).toBe("2026-05-03")
  })

  it("rechnet das Ergebnis wie die Liste der Scheiben", async () => {
    const { shown, scoringOf } = await overviewCards(db, site.ownerId)
    const family = shown.find((c) => c.id === sums)!.family!.slug
    const model = cardListModel(
      withFamily(listable(shown)),
      { ...DEFAULT_LIST, family },
      { timeZone: ZONE, nowMs: Date.now(), named: [], scoring: scoringOf(family) }
    )
    const rows = new Map(model.evenings.flatMap((e) => e.rows.map((r) => [r.id, r])))
    const cards = await resultCards(db, {
      ownerId: site.ownerId,
      timeZone: ZONE,
      ids: [sums, shots],
    })
    for (const c of cards) {
      expect(c.result).not.toBeNull()
      expect(c.result!.value).toBe(rows.get(c.id)!.result)
      expect(c.result!.scoring).toBe(rows.get(c.id)!.resultScoring)
    }
    expect(cards.find((c) => c.id === sums)!.result!.value).toBe(189)
    expect(cards.find((c) => c.id === shots)!.result!.value).toBe(190)
  })

  it("grenzt nach Beginn ein", async () => {
    const cards = await resultCards(db, {
      ownerId: site.ownerId,
      timeZone: ZONE,
      fromMs: EVENING - 1,
      toMs: EVENING + 1,
    })
    expect(cards.map((c) => c.id)).toEqual([shots])
  })

  it("gibt einem anderen Konto nichts von diesen Scheiben", async () => {
    const cards = await resultCards(db, {
      ownerId: otherId,
      timeZone: ZONE,
      ids: [sums, shots, foreign],
    })
    expect(cards.map((c) => c.id)).toEqual([foreign])
  })

  it("liefert die Serien aus Schüssen und aus Serien-Summen", async () => {
    expect(await resultCardSeries(db, { ownerId: site.ownerId, cardId: shots })).toEqual([
      { series: 1, shots: 10, result: { value: 90, scoring: "rings", digits: 0 } },
      { series: 2, shots: 10, result: { value: 100, scoring: "rings", digits: 0 } },
    ])
    expect(await resultCardSeries(db, { ownerId: site.ownerId, cardId: sums })).toEqual([
      { series: 1, shots: 10, result: { value: 94, scoring: "rings", digits: 0 } },
      { series: 2, shots: 10, result: { value: 95, scoring: "rings", digits: 0 } },
    ])
  })

  it("liefert ohne Serien eine leere Liste, für eine fremde oder gelöschte Scheibe null", async () => {
    const total = await card(EVENING + 10_800_000, { total: { shots: 20, rings: 181 } })
    expect(await resultCardSeries(db, { ownerId: site.ownerId, cardId: total })).toEqual([])
    expect(await resultCardSeries(db, { ownerId: site.ownerId, cardId: foreign })).toBeNull()
    expect(await resultCardSeries(db, { ownerId: site.ownerId, cardId: deleted })).toBeNull()
  })
})

describe("resultGoalCards", () => {
  // eigene Abende im Juni, damit die Scheiben oben nicht in den Zeitraum fallen
  const JUNE = Date.UTC(2026, 5, 2, 17)
  const DAY = 86_400_000
  let sums: string
  let shots: string
  let probe: string

  beforeAll(async () => {
    sums = await card(JUNE, {
      series: [
        { series: 1, shots: 10, rings: 94 },
        { series: 2, shots: 10, rings: 95 },
      ],
    })
    shots = await card(JUNE + DAY, {
      shots: [
        ...TEN(9).map((ring) => ({ series: 1, ring, decimalTenths: null })),
        ...TEN(10).map((ring) => ({ series: 2, ring, decimalTenths: null })),
      ],
    })
    probe = await card(
      JUNE + 2 * DAY,
      { total: { shots: 30, rings: 270 } },
      { kind: "competition" }
    )
    await card(JUNE + DAY, { total: { shots: 20, rings: 180 } }, { ownerId: otherId })
    const gone = await card(JUNE + 3 * DAY, { total: { shots: 20, rings: 170 } })
    await db.card.update({ where: { id: gone }, data: { deletedAt: new Date() } })
  })

  const june = () =>
    resultGoalCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      fromMs: JUNE - 1,
      toMs: JUNE + 5 * DAY,
      timeZone: ZONE,
    })

  it("liefert eigene, sichtbare Scheiben der Familie im Zeitraum mit Ergebnis und Serien", async () => {
    const cards = await june()
    expect(cards.map((c) => c.id).sort()).toEqual([sums, shots, probe].sort())
    const fromSums = cards.find((c) => c.id === sums)!
    expect(fromSums).toMatchObject({ day: "2026-06-02", kind: "training", shots: 20, rings: 189 })
    expect(fromSums.decimal).toBeNull()
    expect(fromSums.series).toEqual([
      { series: 1, shots: 10, rings: 94, decimal: null },
      { series: 2, shots: 10, rings: 95, decimal: null },
    ])
    expect(cards.find((c) => c.id === shots)!.series?.map((s) => s.rings)).toEqual([90, 100])
    expect(cards.find((c) => c.id === probe)).toMatchObject({
      kind: "competition",
      rings: 270,
      series: [],
    })
  })

  it("Vorgaben je Familie in einem Durchgang, gleich denen von resultGoalCards", async () => {
    const defaults = (await resultGoalDefaults(db, site.ownerId)).find(
      (d) => d.familyId === site.familyId
    )
    expect(defaults).toMatchObject({ scoring: "rings", usualShots: 20, usualSeriesShots: 10 })
    expect(defaults?.latestMs).toBeGreaterThanOrEqual(JUNE + 2 * DAY)
    expect((await resultGoalDefaults(db, otherId)).map((d) => d.familyId)).toEqual([site.familyId])
  })

  it("grenzt nach Beginn ein", async () => {
    const cards = await resultGoalCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      fromMs: JUNE + DAY - 1,
      toMs: JUNE + DAY + 1,
      timeZone: ZONE,
    })
    expect(cards.map((c) => c.id)).toEqual([shots])
  })
})

describe("resultFormCards", () => {
  // eigene Abende im Juli, damit die übrigen Scheiben dieser Datei davor liegen
  const JULY = Date.UTC(2026, 6, 2, 17)
  const DAY = 86_400_000
  let shots: string
  let probe: string
  let sums: string
  let otherFamily: number

  beforeAll(async () => {
    shots = await card(JULY, {
      shots: [
        ...TEN(9).map((ring) => ({ series: 1, ring, decimalTenths: null })),
        ...[10, 10, 10, 10, 10, 9, 9, 9, 9, 9].map((ring) => ({
          series: 2,
          ring,
          decimalTenths: null,
        })),
      ],
    })
    probe = await card(JULY + DAY, {
      shots: TEN(8).map((ring) => ({ series: null, ring, decimalTenths: null, probe: true })),
    })
    sums = await card(JULY + 2 * DAY, {
      series: [
        { series: 1, shots: 10, rings: 94 },
        { series: 2, shots: 10, rings: 95 },
      ],
    })
    const family = await db.family.create({
      data: { slug: `lg-${site.siteId}`, name: `Luftgewehr ${site.siteId}` },
    })
    otherFamily = family.id
    const discipline = await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LG 20 eingetragen",
        familyId: family.id,
        targetId: "lg-10m",
        plannedShots: 20,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    await card(JULY + DAY, { total: { shots: 20, rings: 190 } }, { disciplineId: discipline.id })
    const gone = await card(JULY + 3 * DAY, { total: { shots: 20, rings: 170 } })
    await db.card.update({ where: { id: gone }, data: { deletedAt: new Date() } })
  })
  afterAll(async () => {
    await db.card.deleteMany({ where: { discipline: { familyId: otherFamily } } })
    await db.discipline.deleteMany({ where: { familyId: otherFamily } })
    await db.family.delete({ where: { id: otherFamily } })
  })

  it("liefert die sichtbaren eigenen Scheiben der Familie in zeitlicher Folge", async () => {
    const { scoring, cards } = await resultFormCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      timeZone: ZONE,
    })
    expect(scoring).toBe("rings")
    const july = cards.filter((c) => c.startedAtMs >= JULY)
    expect(july.map((c) => c.id)).toEqual([shots, probe, sums])
    expect(cards.map((c) => c.startedAtMs)).toEqual(
      [...cards.map((c) => c.startedAtMs)].sort((a, b) => a - b)
    )
    expect(july.map((c) => c.day)).toEqual(["2026-07-02", "2026-07-03", "2026-07-04"])
    expect(july.map((c) => c.probeOnly)).toEqual([false, true, false])
  })

  it("nimmt den Ø je Schuss der Projektion, auch für nur Probe, und die Serien je Schuss", async () => {
    const { cards } = await resultFormCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      timeZone: ZONE,
    })
    const { shown } = await overviewCards(db, site.ownerId)
    const metric = metricByKey("result.decimalMean") as MetricDefinition
    const expected = new Map(
      projectedValues(
        shown.filter((c) => c.familyId === site.familyId),
        metric,
        "rings",
        { includeProbeOnly: true }
      ).map((v) => [v.id, v])
    )
    for (const id of [shots, probe, sums]) {
      const formCard = cards.find((c) => c.id === id)!
      const value = expected.get(id)!
      expect(formCard.mean).not.toBeNull()
      expect(formCard.mean!.value).toBe(value.value)
      expect(formCard.mean!.n).toBe(value.n)
      expect(formCard.mean!.sd).toBe(value.sd)
    }
    const fromShots = cards.find((c) => c.id === shots)!
    expect(fromShots.mean).toMatchObject({ value: 9.25, n: 20 })
    expect(fromShots.mean!.sd).toBeGreaterThan(0)
    expect(fromShots.series).toEqual([
      { series: 1, shots: 10, mean: 9 },
      { series: 2, shots: 10, mean: 9.5 },
    ])
    expect(cards.find((c) => c.id === probe)!.mean).toMatchObject({ value: 8, n: 10 })
    const fromSums = cards.find((c) => c.id === sums)!
    expect(fromSums.mean).toMatchObject({ value: 9.45, n: 20 })
    expect(fromSums.mean!.sd).toBeUndefined()
    expect(fromSums.series![0].mean).toBeCloseTo(9.4, 9)
  })
})

describe("resultFamilies", () => {
  it("nennt die Familie einer eingeordneten Disziplin", async () => {
    const families = await resultFamilies(db, site.ownerId)
    expect(families.map((f) => f.id)).toContain(site.familyId)
  })
})
