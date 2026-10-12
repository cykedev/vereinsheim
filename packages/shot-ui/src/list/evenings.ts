// Abende der Scheiben-Liste (Plan N2, `vault/spiegel/spiegel-navigation.md`): reine Funktionen. Ein Abend ist Konto
// und Tag in der Anzeige-Zeitzone, eine Scheibe vor 4 Uhr zählt zum Vortag (D1). Alle Scheiben eines Abends stehen
// gleichberechtigt in zeitlicher Folge, die Abende neueste zuerst (D2); die Familie ist Pflicht, andere Familien des
// Abends nennt der Kopf (D3). Zahlen nur aus dem Fachkern, aus der Projektion jeder Scheibe (ADR-031, SP-1.8).

import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { projectedValues, type ProjectedCard } from "@vereinsheim/shot-core/projection"
import { formatIsoDate, formatTimeOfDay, zonedDayStartMs } from "@vereinsheim/lib/format"

import type { ListQuery } from "../nav/routes"
import { inRange, resolveRange, type DateRange, type NamedPeriod } from "../period/calendar"
import { byStart, cardKind, deltasBefore, isProbeOnly, type CardKind } from "../period/model"

/** eine Scheibe mit Projektion und ihrer Familie (die Liste filtert nach ihr) */
export interface ListInputCard {
  card: ProjectedCard
  family: string
}

/** der Wert einer Kennzahl der Scheibe in der Wertung aus ihrer Projektion; null ohne Wert */
const projected = (card: ProjectedCard, metric: Readonly<MetricDefinition>, scoring: Scoring) =>
  card.projection.values[inScoring(metric, scoring).key]?.value ?? null

export interface ListRow {
  id: string
  startedAtMs: number
  /** Training, Wettkampf oder Training nur aus Probe */
  kind: CardKind
  /**
   * Ergebnis in der Wertung, die vorn steht: der Wertung der Scheibe (`ProjectedCard.scoring`), ohne sie (Labor) der
   * amtlichen, ohne beide der Wertung der Liste; nur Probe rechnet wie Wertung und ist nie amtlich. null ohne Wert
   */
  result: number | null
  resultScoring: Scoring
  /** die vordere Wertung ist die der Scheibe (fett) */
  ofCard: boolean
  /** Ergebnis in der anderen Wertung, klein daneben */
  otherResult: number | null
  /** Ø je Schuss in der Wertung der Liste (eine für alle Zeilen, damit die Spalte vergleichbar bleibt) */
  mean: number | null
  /** Abstand zum Schnitt der bis zu fünf Scheiben davor (Familie und Art), im Ø je Schuss; null bei der ersten */
  delta: { delta: number; n: number } | null
  /** Wertungsschüsse, bei nur Probe die Probe */
  shots: number
}

export interface Evening {
  /** ISO-Tag, zugleich der Anker */
  day: string
  rows: ListRow[]
  shots: number
  /** Scheiben anderer Familien an diesem Abend */
  others: { family: string; count: number }[]
}

export interface CardListModel {
  /** die gezeigte Familie; null nur ohne Scheiben */
  family: string | null
  evenings: Evening[]
  /** Merkmale der Scheiben dieser Familie, für den Filter */
  flags: string[]
  /** gezeigte Scheiben */
  cards: number
  /** Wertung der Liste (in der App die der Familie): Ø und Abstand, vorn beim Ergebnis ohne Wertung der Scheibe */
  scoring: Scoring
  /** Stellen aus den Kennzahlen: Ergebnis je Wertung, Ø in der Wertung der Liste; der Abstand hat die des Ø */
  digits: { result: Record<Scoring, number>; mean: number }
  /** der Zeitraum aus „Alle in Scheiben zeigen“; null: alle Abende */
  range: DateRange | null
}

/**
 * Der letzte Abend: der Abend der neuesten Scheibe mit allen seinen Scheiben, über alle Familien, in zeitlicher
 * Folge; null ohne Scheiben. Eine Stelle für Start und das Blättern von Start (Review N5).
 */
export function lastEvening(
  input: readonly ListInputCard[],
  timeZone: string
): { day: string; cards: ListInputCard[] } | null {
  const sorted = [...input].sort((a, b) => byStart(a.card, b.card))
  const newest = sorted.at(-1)
  if (!newest) return null
  const day = eveningDay(newest.card.startedAtMs, timeZone)
  return { day, cards: sorted.filter((c) => eveningDay(c.card.startedAtMs, timeZone) === day) }
}

/** ein Monat der Liste: seine Abende, neueste zuerst, mit Zahl der Scheiben und der Wertungsschüsse */
export interface Month {
  /** JJJJ-MM */
  month: string
  evenings: Evening[]
  cards: number
  shots: number
}

/** die Abende nach Monat, in ihrer Folge (neueste zuerst); der Monat ist der des Abends */
export function eveningsByMonth(evenings: readonly Evening[]): Month[] {
  const months: Month[] = []
  for (const evening of evenings) {
    const month = evening.day.slice(0, 7)
    let current = months.at(-1)
    if (current?.month !== month) {
      current = { month, evenings: [], cards: 0, shots: 0 }
      months.push(current)
    }
    current.evenings.push(evening)
    current.cards += evening.rows.length
    current.shots += evening.shots
  }
  return months
}

export interface CardListContext {
  timeZone: string
  nowMs: number
  named: readonly NamedPeriod[]
  scoring: Scoring
}

/** Training bis 4 Uhr nachts gehört zum Abend davor (D1) */
const EVENING_STARTS = "04:00"

/**
 * der Abend einer Scheibe als ISO-Tag in der Zone; vor 4 Uhr der Vortag. Es zählt die Uhrzeit der Zone, nicht vier
 * Stunden absolut: an den Tagen der Zeitumstellung hat die Nacht 23 oder 25 Stunden (Review N2).
 */
export function eveningDay(startedAtMs: number, timeZone: string): string {
  const at = new Date(startedAtMs)
  const day = formatIsoDate(at, timeZone)
  if (formatTimeOfDay(at, timeZone) >= EVENING_STARTS) return day
  return formatIsoDate(new Date(zonedDayStartMs(day, timeZone) - 1), timeZone)
}

export function cardListModel(
  input: readonly ListInputCard[],
  query: ListQuery,
  context: CardListContext
): CardListModel {
  const family = query.family ?? input[0]?.family ?? null
  const ofFamily = input.filter((c) => c.family === family).map((c) => c.card)
  const ofKind = ofFamily
    .filter((card) => query.kind === "all" || card.kind === query.kind)
    .sort(byStart)
  const range = query.range
    ? resolveRange(query.range, {
        ...context,
        firstMs: ofFamily.length ? Math.min(...ofFamily.map((c) => c.startedAtMs)) : null,
      })
    : null
  const shown = ofKind.filter(
    (card) =>
      (!query.flag || card.flags.includes(query.flag)) &&
      (!range || inRange(card.startedAtMs, range))
  )

  const resultMetric = (scoring: Scoring) => inScoring(metricByKey("result.decimal")!, scoring)
  const other = (scoring: Scoring): Scoring => (scoring === "rings" ? "decimal" : "rings")
  const meanMetric = inScoring(metricByKey("result.decimalMean")!, context.scoring)
  // der Abstand rechnet über die Familie in der Art, auch vor dem Zeitraum (wie die Seite eines Zeitraums)
  const deltas = deltasBefore(
    projectedValues(ofKind, metricByKey("result.decimalMean")!, context.scoring, {
      includeProbeOnly: true,
    }),
    new Set(shown.map((c) => c.id))
  )

  const days = new Map<string, Evening>()
  for (const card of shown) {
    const day = eveningDay(card.startedAtMs, context.timeZone)
    const ofCard = card.scoring ?? (isProbeOnly(card) ? undefined : card.official)
    const resultScoring = ofCard ?? context.scoring
    // Werte wie am Ausdruck (die Wertung, bei nur Probe die Probe): so rechnet die Projektion
    const row: ListRow = {
      id: card.id,
      startedAtMs: card.startedAtMs,
      kind: cardKind(card),
      result: projected(card, resultMetric(resultScoring), resultScoring),
      resultScoring,
      ofCard: ofCard !== undefined,
      otherResult: projected(card, resultMetric(other(resultScoring)), other(resultScoring)),
      mean: projected(card, meanMetric, context.scoring),
      delta: deltas.get(card.id) ?? null,
      shots: card.projection.printedShots,
    }
    const evening = days.get(day) ?? { day, rows: [], shots: 0, others: [] }
    evening.rows.push(row)
    evening.shots += row.shots
    days.set(day, evening)
  }

  // andere Familien des Abends, unabhängig von Art und Merkmal, aber nur im Zeitraum: `listOnEvening` lässt Art und
  // Merkmal fallen und behält den Zeitraum, so steht der Abend nach dem Sprung sicher in der Liste (Review N2)
  for (const other of input) {
    if (other.family === family) continue
    if (range && !inRange(other.card.startedAtMs, range)) continue
    const evening = days.get(eveningDay(other.card.startedAtMs, context.timeZone))
    if (!evening) continue
    const entry = evening.others.find((o) => o.family === other.family)
    if (entry) entry.count++
    else evening.others.push({ family: other.family, count: 1 })
  }

  return {
    family,
    evenings: [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
    // ein gewähltes Merkmal bleibt wählbar, auch wenn die Familie es nicht hat (sonst ließe es sich nicht lösen)
    flags: [
      ...new Set([...ofFamily.flatMap((c) => c.flags), ...(query.flag ? [query.flag] : [])]),
    ].sort(),
    cards: shown.length,
    scoring: context.scoring,
    digits: {
      result: { decimal: resultMetric("decimal").decimals, rings: resultMetric("rings").decimals },
      mean: meanMetric.decimals,
    },
    range,
  }
}
