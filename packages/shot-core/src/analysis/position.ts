// Lage und Systematik: Ist der Versatz echt oder Zufall (Hotelling-T²), wie viele Ringe kostet die Lage
// gegen die Streuung, wie groß ist ihr Anteil am Fehler, in welche Richtungen gehen die Treffer und
// wandert die Gruppe (Katalog L3–L6, L8). Lagen in µm, Mitte (0 | 0), x rechts, y oben.

import {
  centroid,
  covarianceEllipse,
  distancesTo,
  standardDeviation,
  type Point,
} from "../geometry"
import { inShotOrder, selectShots, type MetricShot, type ShotKind } from "../metrics"
import { scoreFromCoordinates } from "../scoring"
import { fQuantile2 } from "../stats"
import type { TargetImage } from "../targets"

const positioned = (shots: readonly MetricShot[]): Point[] =>
  selectShots(shots, { need: "position" }).map((shot) => ({
    xUm: shot.xUm as number,
    yUm: shot.yUm as number,
  }))

export interface MpiConfidence {
  n: number
  center: Point
  /** Hotelling-T² des Schwerpunkts gegen die Mitte */
  t2: number
  /** 95-%-Grenze: 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2) */
  critical: number
  /** der Versatz ist mit 95 % kein Zufall */
  real: boolean
  /** 95-%-Vertrauensellipse um den Schwerpunkt */
  ellipse: { majorUm: number; minorUm: number; angleRad: number }
}

/** Ab drei Schuss; liegen alle Treffer auf einer Linie, lässt sich nichts sagen. */
export function mpiConfidence(shots: readonly MetricShot[]): MpiConfidence | null {
  const points = positioned(shots)
  const n = points.length
  if (n < 3) return null
  const center = centroid(points) as Point
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.xUm - center.xUm
    const dy = p.yUm - center.yUm
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  sxx /= n - 1
  syy /= n - 1
  sxy /= n - 1
  const det = sxx * syy - sxy * sxy
  if (!(det > 0)) return null
  const mx = center.xUm
  const my = center.yUm
  const t2 = (n * (syy * mx * mx - 2 * sxy * mx * my + sxx * my * my)) / det
  const critical = ((2 * (n - 1)) / (n - 2)) * fQuantile2(0.95, n - 2)
  const shape = covarianceEllipse(points) as { majorUm: number; minorUm: number; angleRad: number }
  const scale = Math.sqrt(critical / n)
  return {
    n,
    center,
    t2,
    critical,
    real: t2 > critical,
    ellipse: {
      majorUm: shape.majorUm * scale,
      minorUm: shape.minorUm * scale,
      angleRad: shape.angleRad,
    },
  }
}

interface Totals {
  /** Summe in Zehntelwertung (103 = 103,0 Ringe) */
  tenths: number
  rings: number
}

export interface RingLossSplit {
  n: number
  actual: Totals
  /** dieselben Treffer um den Schwerpunkt in die Mitte verschoben und neu gewertet */
  centered: Totals
  positionLoss: Totals
  spreadLoss: Totals
  /** belastbar ab 10 Schuss und wenn die Lage echt ist (L3); nie amtlich */
  reliable: boolean
}

const MATCH: readonly ShotKind[] = ["match"]

function score(target: TargetImage, points: readonly Point[]): Totals {
  let tenths = 0
  let rings = 0
  for (const p of points) {
    const s = scoreFromCoordinates(target, Math.round(p.xUm), Math.round(p.yUm))
    tenths += s.decimalTenths
    rings += s.ring
  }
  return { tenths: tenths / 10, rings }
}

/** Ringverlust nach Ursache: Lage (Versatz des Schwerpunkts) gegen Streuung (Gruppe um ihn), L4 */
export function ringLossSplit(
  shots: readonly MetricShot[],
  target: TargetImage
): RingLossSplit | null {
  const match = selectShots(shots, { kinds: MATCH, need: "position" })
  const points = match.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  if (points.length === 0) return null
  const center = centroid(points) as Point
  const actual = score(target, points)
  const centered = score(
    target,
    points.map((p) => ({ xUm: p.xUm - center.xUm, yUm: p.yUm - center.yUm }))
  )
  const n = points.length
  const maxTenths = (n * 109) / 10
  return {
    n,
    actual,
    centered,
    positionLoss: { tenths: centered.tenths - actual.tenths, rings: centered.rings - actual.rings },
    spreadLoss: { tenths: maxTenths - centered.tenths, rings: n * 10 - centered.rings },
    reliable: n >= 10 && mpiConfidence(match)?.real === true,
  }
}

/**
 * Lageanteil am Fehler: (1/n) Σ dᵢ² = |m|² + (1/n) Σ rᵢ². Anteil = max(0, |m|² − (Sx² + Sy²)/n) durch
 * (1/n) Σ dᵢ²; der abgezogene Term nimmt das Schätzrauschen des Schwerpunkts heraus. Ab drei Schuss.
 */
export function positionShare(shots: readonly MetricShot[]): number | null {
  const points = positioned(shots)
  const n = points.length
  if (n < 3) return null
  const center = centroid(points) as Point
  const meanSquare = points.reduce((sum, p) => sum + p.xUm ** 2 + p.yUm ** 2, 0) / n
  if (meanSquare === 0) return 0
  const sx = standardDeviation(points.map((p) => p.xUm)) as number
  const sy = standardDeviation(points.map((p) => p.yUm)) as number
  const bias = Math.max(0, center.xUm ** 2 + center.yUm ** 2 - (sx * sx + sy * sy) / n)
  return bias / meanSquare
}

/**
 * Richtungsuhr: Zahl der Treffer je Uhrzeit um die Mitte oder einen anderen Bezugspunkt; Index 0 ist
 * 12 Uhr (oben), 3 ist rechts. Treffer genau im Bezugspunkt haben keine Richtung und zählen nicht.
 */
export function directionClock(
  shots: readonly MetricShot[],
  reference: Point = { xUm: 0, yUm: 0 }
): { n: number; counts: number[] } {
  const counts = new Array<number>(12).fill(0)
  let n = 0
  for (const p of positioned(shots)) {
    const dx = p.xUm - reference.xUm
    const dy = p.yUm - reference.yUm
    if (dx === 0 && dy === 0) continue
    const hours = Math.round(Math.atan2(dx, dy) / (Math.PI / 6))
    counts[((hours % 12) + 12) % 12]++
    n++
  }
  return { n, counts }
}

/**
 * Drift in der Abgabefolge: Sprünge von Treffer zu Treffer und das von-Neumann-Verhältnis
 * Σ Sprung² / Σ rᵢ²; um 2 heißt unabhängig, deutlich darunter wandert die Gruppe. Springt `seq`,
 * fehlt ein Schuss, und der Sprung zählt nicht (SF-30). Ab drei Schuss.
 */
export function drift(
  shots: readonly MetricShot[]
): { n: number; meanJumpUm: number; maxJumpUm: number; vonNeumann: number } | null {
  const ordered = inShotOrder(selectShots(shots, { need: "position" }))
  if (ordered.length < 3) return null
  const withSeq = ordered.every((shot) => Number.isFinite(shot.seq))
  const jumps: number[] = []
  for (let i = 1; i < ordered.length; i++) {
    if (withSeq && (ordered[i].seq as number) - (ordered[i - 1].seq as number) > 1) continue
    jumps.push(
      Math.hypot(
        (ordered[i].xUm as number) - (ordered[i - 1].xUm as number),
        (ordered[i].yUm as number) - (ordered[i - 1].yUm as number)
      )
    )
  }
  const points = ordered.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  const sumSquares = distancesTo(points, centroid(points) as Point).reduce((s, r) => s + r * r, 0)
  if (jumps.length === 0 || sumSquares === 0) return null
  return {
    n: ordered.length,
    meanJumpUm: jumps.reduce((s, j) => s + j, 0) / jumps.length,
    maxJumpUm: Math.max(...jumps),
    vonNeumann: jumps.reduce((s, j) => s + j * j, 0) / sumSquares,
  }
}
