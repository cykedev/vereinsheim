// Zwei Seiten im Vergleich (C2, C3): die Lage zweier Stichproben von Punkten, die Schüsse zweier Scheiben und das Bild
// beider Seiten. Die Funktionen nehmen Werte und Punkte, keine Scheiben einer App: Schüsse einer Scheibe (Einheit der
// Schuss) oder Mitten vieler Scheiben (Einheit die Scheibe). Lagen in µm, Mitte (0 | 0), x rechts, y oben.

import { centroid, distancesTo, type Point } from "../geometry"
import {
  asOnPrintout,
  eligibleShots,
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "../metrics"
import { quantile } from "../stats"
import { densityGrid, patternHalf, type DensityGrid } from "./density"
import { PATTERN_DENSITY_FROM, PATTERN_SHOTS_MAX } from "./pattern"
import { compareSamples, MIN_CARDS_PER_SIDE, type PeriodComparison } from "./period"

const ALPHA = 0.05

export interface CenterComparison {
  a: { n: number; center: Point }
  b: { n: number; center: Point }
  /** Mitte A − Mitte B */
  shiftUm: Point
  distanceUm: number
  /** Wahrscheinlichkeit, dass zwei Seiten mit derselben Mitte so weit auseinander liegen; null ohne Test */
  p: number | null
  verdict: "shifted" | "none" | "few"
}

/** Summe der Abweichungsquadrate und -produkte um die Mitte */
function scatter(points: readonly Point[], center: Point) {
  let xx = 0
  let yy = 0
  let xy = 0
  for (const p of points) {
    const dx = p.xUm - center.xUm
    const dy = p.yUm - center.yUm
    xx += dx * dx
    yy += dy * dy
    xy += dx * dy
  }
  return { xx, yy, xy }
}

/**
 * Lage zweier Seiten (C2 über Schüsse, C3 über die Mitten von Scheiben): Hotelling-T² für zwei Stichproben mit
 * gepoolter Kovarianz S = (Σ₁ + Σ₂)/(n₁ + n₂ − 2), T² = n₁n₂/(n₁ + n₂) · dᵀS⁻¹d, F = (n₁ + n₂ − 3)/(2(n₁ + n₂ − 2)) · T²
 * mit F(2, ν), ν = n₁ + n₂ − 3, geschlossen p = (1 + 2F/ν)^(−ν/2). Versetzt bei p < 0,05. Unter fünf Punkten je Seite
 * oder ohne Ausdehnung (alle auf einer Linie) kein Test. Ohne Punkte auf einer Seite null.
 */
export function compareCenters(a: readonly Point[], b: readonly Point[]): CenterComparison | null {
  if (!a.length || !b.length) return null
  const ca = centroid(a) as Point
  const cb = centroid(b) as Point
  const shiftUm = { xUm: ca.xUm - cb.xUm, yUm: ca.yUm - cb.yUm }
  const summary = {
    a: { n: a.length, center: ca },
    b: { n: b.length, center: cb },
    shiftUm,
    distanceUm: Math.hypot(shiftUm.xUm, shiftUm.yUm),
  }
  const few = { ...summary, p: null, verdict: "few" as const }
  if (a.length < MIN_CARDS_PER_SIDE || b.length < MIN_CARDS_PER_SIDE) return few
  const n1 = a.length
  const n2 = b.length
  const sa = scatter(a, ca)
  const sb = scatter(b, cb)
  const df = n1 + n2 - 2
  const sxx = (sa.xx + sb.xx) / df
  const syy = (sa.yy + sb.yy) / df
  const sxy = (sa.xy + sb.xy) / df
  const det = sxx * syy - sxy * sxy
  if (!(det > 1e-12 * sxx * syy)) return few
  const { xUm: dx, yUm: dy } = shiftUm
  const t2 = ((n1 * n2) / (n1 + n2)) * ((syy * dx * dx - 2 * sxy * dx * dy + sxx * dy * dy) / det)
  const nu = n1 + n2 - 3
  const f = (nu / (2 * df)) * t2
  const p = (1 + (2 * f) / nu) ** (-nu / 2)
  return { ...summary, p, verdict: p < ALPHA ? "shifted" : "none" }
}

/**
 * Seite A gegen Seite B (C2, C3): wie `compareSamples`, aber in der Lesart der Seite Vergleichen. `a` ist A, `b` ist B,
 * Δ = Mittel A − Mittel B, „höher“ heißt: A liegt höher. Ohne Werte auf einer Seite null.
 */
export function compareSides(a: readonly number[], b: readonly number[]): PeriodComparison | null {
  const result = compareSamples(b, a)
  return result && { ...result, a: result.b, b: result.a }
}

export interface ShotComparison {
  /** Ergebnis je Schuss in der Wertung, A gegen B */
  result: PeriodComparison | null
  /** Abstände der Schüsse zur Mitte ihrer Scheibe, A gegen B: „höher“ heißt, A streut mehr */
  spread: PeriodComparison | null
  /** Lage der Schüsse */
  position: CenterComparison | null
  /** Wertungsschüsse wie am Ausdruck */
  shots: { a: number; b: number }
}

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>

/** Werte und Lagen einer Scheibe für den Vergleich, aus den Wertungsschüssen wie am Ausdruck */
function sideOf(shots: readonly MetricShot[], scoring: Scoring) {
  const chosen = asOnPrintout(shots)
  const valued = eligibleShots(inScoring(metric("result.decimalMean"), scoring), chosen)
  const values = valued.map((shot) =>
    scoring === "decimal" ? (shot.decimalTenths as number) / 10 : (shot.ring as number)
  )
  // wie σ: mit Lage, ohne verdächtige und ohne Schüsse über der Soll-Zahl
  const points = eligibleShots(metric("group.sigma"), chosen).map((shot) => ({
    xUm: shot.xUm as number,
    yUm: shot.yUm as number,
  }))
  const center = centroid(points)
  return {
    shots: chosen.length,
    values,
    points,
    distances: center ? distancesTo(points, center) : [],
  }
}

/**
 * Zwei Scheiben Schuss für Schuss (C2): die Wertungsschüsse wie am Ausdruck. Ergebnis über die Werte der Schüsse in der
 * Wertung (wie Ø je Schuss), Streuung über die Abstände jedes Schusses zur Mitte seiner Scheibe (wie σ: mit Lage, ohne
 * verdächtige), Lage über die Lagen selbst (`compareCenters`). Jeweils A gegen B, ein Urteil ab fünf Schuss je Seite.
 */
export function compareShots(
  a: readonly MetricShot[],
  b: readonly MetricShot[],
  scoring: Scoring
): ShotComparison {
  const sa = sideOf(a, scoring)
  const sb = sideOf(b, scoring)
  return {
    result: compareSides(sa.values, sb.values),
    spread: compareSides(sa.distances, sb.distances),
    position: compareCenters(sa.points, sb.points),
    shots: { a: sa.shots, b: sb.shots },
  }
}

/** Raster der Punkte im Bild: 10 µm wie `cardMarks` */
const PICTURE_UM = 10

/** die Gruppe beider Seiten als Kreis: ihre gemeinsame Mitte und der Radius, den das Bild beim Zoomen zeigt */
export interface PictureFocus {
  xUm: number
  yUm: number
  radiusUm: number
}

/** eine Seite im Bild: als Umriss aus der Dichte (Raster wie `periodPattern`) oder jeder Schuss als Punkt */
export type SidePicture =
  | { kind: "outline"; grid: DensityGrid; center: Point }
  /** jeder Punkt als [x, y] in 10 µm; die Mitte null ohne Punkte */
  | { kind: "dots"; points: [number, number][]; center: Point | null }

/**
 * das Bild zweier Seiten: beide als Umriss, beide als Punkte oder gemischt (eine große Seite als Umriss, die kleine als
 * Punkte); dazu der Ausschnitt um die Mitte der Scheibe, der die Raster trägt, und die Gruppe beider Seiten zum Zoomen
 */
export interface ComparePicture {
  style: "outlines" | "dots" | "mixed"
  halfUm: number
  /** null ohne Punkte */
  focus: PictureFocus | null
  a: SidePicture
  b: SidePicture
}

const roundCenter = (points: readonly Point[]): Point | null => {
  const center = centroid(points)
  // `|| 0`: kein −0 (wie `cardMarks`)
  return center && { xUm: Math.round(center.xUm) || 0, yUm: Math.round(center.yUm) || 0 }
}

const dot = (p: Point): [number, number] => [
  Math.round(p.xUm / PICTURE_UM) || 0,
  Math.round(p.yUm / PICTURE_UM) || 0,
]

/**
 * die Gruppe beider Seiten: um die Mitte aller Punkte bis zum Anteil `share` der Abstände (bei Umrissen 95 von 100, ein
 * Abreißer macht die Gruppe nicht klein; bei Punkten alle, jeder Schuss steht im Bild); ohne Punkte null
 */
function focusOf(points: readonly Point[], share: number): PictureFocus | null {
  const center = centroid(points)
  if (!center) return null
  const radius = quantile(distancesTo(points, center), share) as number
  return {
    xUm: Math.round(center.xUm) || 0,
    yUm: Math.round(center.yUm) || 0,
    radiusUm: Math.round(radius),
  }
}

/**
 * Das Bild zweier Seiten für den Browser (C2, C3). Eine Seite wird Umriss (Hälfte und 9 von 10 Schüssen aus einem
 * Dichteraster), wenn sie mindestens 50 Punkte hat (`PATTERN_DENSITY_FROM`) und die andere auch, oder wenn sie mehr als
 * 3.000 hat (`PATTERN_SHOTS_MAX`): So gehen nie mehr als 3.000 Punkte einer Seite an den Browser, auch wenn wenige
 * Wettkämpfe gegen viel Training stehen. Sonst zeigt die Seite jeden Schuss als Punkt. Mit einem Umriss trägt
 * `patternHalf` über beide Seiten die Raster, sonst reicht der Ausschnitt bis zum weitesten Punkt. Zum Zoomen die Gruppe
 * beider Seiten: bei Umrissen bis 95 von 100 Punkten, bei Punkten bis zum weitesten.
 */
export function comparePicture(a: readonly Point[], b: readonly Point[]): ComparePicture {
  const outline = (own: readonly Point[], other: readonly Point[]) =>
    own.length > PATTERN_SHOTS_MAX ||
    (own.length >= PATTERN_DENSITY_FROM && other.length >= PATTERN_DENSITY_FROM)
  const withOutline = outline(a, b) || outline(b, a)
  const all = [...a, ...b]
  // als Schleife: viele Punkte als Argumente für `Math.max(...)` sprengen den Stapel
  let farthest = 0
  for (const p of all) farthest = Math.max(farthest, Math.hypot(p.xUm, p.yUm))
  const halfUm = withOutline ? patternHalf(all) : Math.max(1000, farthest * 1.15 + 500)
  const side = (own: readonly Point[], other: readonly Point[]): SidePicture =>
    outline(own, other)
      ? { kind: "outline", grid: densityGrid(own, halfUm), center: roundCenter(own) as Point }
      : { kind: "dots", points: own.map(dot), center: roundCenter(own) }
  const sa = side(a, b)
  const sb = side(b, a)
  return {
    style: sa.kind !== sb.kind ? "mixed" : sa.kind === "outline" ? "outlines" : "dots",
    halfUm,
    focus: focusOf(all, withOutline ? 0.95 : 1),
    a: sa,
    b: sb,
  }
}
