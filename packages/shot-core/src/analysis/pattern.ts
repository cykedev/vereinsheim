// Trefferbild über viele Scheiben (Katalog L9, L10, L7): die Form über alle Scheiben, jede um ihre eigene Mitte
// (gepoolt), die Lage als Schwerpunkt je Scheibe und die Richtung, in die Schüsse aus der Gruppe reißen. Einheit
// ist die Scheibe, wo ein Urteil über die Lage fällt; die Form zählt Abweichungen innerhalb der Scheiben. Lagen in
// µm, Mitte (0 | 0), x rechts, y oben, wie gezeichnet (ohne verdächtige Schüsse, `cardMarks`).

import type { Point } from "../geometry"
import { cellValue, densityGrid, patternHalf, type DensityGrid } from "./density"
import { confidenceOf } from "./hotelling"

/** ein Schuss im Trefferbild: Lage und, wenn bekannt, der Ring (für die Farbe der Punkte) */
export interface PatternPoint extends Point {
  ring?: number | null
}

/** eine Scheibe des Zeitraums mit den Lagen ihrer Schüsse wie gezeichnet */
export interface PatternCard {
  id: string
  atMs: number
  points: readonly PatternPoint[]
}

/** so viele Punkte braucht eine Scheibe für eine Mitte */
const MIN_CARD_POINTS = 3
/** Form (L9): ein Urteil ab so vielen Schüssen aus so vielen Scheiben */
const SHAPE_MIN_SHOTS = 100
const SHAPE_MIN_CARDS = 5
/** Form (L9): länglich erst ab diesem Verhältnis der Achsen, auch wenn der Test eine kleinere Streckung zeigt */
const SHAPE_MIN_RATIO = 1.15
const ALPHA = 0.05

const mean = (points: readonly Point[]): Point => ({
  xUm: points.reduce((s, p) => s + p.xUm, 0) / points.length,
  yUm: points.reduce((s, p) => s + p.yUm, 0) / points.length,
})

export interface PeriodShape {
  /** Schüsse der Scheiben, die zählen (ab drei mit Lage) */
  shots: number
  cards: number
  /** gepoolte Streuung je Achse: √((λ₁ + λ₂)/2) */
  sigmaUm: number
  /** Länge zu Breite: √(λ₁/λ₂) */
  ratio: number
  /** große Achse, von der x-Achse gegen den Uhrzeigersinn, in [0, π) wie `covarianceEllipse` */
  angleRad: number
  /** Mauchly: Wahrscheinlichkeit, dass eine runde Gruppe so unrund aussieht */
  p: number
  verdict: "elongated" | "none" | "few"
}

/**
 * Form über mehrere Scheiben (L9): jede Scheibe um ihre eigene Mitte geschoben, die Abweichungen gepoolt,
 * S = Σ Abweichungen ⊗ / ν mit ν = Σ(nᵢ − 1). Der Sphärizitätstest nach Mauchly ist für 2 × 2 exakt: W = 4λ₁λ₂/(λ₁ +
 * λ₂)² ist bei einer runden Normalgruppe Beta((ν − 1)/2, 1)-verteilt, also p = W^((ν − 1)/2) (wie `groupShape` mit ν =
 * n − 1). Länglich heißt p < 0,05 und Länge zu Breite ab 1,15; unter 100 Schuss oder 5 Scheiben kein Urteil. Die Lage
 * der Scheiben geht nicht ein. Ohne Scheibe ab drei Punkten oder ohne Ausdehnung null.
 */
export function periodShape(cards: readonly PatternCard[]): PeriodShape | null {
  let sxx = 0
  let syy = 0
  let sxy = 0
  let nu = 0
  let shots = 0
  let counted = 0
  for (const card of cards) {
    if (card.points.length < MIN_CARD_POINTS) continue
    const center = mean(card.points)
    for (const p of card.points) {
      const dx = p.xUm - center.xUm
      const dy = p.yUm - center.yUm
      sxx += dx * dx
      syy += dy * dy
      sxy += dx * dy
    }
    nu += card.points.length - 1
    shots += card.points.length
    counted++
  }
  if (!counted) return null
  sxx /= nu
  syy /= nu
  sxy /= nu
  const half = (sxx + syy) / 2
  if (!(half > 0)) return null
  const spread = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2)
  const major = half + spread
  const minor = Math.max(0, half - spread)
  let angleRad = Math.atan2(2 * sxy, sxx - syy) / 2
  if (angleRad < 0) angleRad += Math.PI
  const p = ((major * minor) / half ** 2) ** ((nu - 1) / 2)
  const ratio = minor > 0 ? Math.sqrt(major / minor) : Number.POSITIVE_INFINITY
  const verdict =
    shots < SHAPE_MIN_SHOTS || counted < SHAPE_MIN_CARDS
      ? "few"
      : p < ALPHA && ratio >= SHAPE_MIN_RATIO
        ? "elongated"
        : "none"
  return { shots, cards: counted, sigmaUm: Math.sqrt(half), ratio, angleRad, p, verdict }
}

/** Lage über Zeit (L10): ein Urteil ab so vielen Scheiben */
const POSITION_MIN_CARDS = 5

/** Schwerpunkt einer Scheibe und wie viele Schüsse ihn tragen */
export interface PositionPoint {
  id: string
  atMs: number
  center: Point
  n: number
}

/**
 * Schwerpunkte der Scheiben ab drei Schuss mit Lage, in zeitlicher Folge (L10). Eine Scheibe, deren Lage nur als
 * Ganzes bekannt ist (Trefferlage vom Ausdruck, [[adr-033]]), kann später als eigener Punkt dazukommen.
 */
export function positionPoints(cards: readonly PatternCard[]): PositionPoint[] {
  return cards
    .filter((card) => card.points.length >= MIN_CARD_POINTS)
    .map((card) => ({
      id: card.id,
      atMs: card.atMs,
      center: mean(card.points),
      n: card.points.length,
    }))
    .sort((a, b) => a.atMs - b.atMs)
}

export interface PositionOverTime {
  points: PositionPoint[]
  /** Mittel der Schwerpunkte, jede Scheibe gleich; null ohne Scheibe */
  mean: Point | null
  /** Abstand dieses Mittels zur Mitte */
  offsetUm: number | null
  /** Hotelling-T² über die Schwerpunkte und seine 95-%-Grenze; null unter drei Scheiben oder auf einer Linie */
  t2: number | null
  critical: number | null
  verdict: "offset" | "fits" | "few"
}

/**
 * Lage über Zeit (L10): Ist der Versatz über den Zeitraum echt? Einheit ist die Scheibe wie beim Vergleich zweier
 * Zeiträume: Hotelling-T² über die Schwerpunkte gegen die Mitte, ab fünf Scheiben. Viele Schüsse aus wenigen Abenden
 * sind keine breite Grundlage, deshalb nicht über alle Schüsse.
 */
export function positionOverTime(points: readonly PositionPoint[]): PositionOverTime {
  const centers = points.map((p) => p.center)
  const center = centers.length ? mean(centers) : null
  const confidence = confidenceOf(centers)
  return {
    points: [...points],
    mean: center,
    offsetUm: center ? Math.hypot(center.xUm, center.yUm) : null,
    t2: confidence?.t2 ?? null,
    critical: confidence?.critical ?? null,
    verdict:
      points.length < POSITION_MIN_CARDS || !confidence
        ? "few"
        : confidence.real
          ? "offset"
          : "fits",
  }
}

/** Ausreißerrichtung (L7): Scheiben ab so vielen Punkten, ein Urteil ab so vielen Ausreißern */
const OUTLIER_MIN_CARD_POINTS = 10
const OUTLIER_MIN_SHOTS = 30

export interface OutlierDirection {
  /** gezählte Ausreißer mit Richtung */
  n: number
  /** je Uhrzeit, Index 0 ist 12 Uhr (oben), 3 rechts, wie `directionClock` */
  counts: number[]
  /** mittlere Richtung im Uhrzeigersinn von oben, in [0, 2π) */
  meanRad: number
  /** Rayleigh: Wahrscheinlichkeit, dass Richtungen ohne Vorzug so gebündelt aussehen */
  p: number
  verdict: "directed" | "none" | "few"
}

/**
 * Ausreißerrichtung (L7): je Scheibe ab zehn Punkten das weiteste Zehntel der Schüsse (mindestens einer), gemessen von
 * ihrer eigenen Mitte, und ihre Richtung von dort. So misst sie das Ausreißen aus der Gruppe, nicht deren Versatz
 * (das ist L10). Eine Vorzugsrichtung zeigt der Rayleigh-Test (Näherung nach Zar), ab 30 Ausreißern bei p < 0,05.
 * Eine längliche Gruppe hat Ausreißer an beiden Enden; das ist keine Richtung, der Test bleibt dabei ruhig. Ohne
 * Scheibe ab zehn Punkten null.
 */
export function outlierDirection(cards: readonly PatternCard[]): OutlierDirection | null {
  const counts = new Array<number>(12).fill(0)
  let sin = 0
  let cos = 0
  let n = 0
  for (const card of cards) {
    if (card.points.length < OUTLIER_MIN_CARD_POINTS) continue
    const center = mean(card.points)
    const k = Math.max(1, Math.round(card.points.length / 10))
    const farthest = card.points
      .map((p, i) => ({ dx: p.xUm - center.xUm, dy: p.yUm - center.yUm, i }))
      .sort((a, b) => Math.hypot(b.dx, b.dy) - Math.hypot(a.dx, a.dy) || a.i - b.i)
      .slice(0, k)
    for (const { dx, dy } of farthest) {
      if (dx === 0 && dy === 0) continue
      const angle = Math.atan2(dx, dy)
      const hours = Math.round(angle / (Math.PI / 6))
      counts[((hours % 12) + 12) % 12]++
      sin += Math.sin(angle)
      cos += Math.cos(angle)
      n++
    }
  }
  if (!n) return null
  const r = Math.hypot(sin, cos)
  const p = Math.min(1, Math.exp(Math.sqrt(1 + 4 * n + 4 * (n * n - r * r)) - (1 + 2 * n)))
  let meanRad = Math.atan2(sin, cos)
  if (meanRad < 0) meanRad += 2 * Math.PI
  return {
    n,
    counts,
    meanRad,
    p,
    verdict: n < OUTLIER_MIN_SHOTS ? "few" : p < ALPHA ? "directed" : "none",
  }
}

/** ab so vielen Schüssen zeigt das Trefferbild die Dichte als Heatmap, darunter jeden Schuss in seiner Ringfarbe */
export const PATTERN_DENSITY_FROM = 50

/** so viele seltene Schüsse zeigt das Bild mit Dichte höchstens einzeln: die mit der geringsten Dichte */
export const PATTERN_RARE_MAX = 300

/** Raster der Lagen im Muster: 10 µm wie `cardMarks` */
const PATTERN_UM = 10

/** das Bild der Schüsse: Ausschnitt um die Mitte der Scheibe, die Mitte aller Schüsse, Punkte oder Dichte */
export interface PatternLayer {
  /** halbe Kantenlänge des Ausschnitts um die Mitte der Scheibe */
  halfUm: number
  /** Mitte aller Schüsse, auf ganze µm; null ohne Schuss */
  center: Point | null
  /**
   * die Schüsse, die das Bild einzeln zeichnet, als [x, y] in 10 µm und ihr Ring (null ohne Wert): unter
   * `PATTERN_DENSITY_FROM` Schuss alle, mit Dichte die seltenen außerhalb des Bands für neun Zehntel, höchstens
   * `PATTERN_RARE_MAX`, die seltensten zuerst
   */
  points: [number, number, number | null][] | null
  /** die Dichte in Bändern ab `PATTERN_DENSITY_FROM` Schuss; sonst null */
  grid: DensityGrid | null
}

/** das Trefferbild eines Zeitraums, wie es an den Browser geht: ohne Schüsse, nur Raster, Mitten und Urteile */
export interface PeriodPattern {
  /** Schüsse mit Lage */
  shots: number
  /** alle Scheiben, auch ohne Lage */
  cards: number
  cardsWithoutPosition: number
  /** die Schüsse, wo sie lagen */
  picture: PatternLayer
  shape: PeriodShape | null
  overTime: PositionOverTime
  outliers: OutlierDirection | null
}

const roundPoint = (p: Point): Point => ({ xUm: Math.round(p.xUm), yUm: Math.round(p.yUm) })

function layer(points: readonly PatternPoint[]): PatternLayer {
  const center = points.length ? roundPoint(mean(points)) : null
  // einzelne Punkte zeigt das Bild alle (mit Rand für das Kaliber); mit Dichte auch die seltenen Schüsse, aber
  // höchstens doppelt so weit wie 99 % der Schüsse, damit ein einzelner Abreißer die Heatmap nicht klein macht
  const farthest = Math.max(0, ...points.map((p) => Math.hypot(p.xUm, p.yUm)))
  const shot = (p: PatternPoint): [number, number, number | null] => [
    Math.round(p.xUm / PATTERN_UM),
    Math.round(p.yUm / PATTERN_UM),
    p.ring ?? null,
  ]
  if (points.length < PATTERN_DENSITY_FROM)
    return {
      halfUm: Math.max(1000, farthest * 1.15 + 500),
      center,
      points: points.map(shot),
      grid: null,
    }
  const core = patternHalf(points)
  const halfUm = Math.min(2 * core, Math.max(core, farthest * 1.08 + 500))
  const grid = densityGrid(points, halfUm)
  // außerhalb des Bands für neun Zehntel: die seltenen Schüsse, als echte Treffer über der Heatmap
  const rare = points
    .map((p) => ({ p, value: cellValue(grid, halfUm, p) }))
    .filter(({ value }) => value < grid.levels[1])
    .sort((a, b) => a.value - b.value)
    .slice(0, PATTERN_RARE_MAX)
    .map(({ p }) => shot(p))
  return { halfUm, center, points: rare, grid }
}

/**
 * Das Trefferbild eines Zeitraums (L9) mit den Urteilen über Form (L9), Lage (L10) und Ausreißerrichtung (L7), für
 * den Browser gerechnet: Er bekommt die Schüsse, wo sie lagen, als Raster von 64 × 64 (unter 50 Schuss die Punkte mit
 * Ring), die Schwerpunkte je Scheibe auf ganze µm, keine Schüsse. Die Form zeigt die Seite nicht als zweites Bild,
 * sondern über ihr Urteil (`shape`).
 */
export function periodPattern(cards: readonly PatternCard[]): PeriodPattern {
  const all = cards.flatMap((card) => card.points)
  return {
    shots: all.length,
    cards: cards.length,
    cardsWithoutPosition: cards.filter((card) => card.points.length === 0).length,
    picture: layer(all),
    shape: periodShape(cards),
    overTime: positionOverTime(
      positionPoints(cards).map((p) => ({ ...p, center: roundPoint(p.center) }))
    ),
    outliers: outlierDirection(cards),
  }
}
