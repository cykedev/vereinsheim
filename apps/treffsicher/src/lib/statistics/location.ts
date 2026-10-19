// Trefferlage über den Zeitraum: die Lage vom Ausdruck je Einheit (mm, rechts und hoch positiv), ihr Mittel und je
// Achse der Verlauf mit dem Schnitt der letzten fünf und dem Formband aus dem Fachkern (`periodTrend`), wie der Verlauf
// der Seite. Ersetzt Wolke und Trend der alten Statistik.

import { periodTrend, type TrendPoint } from "@vereinsheim/shot-core/analysis"

export interface LocationPoint {
  id: string
  atMs: number
  xMm: number
  yMm: number
}

export interface LocationSummary {
  /** Einheiten mit Trefferlage in zeitlicher Folge */
  points: LocationPoint[]
  /** Mittel aller Lagen; null ohne Einheit */
  mean: { xMm: number; yMm: number } | null
  /** je Achse der Verlauf (Wert, Schnitt der letzten fünf, Formband) */
  course: { x: TrendPoint[]; y: TrendPoint[] }
}

export function locationSummary(
  items: readonly {
    id: string
    startedAtMs: number
    location: { xMm: number; yMm: number } | null
  }[]
): LocationSummary {
  const points = items
    .flatMap((item) =>
      item.location
        ? [{ id: item.id, atMs: item.startedAtMs, xMm: item.location.xMm, yMm: item.location.yMm }]
        : []
    )
    .sort((a, b) => a.atMs - b.atMs || (a.id < b.id ? -1 : 1))
  const mean = points.length
    ? {
        xMm: points.reduce((sum, p) => sum + p.xMm, 0) / points.length,
        yMm: points.reduce((sum, p) => sum + p.yMm, 0) / points.length,
      }
    : null
  const axis = (pick: (p: LocationPoint) => number) =>
    periodTrend(points.map((p) => ({ id: p.id, atMs: p.atMs, value: pick(p), n: 1 }))).points
  return { points, mean, course: { x: axis((p) => p.xMm), y: axis((p) => p.yMm) } }
}
