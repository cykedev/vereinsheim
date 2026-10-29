import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import {
  deletePreview,
  PREVIEW_CARD_PREFIX,
  runPreview,
  type TreffsicherExport,
} from "./diary-preview"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
let site: TestSite
let familyName: string
let disciplineId: number
let cardB: string

const ten = (value: string) => Array.from({ length: 10 }, () => value)
const DAYS = ["2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04"]

async function card(day: string) {
  const result = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.parse(`${day}T17:00:00Z`),
    kind: "training",
    details: {
      shots: [1, 2, 3, 4].flatMap((series) =>
        Array.from({ length: 10 }, () => ({ series, ring: 9, decimalTenths: null }))
      ),
    },
    reason: "eingetragen",
  })
  if (result.kind !== "saved") throw new Error(result.kind)
  return result.cardId
}

type Session = TreffsicherExport["sessions"][number]
function session(id: string, day: string, over: Partial<Session> = {}): Session {
  return {
    id: `${id}x${site.siteId}`,
    date: `${day}T18:00:00.000Z`,
    type: "TRAINING",
    location: "Schützenhaus",
    trainingGoal: null,
    isFavourite: false,
    discipline: { name: ` ${familyName.toLowerCase()} `, scoringType: "WHOLE", shotsPerSeries: 10 },
    hitLocation: null,
    wellbeing: { sleep: 70, energy: 50, stress: 30, motivation: 90 },
    prognosis: null,
    feedback: null,
    reflection: null,
    series: [1, 2, 3, 4].map((position) => ({
      position,
      isPractice: false,
      scoreTotal: 90,
      shots: ten("9"),
      executionQuality: null,
    })),
    ...over,
  }
}

let exported: TreffsicherExport

beforeAll(async () => {
  site = await createTestSite(db, "diary-preview")
  familyName = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).name
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 40 Vorschau",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 40,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
  await card(DAYS[0])
  cardB = await card(DAYS[2])
  exported = {
    sessions: [
      session("a", DAYS[0]),
      session("b", DAYS[1]),
      session("c", DAYS[2], {
        series: [
          { position: 0, isPractice: true, scoreTotal: null, shots: ["8"], executionQuality: 3 },
          ...[2, 4, 3, 5].map((quality, i) => ({
            position: i + 1,
            isPractice: false,
            scoreTotal: 90,
            shots: ten("9"),
            executionQuality: quality,
          })),
        ],
      }),
    ],
  }
})
afterAll(async () => {
  await db.diaryEntry.deleteMany({ where: { userId: site.ownerId } })
  await site.remove()
  await db.$disconnect()
})

const run = (dryRun = false, data = exported) =>
  runPreview(db, {
    export: data,
    toUserId: site.ownerId,
    timeZone: ZONE,
    dryRun,
    siteId: site.siteId,
  })

const counts = async () => ({
  entries: await db.diaryEntry.count({ where: { userId: site.ownerId } }),
  cards: await db.card.count({ where: { ownerId: site.ownerId, deletedAt: null } }),
  links: await db.diaryEntryCard.count({ where: { entry: { userId: site.ownerId } } }),
  executions: await db.diarySeriesExecution.count({ where: { entry: { userId: site.ownerId } } }),
})

describe("runPreview", () => {
  it("legt eine Scheibe und drei Einträge an, verknüpft sie und legt die Ausführung auf vier Serien", async () => {
    const report = await run()
    expect(report.sessions).toBe(3)
    expect(report.entries).toEqual({ created: 3, updated: 0, deleted: 0 })
    expect(report.cards.created).toEqual({ shots: 1, series: 0 })
    expect(report.withoutCard.eveningHasCard).toBe(2)
    expect(report.executions).toMatchObject({ placed: 1, series: 4, practiceSkipped: 1 })
    expect(report.unmatchedDisciplines).toEqual({})
    expect(await counts()).toEqual({ entries: 3, cards: 3, links: 1, executions: 4 })
    const created = await db.card.findFirstOrThrow({
      where: { ownerId: site.ownerId, importKey: { startsWith: PREVIEW_CARD_PREFIX } },
      select: { id: true, origin: true, place: true },
    })
    expect(created).toMatchObject({ origin: "treffsicher", place: "Schützenhaus" })
    const link = await db.diaryEntryCard.findFirstOrThrow({
      where: { cardId: created.id },
      include: { entry: true },
    })
    expect(link.entry.importKey).toBe(`preview:${exported.sessions[1].id}`)
    const executions = await db.diarySeriesExecution.findMany({
      where: { cardId: cardB },
      orderBy: { series: "asc" },
    })
    expect(executions.map((e) => [e.series, e.value])).toEqual([
      [1, 30],
      [2, 70],
      [3, 50],
      [4, 90],
    ])
    const withCard = await db.diaryEntry.findFirstOrThrow({
      where: { importKey: `preview:${exported.sessions[0].id}` },
      include: { scales: true },
    })
    expect(withCard.note).toBeNull()
    expect(withCard.scales).toHaveLength(4)
  })

  it("ein zweiter Lauf ändert nichts an der Zahl der Zeilen", async () => {
    const before = await counts()
    const report = await run()
    expect(report.entries).toEqual({ created: 0, updated: 3, deleted: 0 })
    expect(report.cards.unchanged).toEqual({ shots: 1, series: 0 })
    expect(await counts()).toEqual(before)
  })

  it("dryRun rechnet und schreibt nichts", async () => {
    const before = await counts()
    const report = await run(true, {
      sessions: [...exported.sessions, session("d", DAYS[3])],
    })
    expect(report.entries.created).toBe(1)
    expect(report.cards.created.shots).toBe(1)
    expect(await counts()).toEqual(before)
  })

  it("nennt eine Disziplin ohne Familie und legt den Eintrag ohne Disziplin an", async () => {
    const report = await run(true, {
      sessions: [
        session("e", DAYS[3], {
          discipline: { name: "Kleinkaliber", scoringType: "TENTH", shotsPerSeries: 10 },
        }),
      ],
    })
    expect(report.unmatchedDisciplines).toEqual({ Kleinkaliber: 1 })
    expect(report.withoutCard.noFamily).toBe(1)
  })
})

describe("deletePreview", () => {
  it("löscht Vorschau-Scheiben und -Einträge, lässt die übrigen stehen", async () => {
    const own = await db.diaryEntry.create({
      data: {
        userId: site.ownerId,
        day: new Date("2026-04-05T00:00:00Z"),
        familyId: site.familyId,
      },
    })
    const report = await deletePreview(db, site.ownerId)
    expect(report.cards.removed).toBe(1)
    expect(report.entries.deleted).toBe(3)
    expect(
      await db.diaryEntry.findMany({ where: { userId: site.ownerId }, select: { id: true } })
    ).toEqual([{ id: own.id }])
    expect(await db.card.count({ where: { ownerId: site.ownerId } })).toBe(2)
  })
})
