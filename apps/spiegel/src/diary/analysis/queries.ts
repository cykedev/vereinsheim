// Was die Auswertung im Tagebuch liest: eigene Einträge einer Disziplin, ihre Scheiben über `entryCards` und die
// Scheiben der Familie über `resultFormCards` (die Form zählt über alle, auch vor dem Zeitraum). Nur lesend.

import type { Db } from "@/lib/db"
import { resultCards, resultFamilies, resultFormCards, type ResultCard } from "@/lib/results-read"

import { entryCards, type CardLinkRow, type EntryRef } from "../cards"
import { seasonOf, type Season } from "../goals/season"
import type { Family } from "../queries"
import { SCALE_ASPECTS, type ScaleAspect, type ScalePart } from "../scales"
import { dayOfDate } from "../validation"

import { executionCheck, type ExecutionResult, type RatedCard } from "./execution"
import { countedCards, entryValue, formBefore, formDistance } from "./form"
import {
  influenceRows,
  type InfluenceInput,
  type InfluenceRow,
  type WellbeingAspect,
} from "./influences"
import { beforeAfter, expectedRows } from "./self-image"

export type { WellbeingAspect } from "./influences"

export interface AnalysisView {
  /** Disziplinen mit Einträgen, die mit dem jüngsten Eintrag zuerst */
  families: Family[]
  family: Family | null
  /** Saisons mit Einträgen der Disziplin, neueste zuerst; `season` null heißt „Alles“ */
  seasons: Season[]
  season: Season | null
  influences: {
    /** Einträge mit Befinden im Zeitraum */
    withWellbeing: number
    rows: InfluenceRow[]
    /** mit Befinden, die nicht zählen */
    left: { noCard: number; noForm: number }
  }
  execution: ExecutionResult & { rated: number }
  expected: ReturnType<typeof expectedRows>
  beforeAfter: ReturnType<typeof beforeAfter>
}

export interface FactorView {
  family: Family
  season: Season | null
  aspect: WellbeingAspect
  row: InfluenceRow
  left: { noCard: number; noForm: number }
}

/** die Startjahre der Saison als Wert in der Adresse (`?season=2025`) */
export const seasonKey = (season: Season) => season.from.slice(0, 4)

const WELLBEING: readonly string[] = SCALE_ASPECTS.wellbeing

/** alles, was die Auswertung einer Disziplin und eines Zeitraums rechnet */
async function analysis(
  db: Db,
  userId: string,
  query: { family: string | null; season: string | null },
  timeZone: string
): Promise<AnalysisView> {
  const [rows, families, links, refs, cards] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, deletedAt: null, familyId: { not: null } },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        day: true,
        kind: true,
        familyId: true,
        expectedScore: true,
        scales: { select: { part: true, aspect: true, value: true } },
        executions: { select: { cardId: true, series: true, value: true } },
      },
    }),
    resultFamilies(db, userId),
    db.diaryEntryCard.findMany({
      where: { entry: { userId } },
      select: { cardId: true, entryId: true, link: true },
    }),
    db.diaryEntry.findMany({
      where: { userId },
      select: { id: true, day: true, familyId: true, deletedAt: true },
    }),
    resultCards(db, { ownerId: userId, timeZone }),
  ])
  const byId = new Map(families.map((family) => [family.id, family]))
  const chips: Family[] = []
  for (const row of rows) {
    const family = byId.get(row.familyId!)
    if (family && !chips.some((f) => f.id === family.id)) chips.push(family)
  }
  const family = chips.find((f) => f.slug === query.family) ?? chips[0] ?? null
  const ofFamily = family ? rows.filter((row) => row.familyId === family.id) : []
  const seasons: Season[] = []
  for (const row of ofFamily) {
    const season = seasonOf(dayOfDate(row.day))
    if (!seasons.some((s) => s.from === season.from)) seasons.push(season)
  }
  const season = seasons.find((s) => seasonKey(s) === query.season) ?? null
  const inPeriod = ofFamily
    .map((row) => ({ ...row, day: dayOfDate(row.day) }))
    .filter((row) => !season || (row.day >= season.from && row.day <= season.to))

  const entries: EntryRef[] = refs.map((ref) => ({
    id: ref.id,
    day: dayOfDate(ref.day),
    familyId: ref.familyId,
    deleted: ref.deletedAt !== null,
  }))
  const sets = entryCards(
    entries,
    links as CardLinkRow[],
    cards.map((card) => ({ id: card.id, day: card.day, familyId: card.family?.id ?? null }))
  )
  const ownIds = (entryId: string) => {
    const set = sets.get(entryId)
    return set ? [...set.linked, ...set.added] : []
  }
  const resultOf = new Map(cards.map((card) => [card.id, card]))

  const { scoring, cards: formCards } = family
    ? await resultFormCards(db, { ownerId: userId, familyId: family.id, timeZone })
    : { scoring: "decimal" as const, cards: [] }
  const counted = countedCards(formCards)
  const countedOf = new Map(counted.map((card) => [card.id, card]))

  const inputs: InfluenceInput[] = []
  const left = { noCard: 0, noForm: 0 }
  let withWellbeing = 0
  const rated: RatedCard[] = []
  let ratedSeries = 0
  for (const row of inPeriod) {
    if (row.kind !== "shooting") continue
    const own = ownIds(row.id).flatMap((id) => countedOf.get(id) ?? [])
    const wellbeing: Partial<Record<WellbeingAspect, number>> = {}
    for (const scale of row.scales)
      if (scale.part === "wellbeing" && WELLBEING.includes(scale.aspect))
        wellbeing[scale.aspect as WellbeingAspect] = scale.value
    if (Object.keys(wellbeing).length) {
      withWellbeing += 1
      const value = entryValue(own, scoring)
      const form = value && formBefore(counted, row.day, scoring)
      if (!value) left.noCard += 1
      else if (form === null || form === undefined) left.noForm += 1
      else {
        const first = own.find((card) => card.mean) ?? own[0]
        inputs.push({
          entryId: row.id,
          day: row.day,
          competition: own.some((card) => card.kind === "competition"),
          distance: formDistance({ id: row.id, startedAtMs: first.startedAtMs }, value, form),
          wellbeing,
        })
      }
    }
    ratedSeries += row.executions.length
    for (const card of own) {
      const executions = row.executions.filter((e) => e.cardId === card.id)
      if (!executions.length || !card.series) continue
      rated.push({
        entryId: row.id,
        day: row.day,
        cardId: card.id,
        series: card.series,
        ratings: new Map(executions.map((e) => [e.series, e.value])),
      })
    }
  }

  const ownResults = (entryId: string): ResultCard[] =>
    ownIds(entryId).flatMap((id) => resultOf.get(id) ?? [])
  return {
    families: chips,
    family,
    seasons,
    season,
    influences: { withWellbeing, rows: influenceRows(inputs), left },
    execution: { ...executionCheck(rated), rated: ratedSeries },
    expected: expectedRows(
      inPeriod.map((row) => ({
        id: row.id,
        day: row.day,
        expectedScore: row.expectedScore === null ? null : Number(row.expectedScore),
        cards: ownResults(row.id),
      }))
    ),
    beforeAfter: beforeAfter(
      inPeriod.map((row) => ({
        scales: row.scales.map((s) => ({
          part: s.part as ScalePart,
          aspect: s.aspect as ScaleAspect,
          value: s.value,
        })),
      }))
    ),
  }
}

/**
 * Die Auswertung: Disziplinen mit Einträgen (unbekannte → die erste), Saisons der Disziplin (unbekannte → „Alles“),
 * Einflüsse und Ausführung über die Einträge mit Scheiben, Selbstbild über alle Arten
 */
export function analysisView(
  db: Db,
  userId: string,
  query: { family: string | null; season: string | null },
  timeZone: string
): Promise<AnalysisView> {
  return analysis(db, userId, query, timeZone)
}

/** die Seite eines Merkmals; null ohne Disziplin mit Einträgen */
export async function factorView(
  db: Db,
  userId: string,
  query: { aspect: WellbeingAspect; family: string | null; season: string | null },
  timeZone: string
): Promise<FactorView | null> {
  const view = await analysis(db, userId, query, timeZone)
  if (!view.family) return null
  return {
    family: view.family,
    season: view.season,
    aspect: query.aspect,
    row: view.influences.rows.find((row) => row.aspect === query.aspect)!,
    left: view.influences.left,
  }
}
