import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { analysisView, factorView } from "./queries"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
let site: TestSite
let disciplineId: number
let familySlug: string
let otherFamily: { id: number; slug: string }
let sixth: string

const ten = (series: number, ring: number) =>
  Array.from({ length: 10 }, () => ({ series, ring, decimalTenths: null }))

async function card(day: string, rings: [number, number]) {
  const result = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.parse(`${day}T17:00:00Z`),
    kind: "training",
    details: { shots: [...ten(1, rings[0]), ...ten(2, rings[1])] },
    reason: "eingetragen",
  })
  if (result.kind !== "saved") throw new Error(`nicht gespeichert: ${result.kind}`)
  return result.cardId
}

async function entry(
  day: string,
  extra: { familyId?: number; energy?: number; deleted?: boolean; expected?: number } = {}
) {
  const created = await db.diaryEntry.create({
    data: {
      userId: site.ownerId,
      day: new Date(`${day}T00:00:00Z`),
      kind: "shooting",
      familyId: extra.familyId ?? site.familyId,
      expectedScore: extra.expected ?? null,
      deletedAt: extra.deleted ? new Date() : null,
      scales:
        extra.energy === undefined
          ? undefined
          : { create: [{ part: "wellbeing", aspect: "energy", value: extra.energy }] },
    },
  })
  return created.id
}

// sieben Abende über das Ende einer Saison: 27. August bis 2. September 2026
const DAYS = [
  "2026-08-27",
  "2026-08-28",
  "2026-08-29",
  "2026-08-30",
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
]

beforeAll(async () => {
  site = await createTestSite(db, "diary-analysis")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 20 Auswertung",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
  familySlug = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).slug
  const family = await db.family.create({
    data: { slug: `lg-analysis-${site.siteId}`, name: `Luftgewehr ${site.siteId}` },
  })
  otherFamily = { id: family.id, slug: family.slug }
  await db.discipline.create({
    data: {
      siteId: site.siteId,
      meytonId: null,
      name: "LG 20 Auswertung",
      familyId: family.id,
      targetId: "lg-10m",
      plannedShots: 20,
      seriesShots: 10,
      officialScoring: "rings",
      confirmedAt: new Date(),
    },
  })
  const cards: string[] = []
  for (const day of DAYS.slice(0, 5)) cards.push(await card(day, [9, 9]))
  cards.push(await card(DAYS[5], [10, 9]))
  cards.push(await card(DAYS[6], [9, 9]))

  sixth = await entry(DAYS[5], { energy: 70, expected: 185 })
  await db.diarySeriesExecution.createMany({
    data: [
      { entryId: sixth, cardId: cards[5], series: 1, value: 90 },
      { entryId: sixth, cardId: cards[5], series: 2, value: 10 },
    ],
  })
  await entry(DAYS[2], { energy: 30 })
  await entry("2026-09-05", { energy: 50 })
  await entry(DAYS[6], { energy: 90, deleted: true })
  await entry("2026-08-01", { familyId: otherFamily.id })
})
afterAll(async () => {
  await db.diaryEntry.deleteMany({ where: { userId: site.ownerId } })
  await db.discipline.deleteMany({ where: { familyId: otherFamily.id } })
  await site.remove()
  await db.family.delete({ where: { id: otherFamily.id } })
  await db.$disconnect()
})

describe("analysisView", () => {
  it("nennt die Disziplinen mit Einträgen, die mit dem jüngsten zuerst, und die Saisons", async () => {
    const view = await analysisView(db, site.ownerId, { family: null, season: null }, ZONE)
    expect(view.families.map((f) => f.id)).toEqual([site.familyId, otherFamily.id])
    expect(view.family?.slug).toBe(familySlug)
    expect(view.seasons.map((s) => s.label)).toEqual(["Saison 26/27", "Saison 25/26"])
    expect(view.season).toBeNull()
    const other = await analysisView(
      db,
      site.ownerId,
      { family: otherFamily.slug, season: null },
      ZONE
    )
    expect(other.family?.id).toBe(otherFamily.id)
    expect(other.influences.withWellbeing).toBe(0)
  })

  it("zählt einen Eintrag mit fünf Scheiben davor, nennt die ohne Form und ohne Scheibe", async () => {
    const view = await analysisView(db, site.ownerId, { family: familySlug, season: null }, ZONE)
    expect(view.influences.withWellbeing).toBe(3)
    expect(view.influences.left).toEqual({ noCard: 1, noForm: 1 })
    const energy = view.influences.rows.find((r) => r.aspect === "energy")!
    expect(energy.entered).toBe(1)
    expect(energy.points).toHaveLength(1)
    expect(energy.points[0].entryId).toBe(sixth)
    // 190 Ringe auf 20 Schuss gegen 9,0 aus den fünf Abenden davor
    expect(energy.points[0].distance).toBeCloseTo(0.5, 9)
    expect(view.influences.rows.find((r) => r.aspect === "sleep")!.entered).toBe(0)
  })

  it("teilt nach der Saison: 1. September gehört zur neuen, die Form zählt auch davor", async () => {
    const current = await analysisView(
      db,
      site.ownerId,
      { family: familySlug, season: "2026" },
      ZONE
    )
    expect(current.season?.label).toBe("Saison 26/27")
    expect(current.influences.withWellbeing).toBe(2)
    expect(current.influences.left).toEqual({ noCard: 1, noForm: 0 })
    expect(current.influences.rows.find((r) => r.aspect === "energy")!.entered).toBe(1)
    const before = await analysisView(
      db,
      site.ownerId,
      { family: familySlug, season: "2025" },
      ZONE
    )
    expect(before.influences.withWellbeing).toBe(1)
    expect(before.influences.left).toEqual({ noCard: 0, noForm: 1 })
    expect(before.influences.rows.find((r) => r.aspect === "energy")!.points).toEqual([])
    const unknown = await analysisView(
      db,
      site.ownerId,
      { family: familySlug, season: "1999" },
      ZONE
    )
    expect(unknown.season).toBeNull()
  })

  it("rechnet Ausführung, erwartet und geschossen sowie vorher und nachher", async () => {
    const view = await analysisView(db, site.ownerId, { family: familySlug, season: null }, ZONE)
    expect(view.execution).toMatchObject({ series: 2, evenings: 1, high: 1, low: 1, rated: 2 })
    expect(view.execution.comparison?.delta).toBeCloseTo(1, 9)
    expect(view.expected.rows).toHaveLength(1)
    expect(view.expected.rows[0]).toMatchObject({ entryId: sixth, expected: 185, delta: 5 })
    expect(view.beforeAfter.n).toBe(0)
  })

  it("lässt Einträge im Papierkorb und fremde Konten aus", async () => {
    const view = await analysisView(db, site.ownerId, { family: familySlug, season: "2026" }, ZONE)
    const energy = view.influences.rows.find((r) => r.aspect === "energy")!
    expect(energy.points.map((p) => p.entryId)).toEqual([sixth])
    const stranger = await analysisView(db, "nobody", { family: familySlug, season: null }, ZONE)
    expect(stranger.families).toEqual([])
    expect(stranger.family).toBeNull()
    expect(stranger.influences.withWellbeing).toBe(0)
  })
})

describe("factorView", () => {
  it("gibt die Zeile eines Merkmals mit Disziplin und Zeitraum, ohne Disziplin null", async () => {
    const view = await factorView(
      db,
      site.ownerId,
      { aspect: "energy", family: familySlug, season: "2026" },
      ZONE
    )
    expect(view?.family.id).toBe(site.familyId)
    expect(view?.season?.label).toBe("Saison 26/27")
    expect(view?.row.points.map((p) => p.entryId)).toEqual([sixth])
    expect(view?.left).toEqual({ noCard: 1, noForm: 0 })
    expect(
      await factorView(db, "nobody", { aspect: "energy", family: null, season: null }, ZONE)
    ).toBeNull()
  })
})
