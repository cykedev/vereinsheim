// Präzision einer Gruppe: Rayleigh-σ mit Vertrauensbereich, Höhe und Breite, Form, Streuung in
// Ringbreiten, Ausreißer und ihr Ringverlust (Katalog P5, P7, P8, P9, V6, V7). Lagen in µm. Welche
// Schüsse gemeint sind (Wertung, Serie, Probe), wählt der Aufrufer; verdächtige Schüsse zählen ohne
// Lage nicht (SF-15).

import { centroid, covarianceEllipse, distancesTo, meanRadius, r50, type Point } from "../geometry"
import {
  inShotOrder,
  selectShots,
  shotNumbers,
  type MetricShot,
  type Scoring,
  type ShotKind,
} from "../metrics"
import { c4, chiSquareQuantileEven, fQuantile2, median } from "../stats"
import type { TargetImage } from "../targets"
import { valueNeed, valueTenths } from "./values"

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

/** Höhe und Breite (P7), ab drei Schuss wie `group.height` und `group.width` (SF-61) */
export function heightWidth(
  shots: readonly MetricShot[]
): { n: number; height: number; width: number; figureOfMerit: number } | null {
  const points = positioned(shots)
  if (points.length < 3) return null
  const xs = points.map((p) => p.xUm)
  const ys = points.map((p) => p.yUm)
  const height = Math.max(...ys) - Math.min(...ys)
  const width = Math.max(...xs) - Math.min(...xs)
  return { n: points.length, height, width, figureOfMerit: (height + width) / 2 }
}

/** Den Winkel einer gestreckten Gruppe zeigt die Oberfläche erst ab so vielen Schüssen. */
const SHAPE_MIN_SHOTS = 10
/** Irrtum des Tests auf Streckung */
const SHAPE_ALPHA = 0.05

export interface GroupShape {
  n: number
  majorUm: number
  minorUm: number
  /** a / b; unendlich, wenn alle Treffer auf einer Linie liegen */
  ratio: number
  angleRad: number
  /** Mauchly-W = 4a²b²/(a² + b²)²: 1 heißt rund, 0 eine Linie */
  sphericity: number
  /** mit 95 % gestreckt, nicht nur zufällig unrund */
  elongated: boolean
  showAngle: boolean
}

/**
 * Form der Gruppe (P8): Halbachsen und Winkel der Kovarianz-Ellipse. Ob sie wirklich gestreckt ist,
 * entscheidet der Sphärizitätstest nach Mauchly; für zwei Dimensionen ist er exakt: Bei einer runden
 * Normalgruppe ist W Beta((n − 2)/2, 1)-verteilt, also P(W ≤ w) = w^((n − 2)/2), Grenze 0,05^(2/(n − 2)).
 * Den Winkel zeigt die Oberfläche nur bei gestreckten Gruppen ab 10 Schuss. Ohne Ausdehnung (alle
 * Treffer an einer Stelle) gibt es keine Form.
 */
export function groupShape(shots: readonly MetricShot[]): GroupShape | null {
  const points = positioned(shots)
  const n = points.length
  const ellipse = n >= 3 ? covarianceEllipse(points) : null
  if (!ellipse || !(ellipse.majorUm > 0)) return null
  const a2 = ellipse.majorUm ** 2
  const b2 = ellipse.minorUm ** 2
  const sphericity = (4 * a2 * b2) / (a2 + b2) ** 2
  const elongated = sphericity < SHAPE_ALPHA ** (2 / (n - 2))
  return {
    n,
    ...ellipse,
    ratio: ellipse.minorUm > 0 ? ellipse.majorUm / ellipse.minorUm : Number.POSITIVE_INFINITY,
    sphericity,
    elongated,
    showAngle: elongated && n >= SHAPE_MIN_SHOTS,
  }
}

/** Streuung in Ringbreiten: Maß in µm geteilt durch den Ringabstand der Scheibe */
export const ringWidths = (spreadUm: number, target: TargetImage) => spreadUm / target.ringWidthUm

/** Irrtum des Ausreißer-Tests über die ganze Gruppe */
const OUTLIER_ALPHA = 0.05

export interface Outlier {
  shot: MetricShot
  /** Nummer in der Abgabefolge seiner Art (`shotNumbers`) */
  number: number
}

/**
 * Ausreißer (V6): jeder Schuss gegen die übrigen. d ist sein Abstand zum Schwerpunkt der übrigen, S²
 * deren Streuung um ihren Schwerpunkt, Σr²/(2(n − 2)). Bei einer runden Normalgruppe ist
 * T = d² / (2 S² (1 + 1/(n − 1))) exakt F(2, 2(n − 2))-verteilt; Ausreißer ist, wer über dem
 * (1 − 0,05/n)-Quantil liegt (Bonferroni). So meldet die Regel in einer normalen Gruppe in höchstens
 * 5 % der Scheiben einen Ausreißer (simuliert: 5,0 %); Q3 + 1,5 · IQR auf den Radien täte es in bis zu
 * 47 %. Zwei gleich weite Ausreißer verdecken sich bei wenigen Schuss gegenseitig. Kein Schuss fällt
 * aus der Wertung. Dazu MR/R50: bei einer runden Normalgruppe etwa 1,06, deutlich mehr heißt, wenige
 * weite Schüsse dominieren. Ab fünf Schuss.
 */
export function outliers(
  shots: readonly MetricShot[]
): { n: number; flagged: Outlier[]; ratio: number | null } | null {
  const selected = selectShots(shots, { need: "position" })
  const n = selected.length
  if (n < 5) return null
  const numbers = shotNumbers(shots)
  const points = selected.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  const critical = fQuantile2(1 - OUTLIER_ALPHA / n, 2 * (n - 2))
  const flagged: Outlier[] = []
  points.forEach((p, i) => {
    const others = points.filter((_, j) => j !== i)
    const center = centroid(others) as Point
    const s2 = distancesTo(others, center).reduce((sum, r) => sum + r * r, 0) / (2 * (n - 2))
    const d2 = (p.xUm - center.xUm) ** 2 + (p.yUm - center.yUm) ** 2
    const out = s2 > 0 ? d2 / (2 * s2 * (1 + 1 / (n - 1))) > critical : d2 > 0
    if (out) flagged.push({ shot: selected[i], number: numbers.get(selected[i]) as number })
  })
  const robust = r50(points) as number
  return {
    n,
    flagged,
    ratio: robust > 0 ? (meanRadius(points) as number) / robust : null,
  }
}

const MATCH: readonly ShotKind[] = ["match"]

/**
 * Ringverlust durch Ausreißer: Σ (Median − Wert) über die schwächsten 10 % der Wertung, ab 10 Schuss,
 * in der gewählten Wertung
 */
export function outlierLoss(
  shots: readonly MetricShot[],
  scoring: Scoring
): { n: number; count: number; loss: number } | null {
  const values = inShotOrder(selectShots(shots, { kinds: MATCH, need: valueNeed(scoring) })).map(
    (shot) => valueTenths(shot, scoring)
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
