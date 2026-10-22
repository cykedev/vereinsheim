// Auswertungen über viele Scheiben (vault/spiegel/spiegel-langzeit.md): Werte je Scheibe, Verlauf mit gleitendem
// Schnitt und Formband, Boden und Decke je Abschnitt, Trainingsumfang, Vergleich zweier Zeiträume und die letzte
// Scheibe gegen den eigenen Schnitt (Katalog T1, T2, T3, T5, T6, C3, C4). Die Disziplin-Familie wählt der Aufrufer;
// Wochen, Monate und Tage ordnet er zu, denn die Anzeige-Zeitzone liegt in der App.

import {
  asOnPrintout,
  computeMetric,
  eligibleShots,
  inScoring,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "../metrics"
import { standardDeviation } from "../geometry"
import { mad, mannWhitney, median, quantile } from "../stats"
import { byStart, cardShots } from "./card-shots"

/** Faktor, der den MAD bei normalverteilten Werten zur Standardabweichung macht */
const MAD_TO_SD = 1.4826
/** gleitender Schnitt über so viele Scheiben */
const TREND_WINDOW = 5
/** ab so vielen Scheiben ein Formband */
const MIN_BAND_CARDS = 10
/** Ø je Schuss rechnet in zwei Schritten (Summe ÷ 10 ÷ n): gleiche Werte bei verschiedener Schusszahl
 * weichen in der letzten Stelle ab. Auf neun Nachkommastellen gerundet sind sie wieder gleich, für den Test
 * über Ränge und das Perzentil. */
const VALUE_DIGITS = 1e9
/** ab so vielen Scheiben in einem Abschnitt Boden und Decke */
const MIN_BUCKET_SPREAD = 5
/** Signifikanzniveau des Vergleichs */
export const COMPARE_ALPHA = 0.05
/** bedeutsam ab diesem Anteil der gepoolten Streuung (T3, Hopkins) */
const MEANINGFUL_SHARE = 0.3
const DAY_MS = 86_400_000
/** Schnitt über die Scheiben dieser Tage vor der letzten (C4), ab so vielen Scheiben */
const AVERAGE_DAYS = 30
const MIN_AVERAGE_CARDS = 3
/** Perzentil unter so vielen letzten Scheiben, ab so vielen */
const PERCENTILE_CARDS = 50
const MIN_PERCENTILE_CARDS = 10

export interface PeriodCard {
  /** stabile Kennung der Scheibe (Rekord und Weg zur Scheibe) */
  id: string
  /** Beginn in ms (UTC) */
  startedAtMs: number
  kind: "training" | "competition"
  /**
   * endgültig und mit voller Schusszahl (SF-66): nur dann für Rekorde. Eine Scheibe nur mit Probe ist
   * vollständig, wenn das Training abgeschlossen ist; ihre Schusszahl ist die der Probe, nicht die der Wertung.
   */
  complete: boolean
  /** Merkmale der Scheibe, etwa "nur-pdf", "neu-gewertet", "ausgenommen" */
  flags?: readonly string[]
  /**
   * Wertung der Disziplin (Admin), Vorgabe der Scheibe, im Wettkampf die amtliche (Meyton druckt nach ihr); nie aus
   * `Treffer.Wertung`, das ist die umschaltbare Anzeigeart am Monitor (SF-74). Fehlt ohne Einstellung (dann wie am Stand)
   */
  official?: Scoring
  shots: readonly MetricShot[]
}

export interface CardValue {
  id: string
  atMs: number
  value: number
  /** Schüsse, die für den Wert zählen (`eligibleShots`), für Maße, die an der Schusszahl hängen */
  n: number
  /**
   * nur bei Kennzahlen, die sich über Schüsse mitteln (`pooling: "mean"`): Standardabweichung der Werte je Schuss
   * (`perShot`, n − 1), null unter zwei Schüssen; die Rechnung über zwei Ebenen braucht sie ([[adr-034]])
   */
  sd?: number | null
}

/**
 * Wert einer Registry-Kennzahl je Scheibe (T1), in der Folge der Scheiben (`startedAtMs`, bei Gleichstand
 * die Kennung), über die Wertungsschüsse; eine Scheibe nur mit Probe nur mit `includeProbeOnly`, dann über
 * die Probe. Ohne Wert (Mindestzahl, fehlende Angaben) fällt die Scheibe weg. Der Wert ist auf neun
 * Nachkommastellen gerundet, damit gleiche Werte gleich sind.
 */
export function cardValues(
  cards: readonly PeriodCard[],
  metric: MetricDefinition,
  scoring: Scoring,
  options: { includeProbeOnly?: boolean } = {}
): CardValue[] {
  const scored = inScoring(metric, scoring)
  return byStart(cards).flatMap((card) => {
    const chosen = cardShots(card.shots, options.includeProbeOnly)
    if (!chosen) return []
    const shots = chosen.match
    // die ganze Karte für Abstände: eine späte Probe ist keine Lücke (SF-04)
    const value = computeMetric(scored, shots, chosen.whole)
    if (value === null) return []
    const counted = eligibleShots(scored, shots)
    const entry: CardValue = {
      id: card.id,
      atMs: card.startedAtMs,
      value: Math.round(value * VALUE_DIGITS) / VALUE_DIGITS,
      n: counted.length,
    }
    if (scored.pooling === "mean" && scored.perShot) {
      const sd = standardDeviation(counted.map(scored.perShot))
      entry.sd = sd === null ? null : Math.round(sd * VALUE_DIGITS) / VALUE_DIGITS
    }
    return [entry]
  })
}

/** Mittel der Werte je Scheibe */
const meanOfValues = (window: readonly CardValue[]) =>
  window.reduce((sum, v) => sum + v.value, 0) / window.length

export interface TrendPoint extends CardValue {
  /** Schnitt der letzten fünf Scheiben bis hierher; `partial`, solange es noch keine fünf sind */
  mean: number
  partial: boolean
  /**
   * Formband: Schnitt ± typische Schwankung; null unter zehn Scheiben, solange das Fenster nicht voll ist und
   * ohne Schwankung
   */
  band: { low: number; high: number } | null
}

/**
 * Verlauf mit gleitendem Schnitt über die letzten fünf Scheiben (T1) und Formband (T2): Die
 * typische Schwankung ist 1,4826 · MAD der Abweichungen der Scheiben vom vollen Schnitt, ab zehn Scheiben.
 * Ist der MAD 0 (mehr als die Hälfte der Abweichungen genau 0, etwa bei Zählungen wie den Innenzehnern),
 * gibt es kein Band: Eines der Breite null wäre scheingenau. Den Schnitt eines Fensters rechnet `average`, für
 * Kennzahlen mit Pooling über die Schüsse (`pooledValue`, [[adr-034]]); ohne ihn das Mittel der Werte.
 */
export function periodTrend(
  values: readonly CardValue[],
  average: (window: readonly CardValue[]) => number = meanOfValues
): {
  points: TrendPoint[]
  /** 1,4826 · MAD der Abweichungen vom vollen Schnitt; null unter zehn Werten oder ohne Schwankung */
  spread: number | null
} {
  const window = TREND_WINDOW
  const means = values.map((_, i) => {
    return average(values.slice(Math.max(0, i - window + 1), i + 1))
  })
  const residuals = values.flatMap((v, i) => (i + 1 >= window ? [v.value - means[i]] : []))
  const deviation = values.length >= MIN_BAND_CARDS ? mad(residuals) : null
  const spread = deviation === null || deviation === 0 ? null : MAD_TO_SD * deviation
  const points = values.map((v, i) => {
    const partial = i + 1 < window
    const band =
      spread === null || partial ? null : { low: means[i] - spread, high: means[i] + spread }
    return { ...v, mean: means[i], partial, band }
  })
  return { points, spread }
}

/** Gruppen in der Folge ihres ersten Elements */
function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}

export interface PeriodBucket {
  key: string
  n: number
  median: number
  /** Boden und Decke: P10 und P90 der Scheibenwerte; null unter fünf Scheiben im Abschnitt */
  p10: number | null
  p90: number | null
}

/**
 * Boden und Decke je Abschnitt (T5): Zahl, Median, P10 und P90 der Scheibenwerte. Den Abschnitt
 * (Woche, Monat) bestimmt `bucketOf`; Abschnitte in der Folge ihres ersten Werts.
 */
export function periodBuckets(
  values: readonly CardValue[],
  bucketOf: (atMs: number) => string
): PeriodBucket[] {
  return [...groupBy(values, (v) => bucketOf(v.atMs))].map(([key, group]) => {
    const xs = group.map((v) => v.value)
    const spread = xs.length >= MIN_BUCKET_SPREAD
    return {
      key,
      n: xs.length,
      median: median(xs) as number,
      p10: spread ? quantile(xs, 0.1) : null,
      p90: spread ? quantile(xs, 0.9) : null,
    }
  })
}

export interface VolumeBucket {
  key: string
  /** alle Schüsse, Probe und Wertung */
  shots: number
  cards: number
  /** Tage mit mindestens einer Scheibe (`dayOf`) */
  days: number
}

/**
 * Trainingsumfang je Abschnitt (T6): Schüsse wie am Ausdruck (`asOnPrintout`: die Wertung, bei einem Training nur aus
 * Probe seine Probe), Scheiben und Tage. Keine Netto-Zeit, sie folgt aus den Abständen. Abschnitte in der Folge ihrer
 * ersten Scheibe. Anders als die übrigen Auswertungen zählt der Umfang jede Scheibe, auch eine nur mit Probe
 * (`includeProbeOnly` gilt für Werte, nicht für den Umfang); Training oder Wettkampf wählt der Aufrufer.
 */
export function trainingVolume(
  cards: readonly PeriodCard[],
  bucketOf: (atMs: number) => string,
  dayOf: (atMs: number) => string
): VolumeBucket[] {
  return [...groupBy(byStart(cards), (card) => bucketOf(card.startedAtMs))].map(([key, group]) => ({
    key,
    // wie am Ausdruck: eine Probe neben Wertung zeigt keine Seite, ein Training nur aus Probe zählt
    shots: group.reduce((sum, card) => sum + asOnPrintout(card.shots).length, 0),
    cards: group.length,
    days: new Set(group.map((card) => dayOf(card.startedAtMs))).size,
  }))
}

/** ab so vielen Scheiben je Seite ein Urteil (die Simulation B19 belegt Fehlalarm und Trennschärfe) */
export const MIN_CARDS_PER_SIDE = 5

export interface PeriodComparison {
  a: { n: number; mean: number }
  b: { n: number; mean: number }
  /** Mittel b − Mittel a */
  delta: number
  /** der Test (`basis`); null unter fünf Scheiben je Seite */
  test: { p: number; exact: boolean } | null
  /**
   * worüber geurteilt wurde ([[adr-034]]): über alle Schüsse, über die Abende (sie wandern über den Zufall der Schüsse
   * hinaus) oder als Rangtest über die Werte je Scheibe (ohne Streuung der Schusswerte oder ohne Pooling); bei zwei
   * Scheiben Schuss für Schuss „shots“
   */
  basis: "shots" | "evenings" | "cards"
  /**
   * „höher“ oder „tiefer“ beschreibt die Zahl, ob das besser ist, sagt `metric.better`. „unklar“ bei p ≥ 0,05,
   * zu wenigen Scheiben oder wenn Rangtest und Mittel in verschiedene Richtungen zeigen.
   */
  verdict: "higher" | "lower" | "unclear"
  /** |Δ| ≥ 0,3 × gepoolte Streuung der Scheibenwerte (T3); null unter fünf je Seite */
  meaningful: boolean | null
}

const meanOf = (xs: readonly number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length
const squares = (xs: readonly number[], center: number) =>
  xs.reduce((sum, x) => sum + (x - center) ** 2, 0)

/** bedeutsam (T3): |Δ| ≥ 0,3 × gepoolte Streuung der Werte je Scheibe beider Seiten */
export function meaningfulChange(
  xa: readonly number[],
  xb: readonly number[],
  delta: number
): boolean {
  const pooled = Math.sqrt(
    (squares(xa, meanOf(xa)) + squares(xb, meanOf(xb))) / (xa.length + xb.length - 2)
  )
  return delta !== 0 && Math.abs(delta) >= MEANINGFUL_SHARE * pooled
}

/**
 * Vergleich zweier Zeiträume (C3, T3): Einheit ist die Scheibe. Mann-Whitney auf den Scheibenwerten,
 * zweiseitig, α 0,05; der Unterschied ist die Differenz der Mittel. Ein Urteil ab fünf Scheiben je Seite.
 * Ohne Scheiben auf einer Seite null.
 */
export function comparePeriods(
  a: readonly CardValue[],
  b: readonly CardValue[]
): PeriodComparison | null {
  return compareSamples(
    a.map((v) => v.value),
    b.map((v) => v.value)
  )
}

/**
 * Vergleich zweier Stichproben, wie `comparePeriods` über bloße Werte: die Scheiben zweier Zeiträume (C3) oder die
 * Schüsse zweier Scheiben (C2). Mann-Whitney zweiseitig, α 0,05, Δ = Mittel b − Mittel a; ein Urteil ab fünf Werten je
 * Seite, nur wenn Rangtest und Mittel in dieselbe Richtung zeigen. Ohne Werte auf einer Seite null.
 */
export function compareSamples(
  xa: readonly number[],
  xb: readonly number[],
  basis: PeriodComparison["basis"] = "cards"
): PeriodComparison | null {
  if (!xa.length || !xb.length) return null
  const ma = meanOf(xa)
  const mb = meanOf(xb)
  const delta = mb - ma
  const summary = { a: { n: xa.length, mean: ma }, b: { n: xb.length, mean: mb }, delta, basis }
  if (xa.length < MIN_CARDS_PER_SIDE || xb.length < MIN_CARDS_PER_SIDE) {
    return { ...summary, test: null, verdict: "unclear", meaningful: null }
  }
  const test = mannWhitney(xa, xb) as { u: number; p: number; exact: boolean }
  // U von a unter der Erwartung heißt: b liegt eher oben; das Urteil gilt nur, wenn das Mittel mitgeht
  const ranksUp = test.u < (xa.length * xb.length) / 2
  const significant = test.p < COMPARE_ALPHA
  const verdict =
    significant && delta > 0 && ranksUp
      ? "higher"
      : significant && delta < 0 && !ranksUp
        ? "lower"
        : "unclear"
  const meaningful = meaningfulChange(xa, xb, delta)
  return { ...summary, test: { p: test.p, exact: test.exact }, verdict, meaningful }
}

export interface OwnAverage {
  last: CardValue
  /** Schnitt der Scheiben aus den 30 Tagen davor, ohne die letzte; null unter drei */
  average: { n: number; mean: number; delta: number } | null
  /** Anteil der letzten 50 (mit ihr) mit kleinerem Wert, gleiche zur Hälfte; null unter zehn */
  percentile: number | null
}

/**
 * Die letzte Scheibe gegen den eigenen Schnitt (C4): gegen das Mittel der Scheiben aus den 30 Tagen
 * davor (ab drei; genau 30 Tage zählt noch) und ihr Rang unter den letzten 50 als Perzentil (ab zehn).
 * `values` in der Folge der Scheiben (`cardValues`); ohne Werte null.
 */
export function againstOwnAverage(values: readonly CardValue[]): OwnAverage | null {
  if (!values.length) return null
  const last = values[values.length - 1]
  const since = last.atMs - AVERAGE_DAYS * DAY_MS
  const before = values.slice(0, -1).filter((v) => v.atMs >= since)
  const mean = before.length >= MIN_AVERAGE_CARDS ? meanOf(before.map((v) => v.value)) : null
  const average = mean === null ? null : { n: before.length, mean, delta: last.value - mean }
  const recent = values.slice(-PERCENTILE_CARDS)
  const below = recent.filter((v) => v.value < last.value).length
  const equal = recent.filter((v) => v.value === last.value).length
  const percentile =
    recent.length >= MIN_PERCENTILE_CARDS ? (below + 0.5 * equal) / recent.length : null
  return { last, average, percentile }
}
