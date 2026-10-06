// Präzision einer Gruppe: Rayleigh-σ mit Vertrauensbereich, Höhe und Breite, Form, Streuung in
// Ringbreiten, Ausreißer und ihr Ringverlust (Katalog P5, P7, P8, P9, V6, V7). Lagen in µm. Welche
// Schüsse gemeint sind (Wertung, Serie, Probe), wählt der Aufrufer; verdächtige Schüsse zählen ohne
// Lage nicht (SF-15).

import { centroid, covarianceEllipse, distancesTo, meanRadius, r50, type Point } from "../geometry"
import { inShotOrder, selectShots, type MetricShot, type ShotKind } from "../metrics"
import { c4, chiSquareQuantileEven, median, quantile } from "../stats"
import type { TargetImage } from "../targets"

const positioned = (shots: readonly MetricShot[]): Point[] =>
  selectShots(shots, { need: "position" }).map((shot) => ({
    xUm: shot.xUm as number,
    yUm: shot.yUm as number,
  }))

export interface SigmaEstimate {
  n: number
  /** Sa = √(Σr² / (2(n − 1))), Meytons „Sa“ */
  sa: number
  /** σ̂ = Sa / c4(2n − 1), erwartungstreu und kaum von n abhängig */
  sigma: number
  /** 95-%-Bereich für σ über χ² mit 2(n − 1) Freiheitsgraden */
  low: number
  high: number
}

export function sigmaEstimate(shots: readonly MetricShot[]): SigmaEstimate | null {
  const points = positioned(shots)
  const n = points.length
  if (n < 3) return null
  const center = centroid(points) as Point
  const sumSquares = distancesTo(points, center).reduce((sum, r) => sum + r * r, 0)
  const df = 2 * (n - 1)
  const sa = Math.sqrt(sumSquares / df)
  return {
    n,
    sa,
    sigma: sa / c4(2 * n - 1),
    low: Math.sqrt(sumSquares / chiSquareQuantileEven(0.975, df)),
    high: Math.sqrt(sumSquares / chiSquareQuantileEven(0.025, df)),
  }
}

export function heightWidth(
  shots: readonly MetricShot[]
): { n: number; height: number; width: number; figureOfMerit: number } | null {
  const points = positioned(shots)
  if (points.length < 2) return null
  const xs = points.map((p) => p.xUm)
  const ys = points.map((p) => p.yUm)
  const height = Math.max(...ys) - Math.min(...ys)
  const width = Math.max(...xs) - Math.min(...xs)
  return { n: points.length, height, width, figureOfMerit: (height + width) / 2 }
}

/** Ab so vielen Schüssen und so viel Streckung zeigt die Oberfläche den Winkel der Ellipse. */
const SHAPE_MIN_SHOTS = 10
const SHAPE_MIN_RATIO = 1.3

export interface GroupShape {
  n: number
  majorUm: number
  minorUm: number
  /** a / b; unendlich, wenn alle Treffer auf einer Linie liegen */
  ratio: number
  angleRad: number
  showAngle: boolean
}

export function groupShape(shots: readonly MetricShot[]): GroupShape | null {
  const points = positioned(shots)
  const ellipse = points.length >= 3 ? covarianceEllipse(points) : null
  if (!ellipse) return null
  const ratio = ellipse.minorUm > 0 ? ellipse.majorUm / ellipse.minorUm : Number.POSITIVE_INFINITY
  return {
    n: points.length,
    ...ellipse,
    ratio,
    showAngle: points.length >= SHAPE_MIN_SHOTS && ratio > SHAPE_MIN_RATIO,
  }
}

/** Streuung in Ringbreiten: Maß in µm geteilt durch den Ringabstand der Scheibe */
export const ringWidths = (spreadUm: number, target: TargetImage) => spreadUm / target.ringWidthUm

/**
 * Ausreißer: Abstand zum Schwerpunkt über Q3 + 1,5 · IQR (eine Konvention, nie aus der Wertung nehmen).
 * Dazu MR/R50: bei einer runden Normalgruppe etwa 1,06, deutlich mehr heißt, wenige weite Schüsse
 * dominieren. Indizes beziehen sich auf die Schüsse mit Lage in der gegebenen Folge.
 */
export function outliers(
  shots: readonly MetricShot[]
): { n: number; indices: number[]; ratio: number | null } | null {
  const points = positioned(shots)
  if (points.length < 5) return null
  const radii = distancesTo(points, centroid(points) as Point)
  const q1 = quantile(radii, 0.25) as number
  const q3 = quantile(radii, 0.75) as number
  const limit = q3 + 1.5 * (q3 - q1)
  const indices = radii.flatMap((r, i) => (r > limit ? [i] : []))
  const robust = r50(points) as number
  return {
    n: points.length,
    indices,
    ratio: robust > 0 ? (meanRadius(points) as number) / robust : null,
  }
}

const MATCH: readonly ShotKind[] = ["match"]

/** Ringverlust durch Ausreißer: Σ (Median − Wert) über die schwächsten 10 % der Wertung, ab 10 Schuss */
export function outlierLoss(
  shots: readonly MetricShot[]
): { n: number; count: number; loss: number } | null {
  const values = inShotOrder(selectShots(shots, { kinds: MATCH, need: "decimal" })).map(
    (shot) => shot.decimalTenths as number
  )
  if (values.length < 10) return null
  const center = median(values) as number
  const count = Math.max(1, Math.round(values.length / 10))
  const weakest = [...values].sort((a, b) => a - b).slice(0, count)
  return {
    n: values.length,
    count,
    loss: weakest.reduce((sum, v) => sum + (center - v), 0) / 10,
  }
}
