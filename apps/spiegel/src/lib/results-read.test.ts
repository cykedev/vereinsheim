import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeEnteredCard, type EnteredCardInput } from "./db/entered"
import type { DetailsInput } from "./entered/details"
import { overviewCards } from "./overview"
import { listable, withFamily } from "./pages"
import { resultCards, resultCardSeries, resultFamilies } from "./results-read"

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

describe("resultFamilies", () => {
  it("nennt die Familie einer eingeordneten Disziplin", async () => {
    const families = await resultFamilies(db, site.ownerId)
    expect(families.map((f) => f.id)).toContain(site.familyId)
  })
})
