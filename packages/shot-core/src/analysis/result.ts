// Auswertungen zum Ergebnis: Ringverteilung und Zehntelverteilung, bester und schwächster Schuss,
// Teiler, Ringverlust, Konstanz der Serien und Quoten (Katalog V1, V2, E4, E6–E11). Grundlage sind
// die Wertungsschüsse; verdächtige Schüsse zählen nur mit ihrem Wert (SF-15). Was vom Wert abhängt,
// rechnet in der gewählten Wertung (ganze Ringe oder Zehntel).

import { standardDeviation } from "../geometry"
import {
  inShotOrder,
  selectShots,
  shotDistanceUm,
  type MetricShot,
  type Scoring,
  type ShotKind,
} from "../metrics"
import { teilerFromDistanceUm } from "../scoring"
import { mad, wilson } from "../stats"
import { MAX_DECIMAL_TENTHS } from "../targets"
import { seriesCurve, type SeriesPoint } from "./course"
import { valueNeed, valueRings, valueTenths } from "./values"

const MATCH: readonly ShotKind[] = ["match"]

export interface RingDistribution {
  n: number
  /** Index = Ring 0 … 10 */
  counts: number[]
  innerTens: number
}

export function ringDistribution(shots: readonly MetricShot[]): RingDistribution {
  const counted = selectShots(shots, { kinds: MATCH, need: "ring" })
  const counts = new Array<number>(11).fill(0)
  for (const shot of counted) counts[Math.min(10, Math.max(0, shot.ring as number))]++
  return { n: counted.length, counts, innerTens: counted.filter((shot) => shot.innerTen).length }
}

/** Zählung je Zehntelwert 0 … 109 (Index = Wert in Zehnteln) */
export function decimalHistogram(shots: readonly MetricShot[]): { n: number; counts: number[] } {
  const counted = selectShots(shots, { kinds: MATCH, need: "decimal" })
  const counts = new Array<number>(MAX_DECIMAL_TENTHS + 1).fill(0)
  for (const shot of counted) {
    counts[Math.min(MAX_DECIMAL_TENTHS, Math.max(0, shot.decimalTenths as number))]++
  }
  return { n: counted.length, counts }
}

/** Nummer eines Wertungsschusses in der Abgabefolge, ab 1 */
function matchNumbers(shots: readonly MetricShot[]): Map<MetricShot, number> {
  const match = inShotOrder(shots.filter((shot) => shot.kind === "match"))
  return new Map(match.map((shot, i) => [shot, i + 1]))
}

export interface ShotRef {
  number: number
  /** Wert in Ringen, in der gewählten Wertung */
  value: number
}

export interface TeilerRef {
  number: number
  teiler: number
}

export interface ShotExtremes {
  best: ShotRef
  worst: ShotRef
  /** die drei kleinsten Teiler, aufsteigend */
  bestTeiler: TeilerRef[]
  /** die drei größten Teiler, absteigend */
  widestTeiler: TeilerRef[]
}

/** Bei gleichem Wert zählt der frühere Schuss. */
export function shotExtremes(shots: readonly MetricShot[], scoring: Scoring): ShotExtremes | null {
  const numbers = matchNumbers(shots)
  const valued = selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) })
    .map((shot) => ({ number: numbers.get(shot) as number, tenths: valueTenths(shot, scoring) }))
    .sort((a, b) => a.number - b.number)
  if (valued.length === 0) return null
  const top = valued.reduce((high, shot) => (shot.tenths > high.tenths ? shot : high))
  const low = valued.reduce((min, shot) => (shot.tenths < min.tenths ? shot : min))
  const best = { number: top.number, value: top.tenths / 10 }
  const worst = { number: low.number, value: low.tenths / 10 }
  const teiler = selectShots(shots, { kinds: MATCH, need: "distance" })
    .map((shot) => ({
      number: numbers.get(shot) as number,
      teiler: teilerFromDistanceUm(shotDistanceUm(shot)),
    }))
    .sort((a, b) => a.teiler - b.teiler || a.number - b.number)
  return {
    best,
    worst,
    bestTeiler: teiler.slice(0, 3),
    widestTeiler: teiler.slice(-3).reverse(),
  }
}

export function teilerStats(
  shots: readonly MetricShot[]
): { n: number; mean: number; median: number } | null {
  const values = selectShots(shots, { kinds: MATCH, need: "distance" }).map((shot) =>
    teilerFromDistanceUm(shotDistanceUm(shot))
  )
  if (values.length === 0) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return {
    n: values.length,
    mean: values.reduce((sum, v) => sum + v, 0) / values.length,
    median:
      ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2,
  }
}

/**
 * Ringverlust: n · 10 − Σ Ring bzw. n · 10,9 − Σ Wert. Wie eine Summe nur, wenn allen Wertungsschüssen
 * der Wert bekannt ist; sonst kein Wert.
 */
export function ringLoss(
  shots: readonly MetricShot[],
  scoring: "rings" | "decimal"
): { n: number; loss: number } | null {
  const need = scoring === "rings" ? "ring" : "decimal"
  const counting = shots.filter((shot) => shot.kind === "match")
  const valued = selectShots(shots, { kinds: MATCH, need })
  if (valued.length === 0 || valued.length < counting.length) return null
  if (scoring === "rings") {
    return {
      n: valued.length,
      loss: valued.length * 10 - valued.reduce((s, x) => s + (x.ring as number), 0),
    }
  }
  const tenths = valued.reduce((s, x) => s + (x.decimalTenths as number), 0)
  return { n: valued.length, loss: (valued.length * MAX_DECIMAL_TENTHS - tenths) / 10 }
}

export interface SeriesConsistency {
  series: SeriesPoint[]
  /** Zahl der verglichenen Serien: die mit der häufigsten Länge */
  compared: number
  /** Standardabweichung und Spanne der verglichenen Serien in Ringen */
  sd: number | null
  range: number | null
  /** MAD der einzelnen Schusswerte in Ringen */
  mad: number | null
}

/** Konstanz: nur Serien gleicher Länge sind vergleichbar; eine kurze Restserie zählt nicht mit. */
export function seriesConsistency(
  shots: readonly MetricShot[],
  scoring: Scoring
): SeriesConsistency | null {
  const series = seriesCurve(shots, scoring)
  if (series.length === 0) return null
  const lengths = new Map<number, number>()
  for (const s of series) lengths.set(s.shots, (lengths.get(s.shots) ?? 0) + 1)
  const modal = [...lengths].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
  const totals = series.filter((s) => s.shots === modal).map((s) => s.total)
  const valued = selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) })
  return {
    series,
    compared: totals.length,
    sd: totals.length >= 2 ? standardDeviation(totals) : null,
    range: totals.length >= 2 ? Math.max(...totals) - Math.min(...totals) : null,
    mad: mad(valued.map((shot) => valueRings(shot, scoring))),
  }
}

/**
 * Anteil der Wertungsschüsse ab einer Schwelle in Zehnteln, mit Wilson-Intervall (E4 mit 100, E11).
 * In ganzen Ringen zählt der Ring: 10,0 heißt Ring 10, eine Schwelle wie 10,5 erreicht keiner.
 */
export function shareAtLeast(
  shots: readonly MetricShot[],
  scoring: Scoring,
  tenths: number
): { n: number; count: number; rate: number; low: number; high: number } | null {
  const valued = selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) })
  const count = valued.filter((shot) => valueTenths(shot, scoring) >= tenths).length
  const interval = wilson(count, valued.length)
  if (interval === null) return null
  return { n: valued.length, count, rate: count / valued.length, ...interval }
}
