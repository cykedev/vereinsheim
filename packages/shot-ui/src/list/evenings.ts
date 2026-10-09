// Abende der Scheiben-Liste (Plan N2, `vault/spiegel/spiegel-navigation.md`): reine Funktionen. Ein Abend ist Konto
// und Tag in der Anzeige-Zeitzone, eine Scheibe vor 4 Uhr zählt zum Vortag (D1). Alle Scheiben eines Abends stehen
// gleichberechtigt in zeitlicher Folge, die Abende neueste zuerst (D2); die Familie ist Pflicht, andere Familien des
// Abends nennt der Kopf (D3). Zahlen nur aus dem Fachkern.

import { cardValues, type PeriodCard } from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  probeOnlyAsMatch,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { formatIsoDate } from "@vereinsheim/lib/format"

import type { ListQuery } from "../nav/routes"
import { inRange, resolveRange, type DateRange, type NamedPeriod } from "../period/calendar"
import { deltasBefore, isProbeOnly } from "../period/model"

/** eine Scheibe mit ihrer Familie (die Liste filtert nach ihr) */
export interface ListInputCard {
  card: PeriodCard
  family: string
}

export interface ListRow {
  id: string
  startedAtMs: number
  /** Training, Wettkampf oder Training nur aus Probe */
  kind: "training" | "competition" | "probe"
  /** Ergebnis in der Wertung; nur Probe wie Wertung, nicht amtlich; null ohne Wert */
  result: number | null
  /** Ø je Schuss in der Wertung */
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
  /** der Zeitraum aus „Alle in Scheiben zeigen“; null: alle Abende */
  range: DateRange | null
}

export interface CardListContext {
  timeZone: string
  nowMs: number
  named: readonly NamedPeriod[]
  scoring: Scoring
}

/** Training bis 4 Uhr nachts gehört zum Abend davor (D1) */
const EVENING_CUTOFF_MS = 4 * 3_600_000

/** der Abend einer Scheibe als ISO-Tag in der Zone; vor 4 Uhr der Vortag */
export function eveningDay(startedAtMs: number, timeZone: string): string {
  return formatIsoDate(new Date(startedAtMs - EVENING_CUTOFF_MS), timeZone)
}

const byStart = (a: PeriodCard, b: PeriodCard) => a.startedAtMs - b.startedAtMs

/** die Schüsse, über die die Zeile rechnet: die Wertung, bei nur Probe die Probe wie Wertung */
const countedShots = (card: PeriodCard) =>
  isProbeOnly(card) ? probeOnlyAsMatch(card.shots) : card.shots

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
      (!query.flag || (card.flags ?? []).includes(query.flag)) &&
      (!range || inRange(card.startedAtMs, range))
  )

  const resultMetric = inScoring(metricByKey("result.decimal")!, context.scoring)
  const meanMetric = inScoring(metricByKey("result.decimalMean")!, context.scoring)
  // der Abstand rechnet über die Familie in der Art, auch vor dem Zeitraum (wie die Seite eines Zeitraums)
  const deltas = deltasBefore(
    cardValues(ofKind, metricByKey("result.decimalMean")!, context.scoring, {
      includeProbeOnly: true,
    }),
    new Set(shown.map((c) => c.id))
  )

  const days = new Map<string, Evening>()
  for (const card of shown) {
    const day = eveningDay(card.startedAtMs, context.timeZone)
    const shots = countedShots(card)
    const row: ListRow = {
      id: card.id,
      startedAtMs: card.startedAtMs,
      kind: card.kind === "competition" ? "competition" : isProbeOnly(card) ? "probe" : "training",
      result: computeMetric(resultMetric, shots),
      mean: computeMetric(meanMetric, shots),
      delta: deltas.get(card.id) ?? null,
      shots: shots.filter((s) => s.kind === "match").length,
    }
    const evening = days.get(day) ?? { day, rows: [], shots: 0, others: [] }
    evening.rows.push(row)
    evening.shots += row.shots
    days.set(day, evening)
  }

  // andere Familien des Abends, unabhängig von Art, Merkmal und Zeitraum
  for (const other of input) {
    if (other.family === family) continue
    const evening = days.get(eveningDay(other.card.startedAtMs, context.timeZone))
    if (!evening) continue
    const entry = evening.others.find((o) => o.family === other.family)
    if (entry) entry.count++
    else evening.others.push({ family: other.family, count: 1 })
  }

  return {
    family,
    evenings: [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
    flags: [...new Set(ofFamily.flatMap((c) => c.flags ?? []))].sort(),
    cards: shown.length,
    range,
  }
}
