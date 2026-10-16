// Rekorde über viele Scheiben (Katalog R1–R8). Keine eigene Rechnung: Die Werte kommen aus der
// Registry und aus den Auswertungen einer Scheibe, hier wird nur ausgewählt und verglichen.

import {
  computeMetric,
  eligibleShots,
  FLAG_SUSPICIOUS,
  inScoring,
  metricByKey,
  type CardFlag,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "../metrics"
import { modalLength } from "../stats"
import { MAX_DECIMAL_TENTHS } from "../targets"
import { byStart, cardShots } from "./card-shots"
import { longestRun, seriesCurve } from "./course"
import { cardValues, periodTrend, type PeriodCard } from "./period"
import { decimalHistogram, shotExtremes } from "./result"

/** Merkmale, mit denen eine Scheibe für Rekorde nicht zählt (SF-66) */
export const RECORD_EXCLUDING_FLAGS = [
  "nur-pdf",
  "neu-gewertet",
  "ausgenommen",
] as const satisfies readonly CardFlag[]
/**
 * Probe, die der Schütze nachträglich als Wertung zählt (SF-05, nicht amtlich): für Rekorde wie eine Scheibe nur
 * mit Probe, also nur mit `includeProbeOnly`
 */
export const FLAG_COUNTED_AS_MATCH = "als-wertung-gezaehlt" satisfies CardFlag

/** Serie zu zehn für die engste Serie (R4) */
const TIGHT_SERIES = 10
/** Schwelle eines Zehners in Zehnteln (R7) */
const TEN_TENTHS = 100

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>
const RESULT = metric("result.decimal")
const MEAN = metric("result.decimalMean")
const TENS = metric("result.tens")
const INNER_TENS = metric("result.innerTens")
const ENCLOSING = metric("group.enclosingDiameter")

/**
 * Zählt die Scheibe für Rekorde? Nur endgültig und vollständig, ohne `nur-pdf`, `neu-gewertet` und
 * `ausgenommen` und ohne einen verdächtigen Schuss unter denen, die zählen (SF-15, SF-66): bei Wertung die
 * Wertungsschüsse, bei einer Scheibe nur mit Probe die Probe. Ein verdächtiger Probeschuss vor der Wertung
 * schließt die Scheibe nicht aus, er geht in keinen Rekord ein.
 */
export function recordEligible(card: PeriodCard): boolean {
  if (!card.complete) return false
  const excluding: readonly string[] = RECORD_EXCLUDING_FLAGS
  if ((card.flags ?? []).some((flag) => excluding.includes(flag))) return false
  const counted = cardShots(card.shots, true)?.match ?? []
  return !counted.some((shot) => (shot.flags ?? []).includes(FLAG_SUSPICIOUS))
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
  /**
   * R2: beste Serie voller Länge (die häufigste Serienlänge der Scheibe) je Serienlänge (Schlüssel: Schüsse
   * der Serie), detail „Serie 3“; Serien zu zehn und zu fünf sind nicht vergleichbar
   */
  bestSeries: Readonly<Record<number, RecordRef>>
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
  /** R8: beste Form: höchster voller Schnitt über fünf Scheiben (Ø je Schuss, `periodTrend`); an der fünften Scheibe */
  bestForm: RecordRef | null
}

type Better = "higher" | "lower"

/** Nur ein echt besserer Wert ersetzt den Rekord: Bei Gleichstand gilt der frühere. */
const beats = (value: number, current: RecordRef | null | undefined, better: Better) =>
  !current || (better === "higher" ? value > current.value : value < current.value)

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
 * was eine Scheibe zu den Rekorden beiträgt (R1–R7), einmal aus ihren Schüssen gerechnet, und ihr Ø je Schuss für
 * die beste Form (R8). So lassen sich Rekorde aus gespeicherten Werten je Scheibe zusammenführen (Projektion), statt
 * jeden Schuss zu laden. Null, wenn die Scheibe keine zählenden Schüsse hat (nur Probe ohne `includeProbeOnly`)
 */
export interface RecordCandidates {
  /** Schusszahl der zählenden Wertung (Schlüssel für R1, R4, R5, R6) */
  n: number
  result: number | null
  /** ab einem Treffer; sonst null */
  tens: number | null
  innerTens: number | null
  /** nur in Zehnteln */
  perfect: number | null
  /** Streukreis der ganzen Scheibe, nur wenn jeder Schuss eine Lage hat */
  tightest: number | null
  /** beste Serie voller Länge (die häufigste Serienlänge), bei Gleichstand die frühere */
  bestSeries: { length: number; value: number; series: number } | null
  /** engste volle Serie zu zehn */
  tightestSeries: { value: number; series: number } | null
  bestTeiler: { value: number; shot: number } | null
  longestTenRun: { length: number; start: number } | null
  /** Ø je Schuss wie `cardValues` (R8) */
  mean: { value: number; n: number } | null
}

export function cardRecordCandidates(
  card: PeriodCard,
  scoring: Scoring,
  includeProbeOnly = false
): RecordCandidates | null {
  const chosen = cardShots(card.shots, includeProbeOnly)
  if (!chosen) return null
  // Kennzahlen der Registry über die Wertungsschüsse; Auswertungen, die selbst auswählen und nummerieren,
  // über die ganze Karte (erst ordnen, dann auswählen)
  const { match: shots, whole } = chosen
  const n = shots.length
  const count = (value: number | null) => (value === null || value < 1 ? null : value)

  const curve = seriesCurve(whole, scoring)
  const full = modalLength(curve.map((s) => s.shots))
  let bestSeries: RecordCandidates["bestSeries"] = null
  for (const s of curve) {
    if (s.shots !== full || s.total === null) continue
    if (!bestSeries || s.total > bestSeries.value)
      bestSeries = { length: s.shots, value: s.total, series: s.series }
  }
  let tightestSeries: RecordCandidates["tightestSeries"] = null
  for (const [series, group] of seriesShots(whole)) {
    // eine volle Serie zu zehn, und jeder Schuss mit Lage
    if (group.length !== TIGHT_SERIES || eligibleShots(ENCLOSING, group).length !== group.length) {
      continue
    }
    const diameter = computeMetric(ENCLOSING, group)
    if (diameter !== null && (!tightestSeries || diameter < tightestSeries.value))
      tightestSeries = { value: diameter, series }
  }
  const best = shotExtremes(whole)?.bestTeiler[0]
  const run = longestRun(whole, scoring, TEN_TENTHS)
  const mean = cardValues([card], MEAN, scoring, { includeProbeOnly })[0]
  return {
    n,
    result: computeMetric(inScoring(RESULT, scoring), shots),
    tens: count(computeMetric(TENS, shots)),
    innerTens: count(computeMetric(INNER_TENS, shots)),
    perfect:
      scoring === "decimal" ? count(decimalHistogram(whole).counts[MAX_DECIMAL_TENTHS]) : null,
    tightest: eligibleShots(ENCLOSING, shots).length === n ? computeMetric(ENCLOSING, shots) : null,
    bestSeries,
    tightestSeries,
    bestTeiler: best ? { value: best.teiler, shot: best.number } : null,
    longestTenRun:
      run.length >= 1 && run.start !== null ? { length: run.length, start: run.start } : null,
    mean: mean ? { value: mean.value, n: mean.n } : null,
  }
}

/** eine Scheibe mit ihren Kandidaten, in der Folge der Scheiben */
export interface RecordEntry {
  id: string
  atMs: number
  candidates: RecordCandidates
}

/**
 * Rekorde aus den Kandidaten der Scheiben, die zählen, in der Folge ihres Beginns: Nur ein echt besserer Wert
 * ersetzt einen Rekord, bei Gleichstand gilt der frühere
 */
export function combineRecords(entries: readonly RecordEntry[]): PeriodRecords {
  const bestCard: Record<number, RecordRef> = {}
  const tightestCard: Record<number, RecordRef> = {}
  const mostPerfect: Record<number, RecordRef> = {}
  const mostTens: Record<number, RecordRef> = {}
  const mostInnerTens: Record<number, RecordRef> = {}
  const bestSeries: Record<number, RecordRef> = {}
  let bestTeiler: RecordRef | null = null
  let tightestSeries: RecordRef | null = null
  let longestTenRun: RecordRef | null = null

  for (const { id, atMs, candidates: c } of entries) {
    const ref = (value: number, detail?: string): RecordRef => ({
      value,
      cardId: id,
      atMs,
      ...(detail === undefined ? {} : { detail }),
    })
    const put = (
      table: Record<number, RecordRef>,
      key: number,
      value: number | null,
      better: Better,
      detail?: string
    ) => {
      if (value !== null && beats(value, table[key], better)) table[key] = ref(value, detail)
    }
    put(bestCard, c.n, c.result, "higher")
    put(mostTens, c.n, c.tens, "higher")
    put(mostInnerTens, c.n, c.innerTens, "higher")
    put(mostPerfect, c.n, c.perfect, "higher")
    put(tightestCard, c.n, c.tightest, "lower")
    if (c.bestSeries)
      put(
        bestSeries,
        c.bestSeries.length,
        c.bestSeries.value,
        "higher",
        `Serie ${c.bestSeries.series}`
      )
    if (c.tightestSeries && beats(c.tightestSeries.value, tightestSeries, "lower"))
      tightestSeries = ref(c.tightestSeries.value, `Serie ${c.tightestSeries.series}`)
    if (c.bestTeiler && beats(c.bestTeiler.value, bestTeiler, "lower"))
      bestTeiler = ref(c.bestTeiler.value, `Schuss ${c.bestTeiler.shot}`)
    if (c.longestTenRun && beats(c.longestTenRun.length, longestTenRun, "higher"))
      longestTenRun = ref(c.longestTenRun.length, `ab Schuss ${c.longestTenRun.start}`)
  }

  let bestForm: RecordRef | null = null
  const values = entries.flatMap(({ id, atMs, candidates }) =>
    candidates.mean ? [{ id, atMs, value: candidates.mean.value, n: candidates.mean.n }] : []
  )
  for (const point of periodTrend(values).points) {
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

/**
 * Rekorde über die Scheiben, die zählen (`recordEligible`), in der gewählten Wertung (R1–R8); wahlweise
 * nur Training oder nur Wettkampf. Eine Scheibe nur mit Probe zählt nur mit `includeProbeOnly`, dann über
 * die Probe wie Wertung; ebenso eine Scheibe, deren Probe der Schütze als Wertung zählt (SF-05). Zählungen
 * (R5–R7) setzen erst ab einem Treffer einen Rekord. Aus Kandidaten je Scheibe (`cardRecordCandidates`)
 * zusammengeführt (`combineRecords`)
 */
export function periodRecords(
  cards: readonly PeriodCard[],
  scoring: Scoring,
  options: { kind?: PeriodCard["kind"]; includeProbeOnly?: boolean } = {}
): PeriodRecords {
  const counted = byStart(cards).filter(
    (card) =>
      recordEligible(card) &&
      (options.kind === undefined || card.kind === options.kind) &&
      (options.includeProbeOnly || !(card.flags ?? []).includes(FLAG_COUNTED_AS_MATCH))
  )
  return combineRecords(
    counted.flatMap((card) => {
      const candidates = cardRecordCandidates(card, scoring, options.includeProbeOnly)
      return candidates ? [{ id: card.id, atMs: card.startedAtMs, candidates }] : []
    })
  )
}
