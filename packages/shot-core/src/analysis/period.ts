// Auswertungen über viele Scheiben (Plan L2, vault/spiegel/spiegel-langzeit.md): Werte je Scheibe, Verlauf
// mit gleitendem Schnitt und Formband, Boden und Decke je Abschnitt, Trainingsumfang (Katalog T1, T2, T5, T6). Die Disziplin-Familie wählt der Aufrufer; Wochen,
// Monate und Tage ordnet er zu, denn die Anzeige-Zeitzone liegt in der App (D1).

import {
  computeMetric,
  eligibleShots,
  inScoring,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "../metrics"
import { mad, median, quantile } from "../stats"
import { byStart, cardShots } from "./card-shots"

/** Faktor, der den MAD bei normalverteilten Werten zur Standardabweichung macht */
const MAD_TO_SD = 1.4826
/** ab so vielen Scheiben ein Formband (D3) */
const MIN_BAND_CARDS = 10
/** ab so vielen Scheiben in einem Abschnitt Boden und Decke (D4) */
const MIN_BUCKET_SPREAD = 5

export interface PeriodCard {
  /** stabile Kennung der Scheibe (Rekord und Weg zur Scheibe) */
  id: string
  /** Beginn in ms (UTC) */
  startedAtMs: number
  kind: "training" | "competition"
  /** endgültig und mit voller Schusszahl (SF-66): nur dann für Rekorde */
  complete: boolean
  /** Merkmale der Scheibe, etwa "nur-pdf", "neu-gewertet", "ausgenommen" */
  flags?: readonly string[]
  shots: readonly MetricShot[]
}

export interface CardValue {
  id: string
  atMs: number
  value: number
  /** Schüsse, die für den Wert zählen (`eligibleShots`), für Maße, die an der Schusszahl hängen */
  n: number
}

/**
 * Wert einer Registry-Kennzahl je Scheibe (T1), in der Folge der Scheiben (`startedAtMs`, bei Gleichstand
 * die Kennung), über die Wertungsschüsse; eine Scheibe nur mit Probe nur mit `includeProbeOnly`, dann über
 * die Probe (D8). Ohne Wert (Mindestzahl, fehlende Angaben) fällt die Scheibe weg.
 */
export function cardValues(
  cards: readonly PeriodCard[],
  metric: MetricDefinition,
  scoring: Scoring,
  options: { includeProbeOnly?: boolean } = {}
): CardValue[] {
  const scored = inScoring(metric, scoring)
  return byStart(cards).flatMap((card) => {
    const shots = cardShots(card.shots, options.includeProbeOnly)
    if (!shots) return []
    const value = computeMetric(scored, shots)
    if (value === null) return []
    return [{ id: card.id, atMs: card.startedAtMs, value, n: eligibleShots(scored, shots).length }]
  })
}

export interface TrendPoint extends CardValue {
  /** Schnitt der letzten fünf Scheiben bis hierher; `partial`, solange es noch keine fünf sind */
  mean: number
  partial: boolean
  /** Formband: Schnitt ± typische Schwankung; null unter zehn Scheiben und solange das Fenster nicht voll ist */
  band: { low: number; high: number } | null
}

/**
 * Verlauf mit gleitendem Schnitt über die letzten `window` Scheiben (T1, D2) und Formband (T2, D3): Die
 * typische Schwankung ist 1,4826 · MAD der Abweichungen der Scheiben vom vollen Schnitt, ab zehn Scheiben.
 */
export function periodTrend(
  values: readonly CardValue[],
  window = 5
): {
  points: TrendPoint[]
  /** 1,4826 · MAD der Abweichungen vom vollen Schnitt; null unter zehn Werten */
  spread: number | null
} {
  if (!Number.isInteger(window) || window < 1) {
    throw new RangeError(`Fenster ${window} ist keine ganze Zahl ab 1`)
  }
  const means = values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((sum, v) => sum + v.value, 0) / slice.length
  })
  const residuals = values.flatMap((v, i) => (i + 1 >= window ? [v.value - means[i]] : []))
  const deviation = values.length >= MIN_BAND_CARDS ? mad(residuals) : null
  const spread = deviation === null ? null : MAD_TO_SD * deviation
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
 * Boden und Decke je Abschnitt (T5, D4): Zahl, Median, P10 und P90 der Scheibenwerte. Den Abschnitt
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
 * Trainingsumfang je Abschnitt (T6, D9): Schüsse mit Probe, Scheiben und Tage. Keine Netto-Zeit, sie folgt
 * aus den Abständen. Abschnitte in der Folge ihrer ersten Scheibe.
 */
export function trainingVolume(
  cards: readonly PeriodCard[],
  bucketOf: (atMs: number) => string,
  dayOf: (atMs: number) => string
): VolumeBucket[] {
  return [...groupBy(byStart(cards), (card) => bucketOf(card.startedAtMs))].map(([key, group]) => ({
    key,
    shots: group.reduce((sum, card) => sum + card.shots.length, 0),
    cards: group.length,
    days: new Set(group.map((card) => dayOf(card.startedAtMs))).size,
  }))
}
