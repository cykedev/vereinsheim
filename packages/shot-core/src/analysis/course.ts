// Verlauf in der Einheit: Serienkurve, Ermüdung, Trend in der Scheibe, gleitender Schnitt, Streuung und
// Schwerpunkt je Serie, längste Folge über einer Schwelle (Katalog I1–I6, I10). Grundlage sind die
// Wertungsschüsse in Abgabefolge. Einzelne Scheiben sind verrauscht: Ermüdung und Trend sagen erst als
// Muster über mehrere Scheiben etwas, der Trend nur „klar“, wenn sein Intervall die 0 ausschließt.

import { centroid, r50, type Point } from "../geometry"
import { inShotOrder, selectShots, type MetricShot, type ShotKind } from "../metrics"
import { theilSen } from "../stats"

const MATCH: readonly ShotKind[] = ["match"]

const valued = (shots: readonly MetricShot[]) =>
  inShotOrder(selectShots(shots, { kinds: MATCH, need: "decimal" }))
const point = (shot: MetricShot): Point => ({ xUm: shot.xUm as number, yUm: shot.yUm as number })
const meanOf = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / values.length

export interface SeriesPoint {
  series: number
  shots: number
  /** Summe der Zehntelwerte (1050 = 105,0) */
  tenths: number
  rings: number
}

/** Serienergebnisse in Reihenfolge (I1) */
export function seriesCurve(shots: readonly MetricShot[]): SeriesPoint[] {
  const bySeries = new Map<number, SeriesPoint>()
  for (const shot of valued(shots)) {
    if (shot.series === null) continue
    const tenths = shot.decimalTenths as number
    const entry = bySeries.get(shot.series) ?? {
      series: shot.series,
      shots: 0,
      tenths: 0,
      rings: 0,
    }
    entry.shots++
    entry.tenths += tenths
    entry.rings += shot.ring ?? Math.floor(tenths / 10)
    bySeries.set(shot.series, entry)
  }
  return [...bySeries.values()].sort((a, b) => a.series - b.series)
}

/** Ermüdung (I2): Ø der letzten zehn minus der ersten zehn, R50 ebenso; ab 20 Wertungsschüssen */
export function fatigue(shots: readonly MetricShot[]): {
  n: number
  firstMeanRings: number
  lastMeanRings: number
  deltaRings: number
  deltaR50Um: number | null
} | null {
  const values = valued(shots).map((shot) => (shot.decimalTenths as number) / 10)
  if (values.length < 20) return null
  const firstMeanRings = meanOf(values.slice(0, 10))
  const lastMeanRings = meanOf(values.slice(-10))
  const positioned = inShotOrder(
    selectShots(shots, { kinds: MATCH, need: "position", excludeMisses: true })
  ).map(point)
  const deltaR50Um =
    positioned.length >= 20
      ? (r50(positioned.slice(-10)) as number) - (r50(positioned.slice(0, 10)) as number)
      : null
  return {
    n: values.length,
    firstMeanRings,
    lastMeanRings,
    deltaRings: lastMeanRings - firstMeanRings,
    deltaR50Um,
  }
}

/** Trend in der Scheibe (I3): Theil-Sen-Steigung je zehn Schuss mit 95-%-Intervall; ab 10 Schuss */
export function cardTrend(
  shots: readonly MetricShot[]
): { n: number; perTenShots: number; low: number; high: number; clear: boolean } | null {
  const values = valued(shots).map((shot) => (shot.decimalTenths as number) / 10)
  if (values.length < 10) return null
  const fit = theilSen(
    values.map((_, i) => i + 1),
    values
  )
  if (!fit) return null
  return {
    n: values.length,
    perTenShots: fit.slope * 10,
    low: fit.low * 10,
    high: fit.high * 10,
    clear: fit.low > 0 || fit.high < 0,
  }
}

/** Gleitender Schnitt (I4): je Schuss Ø der letzten bis zu `window`, am Anfang als Teilfenster */
export function movingAverage(
  shots: readonly MetricShot[],
  window = 10
): { number: number; decimalTenths: number; meanRings: number; partial: boolean }[] {
  const values = valued(shots).map((shot) => shot.decimalTenths as number)
  return values.map((decimalTenths, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return {
      number: i + 1,
      decimalTenths,
      meanRings: meanOf(slice) / 10,
      partial: slice.length < window,
    }
  })
}

const bySeriesPositioned = (shots: readonly MetricShot[], excludeMisses: boolean) => {
  const groups = new Map<number, Point[]>()
  for (const shot of selectShots(shots, { kinds: MATCH, need: "position", excludeMisses })) {
    if (shot.series === null) continue
    const list = groups.get(shot.series) ?? []
    list.push(point(shot))
    groups.set(shot.series, list)
  }
  return [...groups].sort((a, b) => a[0] - b[0])
}

/** R50 je Serie (I5), ohne Fehlschüsse; unter fünf Schuss kein Wert */
export function seriesSpread(
  shots: readonly MetricShot[]
): { series: number; n: number; r50Um: number | null }[] {
  return bySeriesPositioned(shots, true).map(([series, points]) => ({
    series,
    n: points.length,
    r50Um: points.length >= 5 ? r50(points) : null,
  }))
}

/** Schwerpunkt je Serie und sein Abstand zum Schwerpunkt der Scheibe (I6) */
export function mpiPath(
  shots: readonly MetricShot[]
): { series: number; n: number; center: Point; offsetUm: number }[] {
  const groups = bySeriesPositioned(shots, false)
  const all = groups.flatMap(([, points]) => points)
  const card = centroid(all)
  if (!card) return []
  return groups.flatMap(([series, points]) => {
    if (points.length < 2) return []
    const center = centroid(points) as Point
    return [
      {
        series,
        n: points.length,
        center,
        offsetUm: Math.hypot(center.xUm - card.xUm, center.yUm - card.yUm),
      },
    ]
  })
}

/** Längste Folge von Wertungsschüssen ab einem Zehntelwert (I10), mit Nummer des ersten */
export function longestRun(
  shots: readonly MetricShot[],
  tenths: number
): { length: number; start: number | null } {
  let best = { length: 0, start: null as number | null }
  let current = 0
  valued(shots).forEach((shot, i) => {
    if ((shot.decimalTenths as number) >= tenths) {
      current++
      if (current > best.length) best = { length: current, start: i - current + 2 }
    } else {
      current = 0
    }
  })
  return best
}
