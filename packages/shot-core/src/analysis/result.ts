// Auswertungen zum Ergebnis: Ringverteilung und Zehntelverteilung, beste und weiteste Teiler, Konstanz
// der Serien und Quoten (Katalog V1, V2, E4, E8, E10, E11); den Ringverlust (E9) liefert `ringLossSplit`
// als Summe aus Lage und Streuung. Grundlage sind
// die Wertungsschüsse; verdächtige Schüsse zählen nur mit ihrem Wert (SF-15). Was vom Wert abhängt,
// rechnet in der gewählten Wertung (ganze Ringe oder Zehntel).

import { standardDeviation } from "../geometry"
import {
  selectShots,
  shotDistanceUm,
  shotNumbers,
  type MetricShot,
  type Scoring,
  type ShotKind,
} from "../metrics"
import { teilerFromDistanceUm } from "../scoring"
import { modalLength, wilson } from "../stats"
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

export interface TeilerRef {
  number: number
  teiler: number
}

export interface ShotExtremes {
  /** die drei kleinsten Teiler, aufsteigend; der kleinste ist der beste Schuss */
  bestTeiler: TeilerRef[]
  /** die drei größten Teiler, absteigend; der größte ist der schwächste Schuss */
  widestTeiler: TeilerRef[]
}

/**
 * Beste und weiteste Teiler (E8), wie auf dem Meyton-Ausdruck; bei gleichem Teiler zuerst der frühere
 * Schuss. Verdächtige Schüsse (Platzhalter) haben keinen gültigen Abstand und zählen nicht (SF-15). Der
 * kleinste Teiler ist zugleich der beste Schuss, der größte der schwächste: Eine eigene Angabe über den
 * Wert (E6) und Teiler-Schnitt und -Median (E7) gibt es deshalb nicht.
 */
export function shotExtremes(shots: readonly MetricShot[]): ShotExtremes | null {
  const numbers = shotNumbers(shots)
  const teiler = selectShots(shots, { kinds: MATCH, need: "distance" }).map((shot) => ({
    number: numbers.get(shot) as number,
    teiler: teilerFromDistanceUm(shotDistanceUm(shot)),
  }))
  if (teiler.length === 0) return null
  return {
    bestTeiler: [...teiler].sort((a, b) => a.teiler - b.teiler || a.number - b.number).slice(0, 3),
    widestTeiler: [...teiler]
      .sort((a, b) => b.teiler - a.teiler || a.number - b.number)
      .slice(0, 3),
  }
}

export interface SeriesConsistency {
  series: SeriesPoint[]
  /** Zahl der verglichenen Serien: die mit der häufigsten Länge */
  compared: number
  /** Standardabweichung und Spanne der verglichenen Serien in Ringen */
  sd: number | null
  range: number | null
  /**
   * Abweichung je Schuss (E10): Standardabweichung der Schusswerte in der Wertung (n − 1), in Ringen,
   * ab 2 Schuss mit Wert. Sagt, wie stark ein einzelner Schuss um den Schnitt schwankt; anders als der
   * MAD in ganzen Ringen auch beim Luftgewehr nicht fast immer 0.
   */
  shotSd: number | null
}

/**
 * Konstanz: nur Serien gleicher Länge sind vergleichbar; eine kurze Restserie zählt nicht mit, eine
 * Serie ohne Summe (einem Schuss fehlt der Wert) auch nicht.
 */
export function seriesConsistency(
  shots: readonly MetricShot[],
  scoring: Scoring
): SeriesConsistency | null {
  const series = seriesCurve(shots, scoring)
  if (series.length === 0) return null
  const modal = modalLength(series.map((s) => s.shots)) as number
  const totals = series.flatMap((s) => (s.shots === modal && s.total !== null ? [s.total] : []))
  const valued = selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) })
  return {
    series,
    compared: totals.length,
    sd: totals.length >= 2 ? standardDeviation(totals) : null,
    range: totals.length >= 2 ? Math.max(...totals) - Math.min(...totals) : null,
    shotSd: standardDeviation(valued.map((shot) => valueRings(shot, scoring))),
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
