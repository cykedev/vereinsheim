// Abende der Scheiben-Liste (Plan N2, `vault/spiegel/spiegel-navigation.md`): reine Funktionen. Ein Abend ist Konto
// und Tag in der Anzeige-Zeitzone, eine Scheibe vor 4 Uhr zählt zum Vortag (D1). Alle Scheiben eines Abends stehen
// gleichberechtigt in zeitlicher Folge, die Abende neueste zuerst (D2); die Familie ist Pflicht, andere Familien des
// Abends nennt der Kopf (D3). Zahlen nur aus dem Fachkern.

import { cardValues, type PeriodCard } from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey, type Scoring } from "@vereinsheim/shot-core/metrics"
import { formatIsoDate, formatTimeOfDay, zonedDayStartMs } from "@vereinsheim/lib/format"

import type { ListQuery } from "../nav/routes"
import { inRange, resolveRange, type DateRange, type NamedPeriod } from "../period/calendar"
import { byStart, deltasBefore, isProbeOnly } from "../period/model"
import { matchShots } from "../shots"

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
  /** Stellen von Ergebnis und Ø in der Wertung (aus der Kennzahl); der Abstand hat die Stellen des Ø */
  digits: { result: number; mean: number }
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
    const shots = matchShots(card.shots)
    const row: ListRow = {
      id: card.id,
      startedAtMs: card.startedAtMs,
      kind: card.kind === "competition" ? "competition" : isProbeOnly(card) ? "probe" : "training",
      result: computeMetric(resultMetric, shots),
      mean: computeMetric(meanMetric, shots),
      delta: deltas.get(card.id) ?? null,
      shots: shots.length,
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
      ...new Set([...ofFamily.flatMap((c) => c.flags ?? []), ...(query.flag ? [query.flag] : [])]),
    ].sort(),
    cards: shown.length,
    digits: { result: resultMetric.decimals, mean: meanMetric.decimals },
    range,
  }
}
