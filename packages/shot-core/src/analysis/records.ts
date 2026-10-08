// Rekorde über viele Scheiben (Plan L2, D7, Katalog R1–R8). Keine eigene Rechnung: Die Werte kommen aus der
// Registry und aus den Auswertungen einer Scheibe, hier wird nur ausgewählt und verglichen.

import {
  computeMetric,
  eligibleShots,
  FLAG_SUSPICIOUS,
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "../metrics"
import { MAX_DECIMAL_TENTHS } from "../targets"
import { byStart, cardShots } from "./card-shots"
import { longestRun, seriesCurve } from "./course"
import { cardValues, periodTrend, type PeriodCard } from "./period"
import { decimalHistogram, shotExtremes } from "./result"

/** Merkmale, mit denen eine Scheibe für Rekorde nicht zählt (SF-66) */
export const RECORD_EXCLUDING_FLAGS = ["nur-pdf", "neu-gewertet", "ausgenommen"] as const

/** Serie zu zehn für die engste Serie (R4) */
const TIGHT_SERIES = 10
/** Schwelle eines Zehners in Zehnteln (R7) */
const TEN_TENTHS = 100
/** beste Form über so viele Scheiben (R8) */
const FORM_WINDOW = 5

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>
const RESULT = metric("result.decimal")
const MEAN = metric("result.decimalMean")
const TENS = metric("result.tens")
const INNER_TENS = metric("result.innerTens")
const ENCLOSING = metric("group.enclosingDiameter")

/**
 * Zählt die Scheibe für Rekorde (D7)? Nur endgültig und vollständig, ohne `nur-pdf`, `neu-gewertet` und
 * `ausgenommen` und ohne einen verdächtigen Schuss (SF-15, SF-66).
 */
export function recordEligible(card: PeriodCard): boolean {
  if (!card.complete) return false
  const excluding: readonly string[] = RECORD_EXCLUDING_FLAGS
  if ((card.flags ?? []).some((flag) => excluding.includes(flag))) return false
  return !card.shots.some((shot) => (shot.flags ?? []).includes(FLAG_SUSPICIOUS))
}

export interface RecordRef {
  value: number
  cardId: string
  atMs: number
  /** wo auf der Scheibe, etwa „Serie 3“ oder „Schuss 17“ */
  detail?: string
}

export interface PeriodRecords {
  /** R1: bestes Ergebnis je Schusszahl der Wertung (Schlüssel: Schusszahl) */
  bestCard: Readonly<Record<number, RecordRef>>
  /** R2: beste Serie voller Länge (die häufigste Serienlänge der Scheibe), detail „Serie 3“ */
  bestSeries: RecordRef | null
  /** R3: bester Teiler (kleinster), detail „Schuss 17“ */
  bestTeiler: RecordRef | null
  /** R4: engste Gruppe (Streukreis in mm) über eine volle Serie zu zehn … */
  tightestSeries: RecordRef | null
  /** … und je Schusszahl über die volle Scheibe */
  tightestCard: Readonly<Record<number, RecordRef>>
  /** R5: meiste 10,9 je Schusszahl (nur in Zehnteln; in ganzen Ringen leer) */
  mostPerfect: Readonly<Record<number, RecordRef>>
  /** R6: meiste Zehner und Innenzehner je Schusszahl */
  mostTens: Readonly<Record<number, RecordRef>>
  mostInnerTens: Readonly<Record<number, RecordRef>>
  /** R7: längste Folge von Zehnern, detail „ab Schuss 4“ */
  longestTenRun: RecordRef | null
  /** R8: beste Form: höchster voller Schnitt über fünf Scheiben (Ø je Schuss); an der fünften Scheibe */
  bestForm: RecordRef | null
}

type Better = "higher" | "lower"

/** Nur ein echt besserer Wert ersetzt den Rekord: Bei Gleichstand gilt der frühere (D7). */
const beats = (value: number, current: RecordRef | null | undefined, better: Better) =>
  !current || (better === "higher" ? value > current.value : value < current.value)

/** häufigste Serienlänge, bei Gleichstand die längere (wie `seriesConsistency`) */
function modalLength(lengths: readonly number[]): number | null {
  const counts = new Map<number, number>()
  for (const length of lengths) counts.set(length, (counts.get(length) ?? 0) + 1)
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  return sorted.length ? sorted[0][0] : null
}

/** die Wertungsschüsse jeder Serie, in der Folge der Serien */
function seriesShots(shots: readonly MetricShot[]): [number, MetricShot[]][] {
  const bySeries = new Map<number, MetricShot[]>()
  for (const shot of shots) {
    if (shot.kind !== "match" || shot.series === null) continue
    bySeries.set(shot.series, [...(bySeries.get(shot.series) ?? []), shot])
  }
  return [...bySeries].sort((a, b) => a[0] - b[0])
}

/**
 * Rekorde über die Scheiben, die zählen (`recordEligible`), in der gewählten Wertung (R1–R8, D7); wahlweise
 * nur Training oder nur Wettkampf. Eine Scheibe nur mit Probe zählt nur mit `includeProbeOnly`, dann über
 * die Probe wie Wertung (D8). Zählungen (R5–R7) setzen erst ab einem Treffer einen Rekord.
 */
export function periodRecords(
  cards: readonly PeriodCard[],
  scoring: Scoring,
  options: { kind?: PeriodCard["kind"]; includeProbeOnly?: boolean } = {}
): PeriodRecords {
  const counted = byStart(cards).filter(
    (card) => recordEligible(card) && (options.kind === undefined || card.kind === options.kind)
  )
  const result = inScoring(RESULT, scoring)
  const bestCard: Record<number, RecordRef> = {}
  const tightestCard: Record<number, RecordRef> = {}
  const mostPerfect: Record<number, RecordRef> = {}
  const mostTens: Record<number, RecordRef> = {}
  const mostInnerTens: Record<number, RecordRef> = {}
  let bestSeries: RecordRef | null = null
  let bestTeiler: RecordRef | null = null
  let tightestSeries: RecordRef | null = null
  let longestTenRun: RecordRef | null = null

  for (const card of counted) {
    const shots = cardShots(card.shots, options.includeProbeOnly)
    if (!shots) continue
    const n = shots.length
    const ref = (value: number, detail?: string): RecordRef => ({
      value,
      cardId: card.id,
      atMs: card.startedAtMs,
      ...(detail === undefined ? {} : { detail }),
    })
    const perCount = (table: Record<number, RecordRef>, value: number | null, better: Better) => {
      if (value !== null && beats(value, table[n], better)) table[n] = ref(value)
    }
    const count = (value: number | null) => (value === null || value < 1 ? null : value)

    perCount(bestCard, computeMetric(result, shots), "higher")
    perCount(mostTens, count(computeMetric(TENS, shots)), "higher")
    perCount(mostInnerTens, count(computeMetric(INNER_TENS, shots)), "higher")
    if (scoring === "decimal") {
      perCount(mostPerfect, count(decimalHistogram(shots).counts[MAX_DECIMAL_TENTHS]), "higher")
    }
    const enclosing = computeMetric(ENCLOSING, shots)
    if (eligibleShots(ENCLOSING, shots).length === n) perCount(tightestCard, enclosing, "lower")

    const curve = seriesCurve(shots, scoring)
    const full = modalLength(curve.map((s) => s.shots))
    for (const s of curve) {
      if (s.shots === full && s.total !== null && beats(s.total, bestSeries, "higher")) {
        bestSeries = ref(s.total, `Serie ${s.series}`)
      }
    }
    for (const [series, group] of seriesShots(shots)) {
      // eine volle Serie zu zehn, und jeder Schuss mit Lage
      if (
        group.length !== TIGHT_SERIES ||
        eligibleShots(ENCLOSING, group).length !== group.length
      ) {
        continue
      }
      const diameter = computeMetric(ENCLOSING, group)
      if (diameter !== null && beats(diameter, tightestSeries, "lower")) {
        tightestSeries = ref(diameter, `Serie ${series}`)
      }
    }

    const best = shotExtremes(shots)?.bestTeiler[0]
    if (best && beats(best.teiler, bestTeiler, "lower")) {
      bestTeiler = ref(best.teiler, `Schuss ${best.number}`)
    }
    const run = longestRun(shots, scoring, TEN_TENTHS)
    if (run.length >= 1 && beats(run.length, longestTenRun, "higher")) {
      longestTenRun = ref(run.length, `ab Schuss ${run.start}`)
    }
  }

  let bestForm: RecordRef | null = null
  const values = cardValues(counted, MEAN, scoring, { includeProbeOnly: options.includeProbeOnly })
  for (const point of periodTrend(values, FORM_WINDOW).points) {
    if (!point.partial && beats(point.mean, bestForm, "higher")) {
      bestForm = { value: point.mean, cardId: point.id, atMs: point.atMs }
    }
  }

  return {
    bestCard,
    bestSeries,
    bestTeiler,
    tightestSeries,
    tightestCard,
    mostPerfect,
    mostTens,
    mostInnerTens,
    longestTenRun,
    bestForm,
  }
}
