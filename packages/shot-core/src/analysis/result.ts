// Auswertungen zum Ergebnis: Ringverteilung und Zehntelverteilung, bester und schwächster Schuss,
// Teiler, Ringverlust, Konstanz der Serien und Quoten (Katalog V1, V2, E4, E6–E11). Grundlage sind
// die Wertungsschüsse; verdächtige Schüsse zählen nur mit ihrem Wert (SF-15).

import { standardDeviation } from "../geometry"
import {
  inShotOrder,
  selectShots,
  shotDistanceUm,
  type MetricShot,
  type ShotKind,
} from "../metrics"
import { teilerFromDistanceUm } from "../scoring"
import { mad, wilson } from "../stats"
import { MAX_DECIMAL_TENTHS } from "../targets"

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
  decimalTenths: number
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
export function shotExtremes(shots: readonly MetricShot[]): ShotExtremes | null {
  const numbers = matchNumbers(shots)
  const valued = selectShots(shots, { kinds: MATCH, need: "decimal" })
    .map((shot) => ({
      number: numbers.get(shot) as number,
      decimalTenths: shot.decimalTenths as number,
    }))
    .sort((a, b) => a.number - b.number)
  if (valued.length === 0) return null
  const best = valued.reduce((top, shot) => (shot.decimalTenths > top.decimalTenths ? shot : top))
  const worst = valued.reduce((low, shot) => (shot.decimalTenths < low.decimalTenths ? shot : low))
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

export interface SeriesTotal {
  series: number
  shots: number
  /** Summe der Zehntelwerte (1000 = 100,0) */
  tenths: number
}

export interface SeriesConsistency {
  series: SeriesTotal[]
  /** Zahl der verglichenen Serien: die mit der häufigsten Länge */
  compared: number
  /** Standardabweichung und Spanne der verglichenen Serien in Ringen (Zehntelwertung) */
  sd: number | null
  range: number | null
  /** MAD der einzelnen Schusswerte in Ringen */
  mad: number | null
}

/** Konstanz: nur Serien gleicher Länge sind vergleichbar; eine kurze Restserie zählt nicht mit. */
export function seriesConsistency(shots: readonly MetricShot[]): SeriesConsistency | null {
  const valued = selectShots(shots, { kinds: MATCH, need: "decimal" })
  const bySeries = new Map<number, SeriesTotal>()
  for (const shot of valued) {
    if (shot.series === null) continue
    const total = bySeries.get(shot.series) ?? { series: shot.series, shots: 0, tenths: 0 }
    total.shots++
    total.tenths += shot.decimalTenths as number
    bySeries.set(shot.series, total)
  }
  if (bySeries.size === 0) return null
  const series = [...bySeries.values()].sort((a, b) => a.series - b.series)
  const lengths = new Map<number, number>()
  for (const s of series) lengths.set(s.shots, (lengths.get(s.shots) ?? 0) + 1)
  const modal = [...lengths].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
  const totals = series.filter((s) => s.shots === modal).map((s) => s.tenths / 10)
  return {
    series,
    compared: totals.length,
    sd: totals.length >= 2 ? standardDeviation(totals) : null,
    range: totals.length >= 2 ? Math.max(...totals) - Math.min(...totals) : null,
    mad: mad(valued.map((shot) => (shot.decimalTenths as number) / 10)),
  }
}

/** Anteil der Wertungsschüsse ab einem Zehntelwert, mit Wilson-Intervall (E4 mit 100, E11) */
export function shareAtLeast(
  shots: readonly MetricShot[],
  tenths: number
): { n: number; count: number; rate: number; low: number; high: number } | null {
  const valued = selectShots(shots, { kinds: MATCH, need: "decimal" })
  const count = valued.filter((shot) => (shot.decimalTenths as number) >= tenths).length
  const interval = wilson(count, valued.length)
  if (interval === null) return null
  return { n: valued.length, count, rate: count / valued.length, ...interval }
}
