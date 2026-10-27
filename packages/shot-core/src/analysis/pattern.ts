// Trefferbild über viele Scheiben (Katalog L9, L10, L7): die Form über alle Scheiben, jede um ihre eigene Mitte
// (gepoolt), die Lage über alle Schüsse mit einem Urteil über Schüsse und Abende ([[adr-034]]) und die Richtung, in
// die Schüsse aus der Gruppe reißen. Die Form zählt Abweichungen innerhalb der Scheiben. Lagen in µm, Mitte (0 | 0),
// x rechts, y oben, wie gezeichnet (ohne verdächtige Schüsse, `cardMarks`).

import type { Point } from "../geometry"
import { cellValue, densityGrid, patternHalf, type DensityGrid } from "./density"
import { c4 } from "../stats"
import { levelTestZeroByAxis } from "./levels"
import { pooledCenter } from "./center"

/** ein Schuss im Trefferbild: Lage und, wenn bekannt, der Ring (für die Farbe der Punkte) */
export interface PatternPoint extends Point {
  ring?: number | null
}

/** eine Scheibe des Zeitraums mit den Lagen ihrer Schüsse wie gezeichnet */
export interface PatternCard {
  id: string
  atMs: number
  points: readonly PatternPoint[]
  /**
   * Trefferlage als Summe einer Scheibe ohne Lage je Schuss: zählt nur für die Mitte des Bilds, nie für Form, Lage über
   * Zeit und Ausreißer
   */
  summaryCenter?: { xUm: number; yUm: number; n: number } | null
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
  // wie σ je Scheibe (P5): erwartungstreu mit c4 über 2ν Freiheitsgrade
  const sigmaUm = Math.sqrt(half) / c4(2 * nu + 1)
  return { shots, cards: counted, sigmaUm, ratio, angleRad, p, verdict }
}

/** Lage über Zeit (L10): ein Urteil ab so vielen Scheiben */
const POSITION_MIN_CARDS = 5

/** Schwerpunkt einer Scheibe, wie viele Schüsse ihn tragen und wie sie um ihn streuen */
export interface PositionPoint {
  id: string
  atMs: number
  center: Point
  n: number
  /** Abweichungsquadrate der Schüsse um den Schwerpunkt: [Σdx², Σdy², Σdx·dy] */
  scatter: [number, number, number]
}

/**
 * Schwerpunkte der Scheiben ab drei Schuss mit Lage, in zeitlicher Folge (L10). Eine Scheibe, deren Lage nur als
 * Ganzes bekannt ist (Trefferlage vom Ausdruck, [[adr-033]]), kann später als eigener Punkt dazukommen.
 */
export function positionPoints(cards: readonly PatternCard[]): PositionPoint[] {
  return cards
    .filter((card) => card.points.length >= MIN_CARD_POINTS)
    .map((card) => {
      const center = mean(card.points)
      const scatter: [number, number, number] = [0, 0, 0]
      for (const p of card.points) {
        const dx = p.xUm - center.xUm
        const dy = p.yUm - center.yUm
        scatter[0] += dx * dx
        scatter[1] += dy * dy
        scatter[2] += dx * dy
      }
      return { id: card.id, atMs: card.atMs, center, n: card.points.length, scatter }
    })
    .sort((a, b) => a.atMs - b.atMs)
}

/** ein Schwerpunkt im Verlauf, ohne die Streuung (die braucht nur das Urteil) */
export type TimelinePoint = Omit<PositionPoint, "scatter">

export interface PositionOverTime {
  points: TimelinePoint[]
  /** Mitte aller Schüsse dieser Scheiben (jeder Schuss gleich); null ohne Scheibe */
  mean: Point | null
  /** Abstand dieser Mitte zur Mitte der Scheibe */
  offsetUm: number | null
  /** Wahrscheinlichkeit, dass eine Lage ohne Versatz so weit daneben liegt (zwei Ebenen); null ohne Test */
  p: number | null
  /** die Abende wandern in einer Richtung über den Zufall der Schüsse hinaus; null ohne Test */
  wander: boolean | null
  /** je Richtung: wandern die Abende seitlich (x) oder in der Höhe (y)? Dort zählt jeder Abend für sich */
  wanderAxes: { x: boolean; y: boolean } | null
  /**
   * je Richtung der halbe Bereich in µm, in dem die Mitte zu 95 % liegt; er schließt die Mitte der Scheibe genau dann
   * aus, wenn `verdict` „offset“ ist. Null ohne Urteil
   */
  region: { xUm: number; yUm: number } | null
  verdict: "offset" | "fits" | "few"
}

/**
 * Lage über Zeit (L10): Ist der Versatz über den Zeitraum echt? Die Mitte aller Schüsse gegen die Mitte der Scheibe,
 * über zwei Ebenen je Richtung ([[adr-034]], `levelTestZeroByAxis`): Wandern die Abende in einer Richtung nicht über
 * den Zufall hinaus, zählt dort jeder Schuss, sonst jeder Abend; beide Richtungen zusammen nach Bonferroni. Versetzt bei
 * p < 0,05, ein Urteil ab fünf Scheiben.
 */
export function positionOverTime(points: readonly PositionPoint[]): PositionOverTime {
  const shots = points.reduce((sum, p) => sum + p.n, 0)
  const center = shots
    ? {
        xUm: points.reduce((sum, p) => sum + p.n * p.center.xUm, 0) / shots,
        yUm: points.reduce((sum, p) => sum + p.n * p.center.yUm, 0) / shots,
      }
    : null
  const test = levelTestZeroByAxis(
    points.map((p) => ({ n: p.n, mean: [p.center.xUm, p.center.yUm], scatter: p.scatter }))
  )
  const judged = points.length >= POSITION_MIN_CARDS ? test : null
  return {
    points: points.map(({ scatter: _scatter, ...point }) => point),
    mean: center,
    offsetUm: center ? Math.hypot(center.xUm, center.yUm) : null,
    p: judged?.p ?? null,
    wander: judged?.wander ?? null,
    wanderAxes: judged?.wanderAxes ?? null,
    region: judged ? { xUm: judged.region.x, yUm: judged.region.y } : null,
    verdict: !judged ? "few" : judged.p < ALPHA ? "offset" : "fits",
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

/** ab so vielen Schüssen färbt das Trefferbild die Treffer nach der Dichte, darunter nach ihrem Ring */
export const PATTERN_DENSITY_FROM = 50
/** ab so vielen Schüssen zeigt das Trefferbild nur die Umrisse statt jedes Treffers (Menge an den Browser) */
export const PATTERN_SHOTS_MAX = 3000

/** Raster der Lagen im Muster: 10 µm wie `cardMarks` */
const PATTERN_UM = 10

/**
 * wie das Trefferbild zeichnet: jeden Treffer in seiner Ringfarbe (wenige Schüsse), jeden Treffer in der Farbe der
 * Dichte an seiner Stelle oder die Umrisse, oder nur die Umrisse (sehr viele Schüsse); dieselben Schwellen wie beim
 * Vergleichen (`comparePicture`)
 */
export type PatternStyle = "rings" | "shots" | "outlines"

/** das Bild der Schüsse: Ausschnitt um die Mitte der Scheibe, die Mitte aller Schüsse, Treffer oder Umrisse */
export interface PatternLayer {
  style: PatternStyle
  /** halbe Kantenlänge des Ausschnitts um die Mitte der Scheibe */
  halfUm: number
  /** Mitte aller Schüsse, auf ganze µm; null ohne Schuss */
  center: Point | null
  /**
   * jeder Schuss als [x, y] in 10 µm, sein Ring (null ohne Wert) und sein Band der Dichte (0 selten bis 5 oft, wie
   * `HEAT_SHARES`; null bei `rings`), die dichten zuletzt; null bei `outlines`
   */
  points: [number, number, number | null, number | null][] | null
  /**
   * die Dichte als Raster für die Umrisse (Hälfte und 9 von 10 der Schüsse) und die Farben der Treffer; bei `rings`
   * null
   */
  grid: DensityGrid | null
  /** Treffer außerhalb des Ausschnitts, die das Bild nicht zeigt (nur bei `shots`) */
  outside: number
}

/**
 * das Trefferbild eines Zeitraums, wie es an den Browser geht: bis 3.000 Schuss die Treffer mit Band, ab 50 das Raster
 * (für die Umrisse), dazu Mitten und Urteile
 */
export interface PeriodPattern {
  /** Schüsse mit Lage */
  shots: number
  /** alle Scheiben, auch ohne Lage */
  cards: number
  cardsWithoutPosition: number
  /** Scheiben ohne Lage je Schuss, die mit ihrer Trefferlage als Summe in der Mitte des Bilds zählen */
  summaryCards: number
  /** die Schüsse, wo sie lagen */
  picture: PatternLayer
  shape: PeriodShape | null
  overTime: PositionOverTime
  outliers: OutlierDirection | null
}

const roundPoint = (p: Point): Point => ({
  xUm: Math.round(p.xUm) || 0,
  yUm: Math.round(p.yUm) || 0,
})

const toShot = (
  p: PatternPoint,
  band: number | null
): [number, number, number | null, number | null] => [
  // `|| 0`: kein −0 (wie `cardMarks`)
  Math.round(p.xUm / PATTERN_UM) || 0,
  Math.round(p.yUm / PATTERN_UM) || 0,
  p.ring ?? null,
  band,
]

/** das Band der Dichte an einer Stelle: das innerste, dessen Grenze sie erreicht; außerhalb aller das äußerste */
const bandAt = (grid: DensityGrid, value: number) =>
  Math.max(
    0,
    grid.levels.findLastIndex((level) => value >= level)
  )

/** `middle`: die Mitte aller Schüsse, wenn sie nicht aus den Punkten allein kommt; das Bild reicht dann bis zu ihr */
function layer(points: readonly PatternPoint[], middle?: Point): PatternLayer {
  const center = middle ? roundPoint(middle) : points.length ? roundPoint(mean(points)) : null
  // als Schleife: Zehntausende Argumente für `Math.max(...)` sprengten den Stapel
  let farthest = middle ? Math.hypot(middle.xUm, middle.yUm) : 0
  for (const p of points) farthest = Math.max(farthest, Math.hypot(p.xUm, p.yUm))
  if (points.length < PATTERN_DENSITY_FROM)
    // jeder Treffer im Bild, mit Rand für das Kaliber
    return {
      style: "rings",
      halfUm: Math.max(1000, farthest * 1.15 + 500),
      center,
      points: points.map((p) => toShot(p, null)),
      grid: null,
      outside: 0,
    }
  // eine Mitte aus Trefferlagen als Summe kann außerhalb der Schüsse liegen: Das Bild reicht dann bis zu ihr
  const reach = middle ? Math.hypot(middle.xUm, middle.yUm) * 1.08 + 500 : 0
  const core = Math.max(patternHalf(points), reach)
  if (points.length > PATTERN_SHOTS_MAX)
    return {
      style: "outlines",
      halfUm: core,
      center,
      points: null,
      grid: densityGrid(points, core),
      outside: 0,
    }
  // jeder Treffer, auch seltene weit draußen, aber höchstens 1,6-mal so weit wie 99 % der Schüsse: ein einzelner
  // Abreißer soll die Gruppe nicht klein machen; wer dann draußen liegt, wird gezählt
  const halfUm = Math.min(1.6 * core, Math.max(core, farthest * 1.08 + 500))
  const grid = densityGrid(points, halfUm)
  const shots = points
    .map((p) => ({ p, band: bandAt(grid, cellValue(grid, halfUm, p)) }))
    .sort((a, b) => a.band - b.band)
    .map(({ p, band }) => toShot(p, band))
  const outside = points.filter((p) => Math.max(Math.abs(p.xUm), Math.abs(p.yUm)) > halfUm).length
  return { style: "shots", halfUm, center, points: shots, grid, outside }
}

/**
 * Das Trefferbild eines Zeitraums (L9) mit den Urteilen über Form (L9), Lage (L10) und Ausreißerrichtung (L7), für
 * den Browser gerechnet: Er bekommt bis 3.000 Schuss jeden Treffer mit seinem Band der Dichte (unter 50 mit seinem
 * Ring), ab 50 Schuss die Dichte als Raster von 64 × 64 (für die Umrisse, über 3.000 Schuss nur noch das Raster), dazu
 * die Schwerpunkte je Scheibe auf ganze µm. Scheiben ohne Lage je Schuss mit Trefferlage als Summe zählen nur in der
 * Mitte des Bilds, gewichtet mit ihrer Schusszahl (`pooledCenter`).
 */
export function periodPattern(cards: readonly PatternCard[]): PeriodPattern {
  const all = cards.flatMap((card) => card.points)
  const summaryCards = cards.filter((card) => !card.points.length && card.summaryCenter).length
  const middle = summaryCards
    ? pooledCenter(
        cards.map((card) =>
          card.points.length
            ? { ...mean(card.points), n: card.points.length, from: "shots" as const }
            : card.summaryCenter
              ? { ...card.summaryCenter, from: "summary" as const }
              : null
        )
      )
    : null
  return {
    shots: all.length,
    cards: cards.length,
    cardsWithoutPosition: cards.filter((card) => card.points.length === 0).length,
    summaryCards,
    picture: layer(all, middle ?? undefined),
    shape: periodShape(cards),
    overTime: positionOverTime(
      positionPoints(cards).map((p) => ({ ...p, center: roundPoint(p.center) }))
    ),
    outliers: outlierDirection(cards),
  }
}
