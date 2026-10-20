// Verlauf in der Einheit: Serienkurve, Ermüdung, Trend in der Scheibe, gleitender Schnitt, Streuung
// und Schwerpunkt je Serie, längste Folge über einer Schwelle (Katalog I1–I6, I10). Grundlage sind
// die Wertungsschüsse in Abgabefolge, Werte in der gewählten Wertung. Einzelne Scheiben sind
// verrauscht: Ermüdung und Trend heißen nur „klar“, wenn ein Test es zeigt, und auch dann gilt es für
// diese Scheibe. Der Trend heißt „klar“, wenn Mann-Kendall (zweiseitig, 95 %) eine Richtung zeigt und die
// Ausgleichsgerade ihr folgt, die Ermüdung, wenn Mann-Whitney sie zeigt und das Mittel ihr folgt.

import { centroid, r50, type Point } from "../geometry"
import {
  inShotOrder,
  selectShots,
  shotNumbers,
  type MetricShot,
  type Scoring,
  type ShotKind,
} from "../metrics"
import { leastSquaresSlope, mannKendall, mannWhitney, Z95 } from "../stats"
import { valueNeed, valueRings, valueTenths } from "./values"

const MATCH: readonly ShotKind[] = ["match"]

// Erst die ganze Karte ordnen, dann auswählen: dieselbe Reihenfolge wie `shotNumbers`
const valued = (shots: readonly MetricShot[], scoring: Scoring) =>
  selectShots(inShotOrder(shots), { kinds: MATCH, need: valueNeed(scoring) })
const point = (shot: MetricShot): Point => ({ xUm: shot.xUm as number, yUm: shot.yUm as number })
const meanOf = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / values.length

export interface SeriesPoint {
  series: number
  /** alle Wertungsschüsse der Serie, auch die ohne Wert */
  shots: number
  /** Summe in Ringen, in der gewählten Wertung (105,0 bzw. 100); null, wenn einem Schuss der Wert fehlt */
  total: number | null
}

/** Serienergebnisse in Reihenfolge (I1); eine Summe nur, wenn alle Schüsse der Serie einen Wert haben */
export function seriesCurve(shots: readonly MetricShot[], scoring: Scoring): SeriesPoint[] {
  const withValue = new Set(selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) }))
  // in Zehnteln summiert, damit 0,1 + 0,2 genau bleibt
  const bySeries = new Map<
    number,
    { series: number; shots: number; tenths: number; complete: boolean }
  >()
  for (const shot of shots) {
    if (shot.kind !== "match" || shot.series === null) continue
    const entry = bySeries.get(shot.series) ?? {
      series: shot.series,
      shots: 0,
      tenths: 0,
      complete: true,
    }
    entry.shots++
    if (withValue.has(shot)) entry.tenths += valueTenths(shot, scoring)
    else entry.complete = false
    bySeries.set(shot.series, entry)
  }
  return [...bySeries.values()]
    .sort((a, b) => a.series - b.series)
    .map((e) => ({ series: e.series, shots: e.shots, total: e.complete ? e.tenths / 10 : null }))
}

/**
 * Ermüdung (I2): Ø der letzten zehn minus der ersten zehn, R50 ebenso; ab 20 Wertungsschüssen. „Klar“ nach
 * Mann-Whitney über die Werte (zweiseitig, 95 %, zehn gegen zehn genau ausgezählt), und nur, wenn das Mittel
 * dieselbe Richtung zeigt: Ein sehr schwacher Schuss kann das Mittel gegen die Ränge kippen. R50 ohne Urteil.
 */
export function fatigue(
  shots: readonly MetricShot[],
  scoring: Scoring
): {
  n: number
  firstMeanRings: number
  lastMeanRings: number
  deltaRings: number
  deltaR50Um: number | null
  clear: boolean
  /** Richtung des Werts am Ende, nur wenn klar */
  direction: "up" | "down" | null
} | null {
  // in Zehnteln summiert: gleiche Mittel ergeben genau 0, nicht ±1e-15, und das Vorzeichen bleibt ehrlich
  const values = valued(shots, scoring).map((shot) => valueTenths(shot, scoring))
  if (values.length < 20) return null
  const first = values.slice(0, 10)
  const last = values.slice(-10)
  const sumOf = (list: readonly number[]) => list.reduce((s, v) => s + v, 0)
  const deltaTenths = sumOf(last) - sumOf(first)
  const firstMeanRings = sumOf(first) / 100
  const lastMeanRings = sumOf(last) / 100
  const deltaRings = deltaTenths / 100
  const test = mannWhitney(last, first)
  // wie beim Trend: ein Urteil nur, wenn Test und Mittel in dieselbe Richtung zeigen
  const side = test ? Math.sign(test.u - (last.length * first.length) / 2) : 0
  const clear = test !== null && test.p < 0.05 && side !== 0 && side === Math.sign(deltaTenths)
  const positioned = selectShots(inShotOrder(shots), {
    kinds: MATCH,
    need: "position",
    excludeMisses: true,
  }).map(point)
  const deltaR50Um =
    positioned.length >= 20
      ? (r50(positioned.slice(-10)) as number) - (r50(positioned.slice(0, 10)) as number)
      : null
  return {
    n: values.length,
    firstMeanRings,
    lastMeanRings,
    deltaRings,
    deltaR50Um,
    clear,
    direction: clear ? (deltaRings > 0 ? "up" : "down") : null,
  }
}

/**
 * Trend in der Scheibe (I3): Steigung der Ausgleichsgeraden mal zehn, also wie sich der Wert je Schuss über
 * zehn Schuss ändert (nicht die Summe einer Serie); „klar“ nach
 * Mann-Kendall mit Korrektur für gleiche Werte (zweiseitig, 95 %), dann mit Richtung. Zeigt die
 * Gerade in die andere Richtung als der Test (ein sehr schwacher Schuss am Rand kann sie kippen),
 * gibt es kein Urteil: Neben „klar steigend“ stünde sonst eine fallende Zahl. Ab 10 Schuss. Die
 * x-Werte sind die Schussnummern, damit ein Schuss ohne Wert die Steigung nicht verbiegt. Ein
 * Sen-Intervall gibt es nicht: Bei vielen gleichen Werten (ganze Ringe) läge seine Grenze auf
 * 0, und selbst die stärkste Stufe hieße „nicht klar“.
 */
export function cardTrend(
  shots: readonly MetricShot[],
  scoring: Scoring
): { n: number; perTenShots: number; clear: boolean; direction: "up" | "down" | null } | null {
  const numbers = shotNumbers(shots)
  const ordered = valued(shots, scoring)
  if (ordered.length < 10) return null
  const ys = ordered.map((shot) => valueRings(shot, scoring))
  const slope = leastSquaresSlope(
    ordered.map((shot) => numbers.get(shot) as number),
    ys
  )
  const test = mannKendall(ys)
  if (slope === null || test === null) return null
  const clear = Math.abs(test.z) > Z95 && Math.sign(slope) === Math.sign(test.s)
  return {
    n: ordered.length,
    perTenShots: slope * 10,
    clear,
    direction: clear ? (test.s > 0 ? "up" : "down") : null,
  }
}

/**
 * Gleitender Schnitt (I4): je Schuss mit Wert Ø der letzten bis zu `window` Werte, am Anfang als
 * Teilfenster gekennzeichnet; `number` ist die Schussnummer.
 */
export function movingAverage(
  shots: readonly MetricShot[],
  scoring: Scoring,
  window = 10
): { number: number; value: number; meanRings: number; partial: boolean }[] {
  if (!(Number.isInteger(window) && window >= 1)) {
    throw new RangeError(`Fenster ${window} ist keine ganze Zahl ab 1`)
  }
  const numbers = shotNumbers(shots)
  const ordered = valued(shots, scoring)
  const values = ordered.map((shot) => valueTenths(shot, scoring))
  return values.map((tenths, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return {
      number: numbers.get(ordered[i]) as number,
      value: tenths / 10,
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

/**
 * Längste Folge von Wertungsschüssen ab einer Schwelle in Zehnteln (I10), mit Nummer des ersten. In
 * ganzen Ringen zählt der Ring (siehe `shareAtLeast`). Ein Schuss ohne Wert unterbricht die Folge.
 */
export function longestRun(
  shots: readonly MetricShot[],
  scoring: Scoring,
  tenths: number
): { length: number; start: number | null } {
  const withValue = new Set(selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) }))
  const numbers = shotNumbers(shots)
  const match = shots
    .filter((shot) => shot.kind === "match")
    .sort((a, b) => (numbers.get(a) as number) - (numbers.get(b) as number))
  let best = { length: 0, start: null as number | null }
  let current = 0
  let start = 0
  for (const shot of match) {
    if (withValue.has(shot) && valueTenths(shot, scoring) >= tenths) {
      if (current === 0) start = numbers.get(shot) as number
      current++
      if (current > best.length) best = { length: current, start }
    } else {
      current = 0
    }
  }
  return best
}
