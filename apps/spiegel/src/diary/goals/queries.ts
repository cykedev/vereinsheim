// Was die Seiten der Ziele lesen: die Liste in Gruppen, ein Ziel mit Stand und Einträgen im Zeitraum, die Vorgaben des
// Formulars und die Zeile auf Start. Scheiben nur über `resultGoalCards` (die schmale Schnittstelle).

import { zonedDayStartMs } from "@vereinsheim/lib/format"
import { DEFAULT_PROGRESS, urlFromRoute } from "@vereinsheim/shot-ui/nav/routes"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { Db } from "@/lib/db"
import {
  resultFamilies,
  resultGoalCards,
  resultGoalDefaults,
  type GoalCard,
} from "@/lib/results-read"

import { diaryList, type EntrySummary, type Family } from "../queries"
import { dayOfDate } from "../validation"
import { measureGoal, type GoalRule, type GoalStand } from "./measure"
import { goalPhase, type GoalPhase } from "./season"
import { storedMeasure, type GoalData } from "./validation"

const DAY_MS = 86_400_000

const GOAL_SELECT = {
  id: true,
  title: true,
  note: true,
  kind: true,
  familyId: true,
  from: true,
  to: true,
  measure: true,
  threshold: true,
  scoring: true,
  shots: true,
  cards: true,
  outcome: true,
  createdAt: true,
} as const

type GoalRow = {
  id: string
  title: string
  note: string | null
  kind: "result" | "process"
  familyId: number | null
  from: Date
  to: Date
  measure: "card" | "series" | "average" | null
  threshold: { toString(): string } | null
  scoring: "rings" | "decimal" | null
  shots: number | null
  cards: "all" | "training" | "competition"
  outcome: "yes" | "partly" | "no" | null
  createdAt: Date
}

/** heute als Abend in der Anzeige-Zone (vor 4 Uhr der Vortag), wie die Scheiben zählen */
export const todayIn = (timeZone: string, nowMs = Date.now()) => eveningDay(nowMs, timeZone)

/** die Regel der Messung eines Ziels; null ohne Messung oder ohne Disziplin */
function ruleOf(row: GoalRow): GoalRule | null {
  const measure = storedMeasure(row)
  if (!measure || row.familyId === null || row.kind !== "result") return null
  return { ...measure, from: dayOfDate(row.from), to: dayOfDate(row.to) }
}

/** die Scheiben je Familie über die Zeiträume der Ziele, eine Abfrage je Familie */
async function cardsByFamily(
  db: Db,
  userId: string,
  rows: readonly GoalRow[],
  timeZone: string
): Promise<Map<number, GoalCard[]>> {
  const ranges = new Map<number, { from: string; to: string }>()
  for (const row of rows) {
    if (!ruleOf(row)) continue
    const range = { from: dayOfDate(row.from), to: dayOfDate(row.to) }
    const known = ranges.get(row.familyId!)
    ranges.set(
      row.familyId!,
      known
        ? {
            from: range.from < known.from ? range.from : known.from,
            to: range.to > known.to ? range.to : known.to,
          }
        : range
    )
  }
  const out = new Map<number, GoalCard[]>()
  for (const [familyId, range] of ranges) {
    const cards = await resultGoalCards(db, {
      ownerId: userId,
      familyId,
      // ein Tag mehr an beiden Enden: Der Abend zählt nach seinem Tag, ein Beginn kurz nach Mitternacht gehört davor
      fromMs: zonedDayStartMs(range.from, timeZone) - DAY_MS,
      toMs: zonedDayStartMs(range.to, timeZone) + 2 * DAY_MS,
      timeZone,
    })
    out.set(familyId, cards)
  }
  return out
}

export interface GoalSummary {
  id: string
  title: string
  kind: "result" | "process"
  family: Family | null
  from: string
  to: string
  phase: GoalPhase
  outcome: "yes" | "partly" | "no" | null
  rule: GoalRule | null
  stand: GoalStand | null
  /** Einträge der Disziplin im Zeitraum (bei einem Ziel ohne Disziplin alle) */
  entries: number
}

const inPeriod = (entry: { day: string; family: Family | null }, goal: GoalRow) =>
  entry.day >= dayOfDate(goal.from) &&
  entry.day <= dayOfDate(goal.to) &&
  (goal.familyId === null || entry.family?.id === goal.familyId)

/** die Ziele, die nicht im Papierkorb liegen, mit Stand */
export async function goalList(
  db: Db,
  userId: string,
  timeZone: string,
  nowMs = Date.now()
): Promise<{ running: GoalSummary[]; upcoming: GoalSummary[]; past: GoalSummary[] }> {
  const today = todayIn(timeZone, nowMs)
  const [rows, families, entries] = await Promise.all([
    db.diaryGoal.findMany({ where: { userId, deletedAt: null }, select: GOAL_SELECT }),
    resultFamilies(db, userId),
    diaryList(db, userId, timeZone),
  ])
  const familyOf = new Map(families.map((family) => [family.id, family]))
  const cards = await cardsByFamily(db, userId, rows, timeZone)
  const summaries = rows.map((row): GoalSummary => {
    const rule = ruleOf(row)
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      family: row.familyId === null ? null : (familyOf.get(row.familyId) ?? null),
      from: dayOfDate(row.from),
      to: dayOfDate(row.to),
      phase: goalPhase({ from: dayOfDate(row.from), to: dayOfDate(row.to) }, today),
      outcome: row.outcome,
      rule,
      stand: rule ? measureGoal(rule, cards.get(row.familyId!) ?? []) : null,
      entries: entries.filter((entry) => inPeriod(entry, row)).length,
    }
  })
  return {
    running: summaries
      .filter((goal) => goal.phase.phase === "running")
      .sort((a, b) => a.to.localeCompare(b.to)),
    upcoming: summaries
      .filter((goal) => goal.phase.phase === "upcoming")
      .sort((a, b) => a.from.localeCompare(b.from)),
    past: summaries
      .filter((goal) => goal.phase.phase === "past")
      .sort((a, b) => b.to.localeCompare(a.to)),
  }
}

export interface GoalView extends GoalSummary {
  note: string | null
  entryList: EntrySummary[]
  /** der Fortschritt mit Zeitraum, Disziplin und Art des Ziels; null ohne Disziplin */
  progressHref: string | null
}

/** ein eigenes Ziel, das nicht im Papierkorb liegt; sonst null */
export async function goalView(
  db: Db,
  userId: string,
  goalId: string,
  timeZone: string,
  nowMs = Date.now()
): Promise<GoalView | null> {
  const row = await db.diaryGoal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: GOAL_SELECT,
  })
  if (!row) return null
  const today = todayIn(timeZone, nowMs)
  const [families, entries, cards] = await Promise.all([
    resultFamilies(db, userId),
    diaryList(db, userId, timeZone),
    cardsByFamily(db, userId, [row], timeZone),
  ])
  const family =
    row.familyId === null ? null : (families.find((f) => f.id === row.familyId) ?? null)
  const rule = ruleOf(row)
  const from = dayOfDate(row.from)
  const to = dayOfDate(row.to)
  const entryList = entries.filter((entry) => inPeriod(entry, row))
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    family,
    from,
    to,
    phase: goalPhase({ from, to }, today),
    outcome: row.outcome,
    rule,
    stand: rule ? measureGoal(rule, cards.get(row.familyId!) ?? []) : null,
    entries: entryList.length,
    note: row.note,
    entryList,
    progressHref: family
      ? urlFromRoute({
          page: "progress",
          section: null,
          query: {
            ...DEFAULT_PROGRESS,
            family: family.slug,
            kind: row.kind === "result" && rule ? rule.cards : "all",
            choice: { type: "free", from, to: today < to ? (today < from ? from : today) : to },
          },
        })
      : null,
  }
}

/** ein Ziel zum Ändern, wie das Formular es braucht; null, wenn es fehlt */
export async function goalForEdit(
  db: Db,
  userId: string,
  goalId: string
): Promise<(GoalData & { id: string }) | null> {
  const row = await db.diaryGoal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: GOAL_SELECT,
  })
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    familyId: row.familyId,
    from: dayOfDate(row.from),
    to: dayOfDate(row.to),
    measure: storedMeasure(row),
  }
}

/** Vorgaben des Formulars je Disziplin: Wertung und die häufigsten Schusszahlen ihrer Scheiben */
export interface FamilyDefaults {
  family: Family
  scoring: "rings" | "decimal"
  shots: number
  seriesShots: number
}

/**
 * die Disziplinen zur Wahl mit ihren Vorgaben, die der neuesten eigenen Scheibe zuerst; ohne eigene Scheiben die
 * Vorgaben 40 und 10 Schuss in Zehnteln
 */
export async function goalFormFamilies(
  db: Db,
  userId: string,
  timeZone: string
): Promise<FamilyDefaults[]> {
  const [families, defaults] = await Promise.all([
    resultFamilies(db, userId),
    resultGoalDefaults(db, userId, timeZone),
  ])
  const byFamily = new Map(defaults.map((d) => [d.familyId, d]))
  return families
    .map((family) => {
      const d = byFamily.get(family.id)
      return {
        defaults: {
          family,
          scoring: d?.scoring ?? ("decimal" as const),
          shots: d?.usualShots ?? 40,
          seriesShots: d?.usualSeriesShots ?? 10,
        },
        latest: d?.latestMs ?? 0,
      }
    })
    .sort(
      (a, b) => b.latest - a.latest || a.defaults.family.name.localeCompare(b.defaults.family.name)
    )
    .map((item) => item.defaults)
}

/** was eine Messung mit den Scheiben im Zeitraum ergäbe (die Vorschau im Formular) */
export async function goalPreview(
  db: Db,
  userId: string,
  familyId: number,
  rule: GoalRule,
  timeZone: string
): Promise<GoalStand> {
  const cards = await resultGoalCards(db, {
    ownerId: userId,
    familyId,
    fromMs: zonedDayStartMs(rule.from, timeZone) - DAY_MS,
    toMs: zonedDayStartMs(rule.to, timeZone) + 2 * DAY_MS,
    timeZone,
  })
  return measureGoal(rule, cards)
}

/**
 * Je Familie das zuletzt angelegte laufende Ziel mit Messung und sein Stand (die Zeile auf Start); Schlüssel ist die
 * Kennung der Familie in der Adresse
 */
export async function startGoals(
  db: Db,
  userId: string,
  familySlugs: readonly string[],
  timeZone: string,
  nowMs = Date.now()
): Promise<Map<string, { id: string; rule: GoalRule; stand: GoalStand }>> {
  const out = new Map<string, { id: string; rule: GoalRule; stand: GoalStand }>()
  if (!familySlugs.length) return out
  const today = dateOfToday(timeZone, nowMs)
  const [rows, families] = await Promise.all([
    db.diaryGoal.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: "result",
        measure: { not: null },
        familyId: { not: null },
        from: { lte: today },
        to: { gte: today },
      },
      orderBy: { createdAt: "desc" },
      select: GOAL_SELECT,
    }),
    resultFamilies(db, userId),
  ])
  const slugOf = new Map(families.map((family) => [family.id, family.slug]))
  const latest = new Map<number, GoalRow>()
  for (const row of rows) {
    const slug = slugOf.get(row.familyId!)
    if (!slug || !familySlugs.includes(slug) || latest.has(row.familyId!) || !ruleOf(row)) continue
    latest.set(row.familyId!, row)
  }
  const cards = await cardsByFamily(db, userId, [...latest.values()], timeZone)
  for (const [familyId, row] of latest) {
    const rule = ruleOf(row)!
    out.set(slugOf.get(familyId)!, {
      id: row.id,
      rule,
      stand: measureGoal(rule, cards.get(familyId) ?? []),
    })
  }
  return out
}

const dateOfToday = (timeZone: string, nowMs: number) =>
  new Date(`${todayIn(timeZone, nowMs)}T00:00:00.000Z`)
