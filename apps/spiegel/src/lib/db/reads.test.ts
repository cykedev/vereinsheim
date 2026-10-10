import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { cardValues, periodRecords, type PeriodCard } from "@vereinsheim/shot-core/analysis"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { projectedRecords, projectedValues } from "@vereinsheim/shot-core/projection"

import { createPrismaClient } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { writeRevision } from "./cards"
import { cardWithShots, familyCards, latestCardStart, ownerCards } from "./reads"

const db = createPrismaClient()
let site: TestSite
let otherDisciplineId: number
let otherFamilyId: number
const FIRST_MS = Date.UTC(2026, 3, 1, 16, 30)
const DAY_MS = 86_400_000

beforeAll(async () => {
  site = await createTestSite(db, "reads")
  const family = await db.family.create({ data: { name: `LG ${site.siteId}` } })
  otherFamilyId = family.id
  otherDisciplineId = (
    await db.discipline.create({
      data: { siteId: site.siteId, meytonId: 10_100_040, name: "LG 40", familyId: family.id },
    })
  ).id
  const common = { sourceId: site.sourceId, ownerId: site.ownerId, everyDays: 4 }
  // 30 Scheiben LP über 40 Abende, dazu am letzten Abend eine Scheibe LG
  for (const input of generateSeason({
    ...common,
    seed: 7,
    cards: 30,
    firstMs: FIRST_MS,
    disciplineId: site.disciplineId,
    scheibenIdBase: 2000,
  }))
    await writeRevision(db, input)
  const [lg] = generateSeason({
    ...common,
    seed: 8,
    cards: 1,
    firstMs: FIRST_MS + 9 * 4 * DAY_MS + 3 * 60 * 60_000,
    disciplineId: otherDisciplineId,
    scheibenIdBase: 3000,
  })
  await writeRevision(db, lg)
  // eine gelöschte Scheibe (Papierkorb) fehlt in jeder Übersicht
  const [trash] = generateSeason({
    ...common,
    seed: 9,
    cards: 1,
    firstMs: FIRST_MS + DAY_MS,
    disciplineId: site.disciplineId,
    scheibenIdBase: 4000,
  })
  const { cardId } = await writeRevision(db, trash)
  await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
})
afterAll(async () => {
  await site.remove()
  await db.family.delete({ where: { id: otherFamilyId } })
  await db.$disconnect()
})

describe("familyCards", () => {
  it("die Scheiben der Familie nach Beginn, ohne Schüsse und ohne gelöschte", async () => {
    const cards = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    expect(cards).toHaveLength(30)
    expect(cards.map((c) => c.startedAtMs)).toEqual([...cards.map((c) => c.startedAtMs)].sort())
    for (const card of cards) expect(card).not.toHaveProperty("shots")
    expect(cards.every((c) => c.familyId === site.familyId)).toBe(true)
  })

  it("im Zeitraum: Beginn eingeschlossen, Ende ausgeschlossen", async () => {
    const all = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const fromMs = all[3].startedAtMs
    const toMs = all[9].startedAtMs
    const range = await familyCards(db, {
      ownerId: site.ownerId,
      familyId: site.familyId,
      fromMs,
      toMs,
    })
    expect(range.map((c) => c.id)).toEqual(all.slice(3, 9).map((c) => c.id))
  })

  it("Werte und Rekorde aus der Datenbank gleich der Rechnung aus den Schüssen", async () => {
    const overview = await familyCards(db, { ownerId: site.ownerId, familyId: site.familyId })
    const cards: PeriodCard[] = []
    for (const { id } of overview) cards.push((await cardWithShots(db, id))!)
    expect(overview.filter((c) => c.projection.probeOnly).length).toBeGreaterThan(0)
    expect(overview.filter((c) => c.kind === "competition").length).toBeGreaterThan(0)

    for (const scoring of ["decimal", "rings"] as const) {
      for (const key of ["result.decimal", "result.decimalMean", "group.enclosingDiameter"]) {
        const metric = metricByKey(key) as MetricDefinition
        for (const includeProbeOnly of [false, true])
          expect(projectedValues(overview, metric, scoring, { includeProbeOnly })).toEqual(
            cardValues(cards, metric, scoring, { includeProbeOnly })
          )
      }
      for (const options of [{}, { includeProbeOnly: true }, { kind: "competition" as const }])
        expect(projectedRecords(overview, scoring, options)).toEqual(
          periodRecords(cards, scoring, options)
        )
    }
  })
})

describe("Start", () => {
  it("der letzte Abend über alle Familien", async () => {
    const latest = await latestCardStart(db, site.ownerId)
    expect(latest).toBe(FIRST_MS + 9 * 4 * DAY_MS + 3 * 60 * 60_000)
    const evening = await ownerCards(db, {
      ownerId: site.ownerId,
      fromMs: FIRST_MS + 9 * 4 * DAY_MS,
      toMs: latest! + 1,
    })
    expect(evening.map((c) => c.familyId)).toEqual([
      site.familyId,
      site.familyId,
      site.familyId,
      otherFamilyId,
    ])
  })
})

describe("cardWithShots", () => {
  it("eine gelöschte oder unbekannte Scheibe gibt es nicht", async () => {
    const trash = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, deletedAt: { not: null } },
    })
    expect(await cardWithShots(db, trash.id)).toBeNull()
    expect(await cardWithShots(db, "keine")).toBeNull()
  })
})
