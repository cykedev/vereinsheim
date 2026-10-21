// Dichte der Treffer über viele Scheiben als Raster (L9): Punkte in Zellen zählen, dann mit einem Gauß-Kern glätten.
// Das Raster geht an den Browser; daraus zeichnet `shot-ui` die Heatmap in fünf Bändern. Nicht über `./analysis`
// exportiert: Hilfen der Auswertung `periodPattern`, keine eigene Auswertung.

import type { Point } from "../geometry"
import { quantile } from "../stats"

export interface DensityGrid {
  /** Kantenlänge in Zellen */
  size: number
  /** Zeile für Zeile, Zeile 0 oben (größtes y), Werte 0–255 relativ zur dichtesten Zelle */
  cells: number[]
  /**
   * die Grenzen der Bänder der Heatmap, von außen nach innen (`HEAT_SHARES`): ab `levels[i]` liegt der Anteil
   * `HEAT_SHARES[i]` der geglätteten Masse, im selben Maßstab 0–255
   */
  levels: number[]
}

/**
 * Anteile der Masse, die die Bänder der Heatmap von außen nach innen umschließen; das äußerste, ganz leichte reicht bis
 * zu den seltenen Schüssen (99 von 100)
 */
export const HEAT_SHARES = [0.99, 0.9, 0.75, 0.5, 0.25, 0.1] as const

/** kleinste Bandbreite in Zellen: sonst bleibt bei wenigen, eng liegenden Punkten jede Zelle allein */
const MIN_BANDWIDTH_CELLS = 0.75
/**
 * etwas stärker geglättet als nach Silverman: Die Flächen sollen die Form der Gruppe zeigen, nicht das Rauschen
 * einzelner Abende; die Anteile innerhalb der Flächen bleiben nahe der Hälfte und neun Zehnteln (Test)
 */
const SMOOTHING = 1.3

/** Gauß-Kern bis drei Bandbreiten, auf Summe 1 */
function kernel(bandwidth: number): number[] {
  const reach = Math.ceil(3 * bandwidth)
  const weights = Array.from({ length: 2 * reach + 1 }, (_, i) =>
    Math.exp(-0.5 * ((i - reach) / bandwidth) ** 2)
  )
  const sum = weights.reduce((s, w) => s + w, 0)
  return weights.map((w) => w / sum)
}

/** eine Richtung glätten (`step` 1: in der Zeile, `size`: in der Spalte); außerhalb des Rasters ist nichts */
function blur(values: readonly number[], size: number, weights: readonly number[], step: number) {
  const reach = (weights.length - 1) / 2
  const out = new Array<number>(values.length).fill(0)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const along = step === 1 ? col : row
      let sum = 0
      for (let k = -reach; k <= reach; k++) {
        const at = along + k
        if (at < 0 || at >= size) continue
        sum += weights[k + reach] * values[row * size + col + k * step]
      }
      out[row * size + col] = sum
    }
  }
  return out
}

/** der kleinste Wert, ab dem die Zellen zusammen den Anteil `share` der Masse halten */
function massLevel(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => b - a)
  const total = sorted.reduce((s, v) => s + v, 0)
  let sum = 0
  for (const value of sorted) {
    sum += value
    if (sum >= share * total) return value
  }
  return 0
}

/**
 * Dichte der Punkte in einem Quadrat um die Mitte der Scheibe mit halber Kantenlänge `halfUm`, `size` × `size` Zellen.
 * Die Bandbreite ist 1,3-mal die nach Silverman für zwei Dimensionen (σ̂ · n^(−1/6) mit σ̂ = √((s²ₓ + s²ᵧ)/2)),
 * mindestens 0,75 Zellen. Punkte außerhalb des Quadrats zählen nicht.
 */
export function densityGrid(points: readonly Point[], halfUm: number, size = 64): DensityGrid {
  const cell = (2 * halfUm) / size
  const counts = new Array<number>(size * size).fill(0)
  for (const p of points) {
    const col = Math.floor((p.xUm + halfUm) / cell)
    const row = Math.floor((halfUm - p.yUm) / cell)
    if (col < 0 || col >= size || row < 0 || row >= size) continue
    counts[row * size + col]++
  }
  const n = points.length
  let bandwidth = MIN_BANDWIDTH_CELLS
  if (n >= 2) {
    const mean = (pick: (p: Point) => number) => points.reduce((s, p) => s + pick(p), 0) / n
    const mx = mean((p) => p.xUm)
    const my = mean((p) => p.yUm)
    const variance =
      points.reduce((s, p) => s + (p.xUm - mx) ** 2 + (p.yUm - my) ** 2, 0) / (2 * (n - 1))
    bandwidth = Math.max(
      MIN_BANDWIDTH_CELLS,
      (SMOOTHING * Math.sqrt(variance) * n ** (-1 / 6)) / cell
    )
  }
  const weights = kernel(bandwidth)
  const smooth = blur(blur(counts, size, weights, 1), size, weights, size)
  const max = Math.max(...smooth)
  if (!(max > 0)) return { size, cells: counts.map(() => 0), levels: HEAT_SHARES.map(() => 0) }
  const scale = (value: number) => Math.round((value / max) * 255)
  return {
    size,
    cells: smooth.map(scale),
    levels: HEAT_SHARES.map((share) => Math.max(1, scale(massLevel(smooth, share)))),
  }
}

/** der Wert des Rasters an einer Stelle; außerhalb 0 */
export function cellValue(grid: DensityGrid, halfUm: number, p: Point): number {
  const cell = (2 * halfUm) / grid.size
  const col = Math.floor((p.xUm + halfUm) / cell)
  const row = Math.floor((halfUm - p.yUm) / cell)
  if (col < 0 || col >= grid.size || row < 0 || row >= grid.size) return 0
  return grid.cells[row * grid.size + col]
}

/**
 * halbe Kantenlänge des Ausschnitts: 99 % der Punkte und Rand, mindestens 1 mm; der Rand ist so breit, dass auch das
 * geglättete äußerste Band ins Bild passt
 */
export function patternHalf(points: readonly Point[]): number {
  const p99 = quantile(
    points.map((p) => Math.hypot(p.xUm, p.yUm)),
    0.99
  )
  return Math.max(1000, (p99 ?? 0) * 1.35)
}
