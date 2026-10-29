// Die schmale Schnittstelle des Ergebnisteils für andere Teile (das Tagebuch, [[adr-033]]): nur lesend, nur eigene,
// sichtbare Scheiben, nur was ein anderer Teil von einer Scheibe braucht. Der Ergebnisteil kennt keinen Leser davon.

import { seriesCurve } from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import type { CardMark, CardProjection, ProjectedSeries } from "@vereinsheim/shot-core/projection"
import { modalLength } from "@vereinsheim/shot-core/stats"
import type { TargetId } from "@vereinsheim/shot-core/targets"
import type { CardProvenance } from "@vereinsheim/shot-ui/detail"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"
import { byStart } from "@vereinsheim/shot-ui/period/item"
import { markWarmup } from "@vereinsheim/shot-ui/period/warmup"
import { shownShots } from "@vereinsheim/shot-ui/shots"

import type { Db } from "@/lib/db"
import {
  cardWithShots,
  familyCards,
  marksOfCards,
  seriesOfCards,
  type OverviewCard,
} from "@/lib/db/reads"
import { overviewCards } from "@/lib/overview"
import { listable, withFamily } from "@/lib/pages"

/** ein Wert in einer Wertung mit den Stellen, in denen ihn die Liste zeigt */
export interface ResultValue {
  value: number
  scoring: Scoring
  digits: number
}

/** eine eigene Scheibe, wie sie ein anderer Teil sieht */
export interface ResultCard {
  id: string
  /** der Abend (ISO-Tag, vor 4 Uhr der Vortag) */
  day: string
  startedAtMs: number
  timeUnknown: boolean
  family: { id: number; slug: string; name: string } | null
  targetId: TargetId | null
  kind: OverviewCard["kind"]
  probeOnly: boolean
  /** Einschießen: nur Probe vor einer Wertung ihres Abends in ihrer Familie (`markWarmup`); zählt nicht */
  warmup: boolean
  provenance: CardProvenance
  /** das Ergebnis wie vorn in der Liste der Scheiben; null ohne Wert */
  result: ResultValue | null
  /** Wertungsschüsse, bei nur Probe die Probe */
  shots: number
  /** Gesamtergebnis in ganzen Ringen und in Zehnteln (Zehntel × 10); null, wo die Scheibe es nicht hat */
  totals: CardTotals
  /** der Schlüssel der Übernahme, null ohne */
  importKey: string | null
}

/** das Gesamtergebnis einer Scheibe in beiden Wertungen, unabhängig von der Wertung ihrer Familie */
export interface CardTotals {
  rings: number | null
  decimalTenths: number | null
}

/**
 * Das Gesamtergebnis aus der Projektion, auf demselben Weg wie die Spalte Ergebnis der Liste (`result.decimal` in der
 * Wertung): ganze Ringe, Zehntel als ganze Zahl; null, wo die Projektion keinen Wert hat
 */
export function cardTotals(projection: Pick<CardProjection, "values">): CardTotals {
  const result = metricByKey("result.decimal") as MetricDefinition
  const value = (scoring: Scoring) =>
    projection.values[inScoring(result, scoring).key]?.value ?? null
  const rings = value("rings")
  const decimal = value("decimal")
  return {
    rings: rings === null ? null : Math.round(rings),
    decimalTenths: decimal === null ? null : Math.round(decimal * 10),
  }
}

/**
 * Die eigenen, sichtbaren Scheiben (wie in Liste und Start), mit `ids` nur diese, mit `fromMs`/`toMs` nur die mit
 * Beginn in diesem Zeitraum. Das Ergebnis rechnet das Modell der Liste je Familie in der Wertung der Familie, damit es
 * dasselbe ist wie in der Liste. Fremde, wartende und gelöschte Scheiben fehlen.
 */
export async function resultCards(
  db: Db,
  query: {
    ownerId: string
    timeZone: string
    ids?: readonly string[]
    fromMs?: number
    toMs?: number
  }
): Promise<ResultCard[]> {
  const { shown, scoringOf } = await overviewCards(db, query.ownerId, query.timeZone)
  const wanted = query.ids ? new Set(query.ids) : null
  const cards = shown.filter(
    (card) =>
      (!wanted || wanted.has(card.id)) &&
      (query.fromMs === undefined || card.startedAtMs >= query.fromMs) &&
      (query.toMs === undefined || card.startedAtMs < query.toMs)
  )
  const input = withFamily(listable(shown))
  const results = new Map<
    string,
    { row: { result: number | null; resultScoring: Scoring }; digits: number }
  >()
  for (const family of new Set(cards.flatMap((card) => (card.family ? [card.family.slug] : [])))) {
    const model = cardListModel(
      input,
      { ...DEFAULT_LIST, family },
      { timeZone: query.timeZone, nowMs: Date.now(), named: [], scoring: scoringOf(family) }
    )
    for (const evening of model.evenings)
      for (const row of evening.rows)
        results.set(row.id, { row, digits: model.digits.result[row.resultScoring] })
  }
  return cards.map((card) => {
    const listed = results.get(card.id)
    return {
      id: card.id,
      day: eveningDay(card.startedAtMs, query.timeZone),
      startedAtMs: card.startedAtMs,
      timeUnknown: card.timeUnknown === true,
      family:
        card.family && card.familyId !== null
          ? { id: card.familyId, slug: card.family.slug, name: card.family.name }
          : null,
      targetId: card.targetId,
      kind: card.kind,
      probeOnly: card.projection.probeOnly,
      warmup: card.warmup === true,
      provenance: card.provenance,
      result:
        listed && listed.row.result !== null
          ? { value: listed.row.result, scoring: listed.row.resultScoring, digits: listed.digits }
          : null,
      shots: card.projection.printedShots,
      totals: cardTotals(card.projection),
      importKey: card.importKey,
    }
  })
}

/** eine Serie einer Scheibe: Nummer, Schusszahl und Summe in der Wertung der Scheibe */
export interface ResultSeries {
  series: number
  shots: number
  result: ResultValue | null
}

/**
 * Die Serien einer eigenen Scheibe wie unter ihrer Scheibe: aus den Schüssen (wie am Ausdruck), ohne Schüsse aus den
 * Serien-Summen; ohne Serien leer, ohne Scheibe (fremd, wartend, gelöscht) null.
 */
export async function resultCardSeries(
  db: Db,
  query: { ownerId: string; cardId: string }
): Promise<ResultSeries[] | null> {
  const card = await cardWithShots(db, query)
  if (!card) return null
  const scoring = card.scoring
  const digits = scoring === "rings" ? 0 : 1
  const fromShots = seriesCurve(shownShots(card), scoring)
  if (fromShots.length)
    return fromShots.map((point) => ({
      series: point.series,
      shots: point.shots,
      result: point.total === null ? null : { value: point.total, scoring, digits },
    }))
  return (card.sums?.series ?? []).map((sum) => {
    const value =
      scoring === "rings" ? sum.rings : sum.decimalTenths === null ? null : sum.decimalTenths / 10
    return {
      series: sum.series,
      shots: sum.shots,
      result: value === null ? null : { value, scoring, digits },
    }
  })
}

/** eine eigene Scheibe einer Familie, wie ein Ziel sie zählt: Ergebnis und Serien in beiden Wertungen */
export interface GoalCard {
  id: string
  /** der Abend (ISO-Tag, vor 4 Uhr der Vortag) */
  day: string
  startedAtMs: number
  kind: OverviewCard["kind"]
  /** Einschießen (`markWarmup`): zählt für kein Ziel */
  warmup: boolean
  /** Schüsse wie am Ausdruck */
  shots: number
  rings: number | null
  decimal: number | null
  /** null, solange die Projektion älter als Version 7 ist und noch nachgerechnet wird */
  series: ProjectedSeries[] | null
}

/**
 * Die sichtbaren eigenen Scheiben einer Familie mit Beginn im Zeitraum, aus der Projektion (ohne Schüsse) über den Index
 * je Familie; die Serien in einer eigenen Abfrage, nur für diese Scheiben. Das Einschießen gilt je Abend in `timeZone`
 * über die gelesenen Scheiben: Der Zeitraum muss die Abende, die zählen, ganz enthalten.
 */
export async function resultGoalCards(
  db: Db,
  query: { ownerId: string; familyId: number; fromMs: number; toMs: number; timeZone: string }
): Promise<GoalCard[]> {
  const cards = markWarmup(
    listable(
      await familyCards(db, {
        ownerId: query.ownerId,
        familyId: query.familyId,
        fromMs: query.fromMs,
        toMs: query.toMs,
      })
    ),
    { timeZone: query.timeZone, familyOf: (card) => card.family?.slug ?? null }
  )
  const series = await seriesOfCards(db, {
    ownerId: query.ownerId,
    ids: cards.map((card) => card.id),
  })
  return cards.map((card) => ({
    id: card.id,
    day: eveningDay(card.startedAtMs, query.timeZone),
    startedAtMs: card.startedAtMs,
    kind: card.kind,
    warmup: card.warmup === true,
    shots: card.projection.printedShots,
    rings: card.projection.values["result.rings"]?.value ?? null,
    decimal: card.projection.values["result.decimal"]?.value ?? null,
    series: series[card.id] ?? null,
  }))
}

/** eine eigene Scheibe einer Familie, wie die Auswertung des Tagebuchs sie braucht; Werte in der Wertung der Familie */
export interface FormCard {
  id: string
  /** der Abend (ISO-Tag, vor 4 Uhr der Vortag) */
  day: string
  startedAtMs: number
  kind: OverviewCard["kind"]
  /** Einschießen (`markWarmup`): zählt in der Auswertung nicht */
  warmup: boolean
  /** Ø je Schuss (`result.decimalMean` bzw. `result.ringsMean`) mit Schusszahl und Streuung der Schusswerte; null ohne */
  mean: { value: number; n: number; sd?: number | null } | null
  /** die Serien der Projektion mit Ø je Schuss in der Wertung der Familie; null vor Projektion 7 */
  series: { series: number; shots: number; mean: number | null }[] | null
}

/**
 * Alle sichtbaren eigenen Scheiben einer Familie in zeitlicher Folge (bei gleichem Beginn nach Kennung) und die
 * Wertung der Familie. Der Ø je Schuss kommt aus der Projektion, bei „nur Probe“ über die Probe; `warmup` markiert das
 * Einschießen im Abend in `timeZone`.
 */
export async function resultFormCards(
  db: Db,
  query: { ownerId: string; familyId: number; timeZone: string }
): Promise<{ scoring: Scoring; cards: FormCard[] }> {
  const { shown, scoringOf } = await overviewCards(db, query.ownerId, query.timeZone)
  const cards = shown.filter((card) => card.familyId === query.familyId).sort(byStart)
  const slug = cards[0]?.family?.slug
  const scoring: Scoring = slug ? scoringOf(slug) : "decimal"
  const key = inScoring(metricByKey("result.decimalMean") as MetricDefinition, scoring).key
  const series = await seriesOfCards(db, {
    ownerId: query.ownerId,
    ids: cards.map((card) => card.id),
  })
  return {
    scoring,
    cards: cards.map((card) => {
      const entry = card.projection.values[key]
      const mean: FormCard["mean"] = entry ? { value: entry.value, n: entry.n } : null
      if (mean && entry.sd !== undefined) mean.sd = entry.sd
      return {
        id: card.id,
        day: eveningDay(card.startedAtMs, query.timeZone),
        startedAtMs: card.startedAtMs,
        kind: card.kind,
        warmup: card.warmup === true,
        mean,
        series:
          series[card.id]?.map((s) => {
            const total = scoring === "rings" ? s.rings : s.decimal
            return {
              series: s.series,
              shots: s.shots,
              mean: total === null || !s.shots ? null : total / s.shots,
            }
          }) ?? null,
      }
    }),
  }
}

/** was ein neues Ziel je Familie vorbelegt: Wertung, häufigste Schusszahl je Scheibe und je Serie, neueste Scheibe */
export interface GoalDefaults {
  familyId: number
  scoring: Scoring
  usualShots: number | null
  usualSeriesShots: number | null
  latestMs: number
}

/**
 * die Vorgaben eines Ziels für jede Familie mit eigenen Scheiben, in einem Durchgang; Schusszahlen aus den Scheiben, die
 * ein Ziel zählt (ohne Einschießen, Abend in `timeZone`)
 */
export async function resultGoalDefaults(
  db: Db,
  ownerId: string,
  timeZone: string
): Promise<GoalDefaults[]> {
  const { shown, scoringOf } = await overviewCards(db, ownerId, timeZone)
  const series = await seriesOfCards(db, {
    ownerId,
    ids: shown.filter((card) => !card.warmup).map((card) => card.id),
  })
  const byFamily = new Map<number, OverviewCard[]>()
  for (const card of shown)
    if (card.familyId !== null && card.family)
      byFamily.set(card.familyId, [...(byFamily.get(card.familyId) ?? []), card])
  return [...byFamily].map(([familyId, cards]) => {
    const counted = cards.filter((card) => !card.warmup)
    return {
      familyId,
      scoring: scoringOf(cards[0].family!.slug),
      usualShots: modalLength(
        counted.map((card) => card.projection.printedShots).filter((shots) => shots > 0)
      ),
      usualSeriesShots: modalLength(
        counted.flatMap((card) => (series[card.id] ?? []).map((s) => s.shots))
      ),
      latestMs: Math.max(...cards.map((card) => card.startedAtMs)),
    }
  })
}

/** die Lagen der kleinen Scheiben (`MiniTarget`), nur eigene, sichtbare Scheiben */
export function resultMarks(
  db: Db,
  query: { ownerId: string; ids: readonly string[] }
): Promise<Record<string, CardMark[]>> {
  return marksOfCards(db, query)
}

/**
 * Die Familien, die ein anderer Teil anbieten kann: die der eingeordneten, nicht ignorierten Disziplinen und die der
 * eigenen Scheiben, nach Name
 */
export async function resultFamilies(
  db: Db,
  ownerId: string
): Promise<{ id: number; slug: string; name: string }[]> {
  return db.family.findMany({
    where: {
      OR: [
        { disciplines: { some: { confirmedAt: { not: null }, ignoredAt: null } } },
        { cards: { some: { ownerId } } },
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  })
}
