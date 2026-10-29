import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { createWithout } from "../entries"
import { ERRORS } from "../texts"
import { diaryTrashThings, purgeExpiredDiaryTrash } from "../trash"
import {
  GOAL_TRASH_ERRORS,
  createGoal,
  deleteGoal,
  purgeGoalNow,
  restoreGoal,
  setGoalNote,
  setGoalOutcome,
  updateGoal,
} from "./goals"
import { goalForEdit, goalFormFamilies, goalList, goalView, startGoals } from "./queries"
import { GOAL_ERRORS } from "./texts"
import type { GoalInput } from "./validation"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
const DAY = 86_400_000
// „heute“ der Tests: 28. Oktober 2026, mitten in der Saison 26/27
const NOW = Date.UTC(2026, 9, 28, 12)
let site: TestSite
let disciplineId: number
let otherId: string
let familySlug: string

beforeAll(async () => {
  site = await createTestSite(db, "diary-goals")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 40 Ziele",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 40,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
  familySlug = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).slug
  otherId = (
    await db.user.create({
      data: { email: `diary-goals-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  // vier Scheiben im Oktober 2026 zu 40 Schuss in Serien: 350, 356, 360 im Training, 362 im Wettkampf
  const totals = [
    [350, "training"],
    [356, "training"],
    [360, "training"],
    [362, "competition"],
  ] as const
  for (const [i, [total, kind]] of totals.entries()) {
    const first = Math.floor(total / 4)
    const result = await writeEnteredCard(db, {
      ownerId: site.ownerId,
      origin: "manual",
      disciplineId,
      startedAtMs: Date.UTC(2026, 9, 2 + i * 3, 17),
      kind,
      details: {
        series: [first, first, first, total - 3 * first].map((rings, s) => ({
          series: s + 1,
          shots: 10,
          rings,
        })),
      },
      reason: "eingetragen",
    })
    if (result.kind !== "saved") throw new Error(result.kind)
  }
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

const goal = (extra: Partial<GoalInput> = {}): GoalInput => ({
  title: "355 im Training regelmäßig",
  kind: "result",
  familyId: site.familyId,
  from: "2026-09-01",
  to: "2027-08-31",
  measure: { measure: "card", threshold: "355", scoring: "rings", shots: 40, cards: "training" },
  ...extra,
})

async function created(extra: Partial<GoalInput> = {}, userId = site.ownerId) {
  const result = await createGoal(db, userId, goal(extra))
  if (!("id" in result)) throw new Error(JSON.stringify(result))
  return result.id
}

describe("Ziele schreiben", () => {
  it("anlegen und ändern; ein Prozessziel verliert die Messung, Notiz und Antwort bleiben", async () => {
    const id = await created()
    expect(await goalForEdit(db, site.ownerId, id)).toMatchObject({
      title: "355 im Training regelmäßig",
      measure: { measure: "card", threshold: 355, shots: 40, cards: "training" },
    })
    expect(await setGoalNote(db, site.ownerId, id, "  jede zweite  ")).toBeNull()
    expect(await setGoalOutcome(db, site.ownerId, id, "partly")).toBeNull()
    expect(await updateGoal(db, site.ownerId, id, goal({ kind: "process" }))).toBeNull()
    const row = await db.diaryGoal.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({
      kind: "process",
      measure: null,
      threshold: null,
      scoring: null,
      shots: null,
      cards: "all",
      note: "jede zweite",
      outcome: "partly",
    })
  })

  it("Feldfehler kommen als Liste je Feld, ohne zu schreiben", async () => {
    const before = await db.diaryGoal.count({ where: { userId: site.ownerId } })
    expect(await createGoal(db, site.ownerId, goal({ title: " " }))).toEqual({
      fieldErrors: { title: [GOAL_ERRORS.title] },
    })
    expect(await db.diaryGoal.count({ where: { userId: site.ownerId } })).toBe(before)
  })

  it("ein fremdes Ziel ändert niemand", async () => {
    const id = await created({}, otherId)
    expect(await updateGoal(db, site.ownerId, id, goal())).toEqual({ error: GOAL_ERRORS.missing })
    expect(await setGoalNote(db, site.ownerId, id, "x")).toBe(GOAL_ERRORS.missing)
    expect(await deleteGoal(db, site.ownerId, id)).toBe(GOAL_ERRORS.missing)
    expect(await setGoalOutcome(db, site.ownerId, id, "kaputt")).toBe(ERRORS.failed)
  })

  it("Papierkorb: löschen, wiederherstellen, endgültig nur aus dem Papierkorb, nach 30 Tagen nicht mehr zurück", async () => {
    const id = await created()
    expect(await purgeGoalNow(db, site.ownerId, id)).toBe(GOAL_TRASH_ERRORS.notInTrash)
    expect(await deleteGoal(db, site.ownerId, id)).toBeNull()
    expect(await goalView(db, site.ownerId, id, ZONE, NOW)).toBeNull()
    expect(await restoreGoal(db, site.ownerId, id)).toBeNull()
    expect(await goalView(db, site.ownerId, id, ZONE, NOW)).not.toBeNull()
    expect(await deleteGoal(db, site.ownerId, id)).toBeNull()
    expect(await restoreGoal(db, site.ownerId, id, Date.now() + 31 * DAY)).toBe(
      GOAL_TRASH_ERRORS.expired
    )
    expect(await purgeGoalNow(db, site.ownerId, id)).toBeNull()
    expect(await db.diaryGoal.findUnique({ where: { id } })).toBeNull()
  })

  it("Papierkorb zeigt das Ziel mit den Tagen; nach 30 Tagen löscht der Lauf es endgültig", async () => {
    const id = await created({ title: "Im Papierkorb" })
    expect(await deleteGoal(db, site.ownerId, id)).toBeNull()
    const { goals } = await diaryTrashThings(db, site.ownerId)
    expect(goals.find((g) => g.id === id)).toEqual({
      id,
      name: "Im Papierkorb",
      left: "noch 30 Tage",
    })
    await db.diaryGoal.update({
      where: { id },
      data: { deletedAt: new Date(Date.now() - 31 * DAY) },
    })
    expect(await purgeExpiredDiaryTrash(db, { nowMs: Date.now() })).toBeGreaterThanOrEqual(1)
    expect(await db.diaryGoal.findUnique({ where: { id } })).toBeNull()
  })
})

describe("Ziele lesen", () => {
  let measured: string
  let series: string
  let process: string
  let withoutFamily: string
  let upcoming: string
  let past: string

  beforeAll(async () => {
    await db.diaryGoal.deleteMany({ where: { userId: site.ownerId } })
    measured = await created()
    series = await created({
      title: "Serien ab 90",
      measure: { measure: "series", threshold: "90", scoring: "rings", shots: 10, cards: "all" },
    })
    process = await created({ title: "Beim Schuss bleiben", kind: "process", measure: null })
    withoutFamily = await created({ title: "Ohne Disziplin", familyId: null, measure: null })
    upcoming = await created({ from: "2027-09-01", to: "2028-08-31" })
    past = await created({ from: "2025-09-01", to: "2026-08-31" })
    await createWithout(db, site.ownerId, {
      day: "2026-10-03",
      kind: "dry",
      familyId: site.familyId,
      timeZone: ZONE,
    })
  })

  it("Gruppen: laufend, kommend, vorbei", async () => {
    const list = await goalList(db, site.ownerId, ZONE, NOW)
    expect(list.running.map((g) => g.id).sort()).toEqual(
      [measured, series, process, withoutFamily].sort()
    )
    expect(list.upcoming.map((g) => g.id)).toEqual([upcoming])
    expect(list.past.map((g) => g.id)).toEqual([past])
  })

  it("misst Scheiben im Training ab 355 und Serien ab 90", async () => {
    const list = await goalList(db, site.ownerId, ZONE, NOW)
    const card = list.running.find((g) => g.id === measured)!
    expect(card.stand).toMatchObject({ counted: 3, hits: 2 })
    const bySeries = list.running.find((g) => g.id === series)!
    expect(bySeries.stand?.counted).toBe(16)
    expect(list.running.find((g) => g.id === process)!.stand).toBeNull()
  })

  it("Einträge im Zeitraum: der Disziplin, ohne Disziplin alle", async () => {
    const view = await goalView(db, site.ownerId, measured, ZONE, NOW)
    expect(view?.entryList.map((e) => e.day)).toEqual(["2026-10-03"])
    expect(view?.progressHref).toContain("/progress?")
    expect(view?.progressHref).toContain("kind=training")
    const none = await goalView(db, site.ownerId, withoutFamily, ZONE, NOW)
    expect(none).toMatchObject({ family: null, rule: null, stand: null, progressHref: null })
    expect(none?.entries).toBe(1)
  })

  it("Start: je Disziplin das zuletzt angelegte laufende Ziel mit Messung", async () => {
    const lines = await startGoals(db, site.ownerId, [familySlug], ZONE, NOW)
    expect(lines.get(familySlug)?.id).toBe(series)
    expect(await startGoals(db, site.ownerId, [], ZONE, NOW)).toEqual(new Map())
  })

  it("Vorgaben des Formulars: Wertung und Schusszahl der Disziplin", async () => {
    const families = await goalFormFamilies(db, site.ownerId, ZONE)
    expect(families.find((f) => f.family.id === site.familyId)).toMatchObject({
      scoring: "rings",
      shots: 40,
      seriesShots: 10,
    })
  })
})
