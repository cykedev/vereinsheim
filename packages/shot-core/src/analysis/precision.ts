// Präzision einer Gruppe: Rayleigh-σ mit Vertrauensbereich, Form, Streuung in Ringbreiten, Ausreißer
// und was sie kosten (Katalog P5, P8, P9, V6, V7). Lagen in µm. Welche
// Schüsse gemeint sind (Wertung, Serie, Probe), wählt der Aufrufer; verdächtige Schüsse zählen ohne
// Lage nicht (SF-15).

import { centroid, covarianceEllipse, distancesTo, type Point } from "../geometry"
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
  /**
   * σ̂ = √(Σr² / (2(n − 1))) / c4(2n − 1), erwartungstreu und kaum von n abhängig. Den Wert vor der
   * Korrektur nennt Meytons Ballistic Manager „Sa“; Spiegel zeigt ihn nicht, er ist bei 10 Schuss nur
   * 1,4 % kleiner und trägt keine eigene Information (Entscheidung des Users, Oktober 2026).
   */
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
  return {
    n,
    sigma: Math.sqrt(sumSquares / df) / c4(2 * n - 1),
    low: Math.sqrt(sumSquares / chiSquareQuantileEven(0.975, df)),
    high: Math.sqrt(sumSquares / chiSquareQuantileEven(0.025, df)),
  }
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
  /**
   * a/b, ab dem die Gruppe bei dieser Schusszahl als gestreckt gilt (die Mauchly-Grenze nach a/b
   * aufgelöst): bei 12 Schuss 2,26, bei 40 Schuss 1,50. Eine runde Gruppe sieht zufällig gestreckt aus,
   * bei 40 Schuss im Median a/b 1,2; erst über viele Schüsse wird eine leichte Streckung sichtbar.
   */
  ratioLimit: number
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
  const limit = SHAPE_ALPHA ** (2 / (n - 2))
  const elongated = sphericity < limit
  // W(r) = 4r²/(1 + r²)² fällt für r ≥ 1; W(r) = limit nach r² aufgelöst
  const ratioLimit = Math.sqrt((2 - limit + 2 * Math.sqrt(1 - limit)) / limit)
  return {
    n,
    ...ellipse,
    ratio: ellipse.minorUm > 0 ? ellipse.majorUm / ellipse.minorUm : Number.POSITIVE_INFINITY,
    sphericity,
    elongated,
    ratioLimit,
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
 * (1 − 0,05/n)-Quantil liegt (Bonferroni). So meldet die Regel in einer runden normalen Gruppe in
 * höchstens 5 % der Scheiben einen Ausreißer (simuliert: 5,0 %); Q3 + 1,5 · IQR auf den Radien täte es
 * in bis zu 47 %. Bei gestreckten Gruppen steigt die Rate (simuliert für 10 bis 60 Schuss: a/b 1,5 etwa
 * 8–11 %, a/b 2 etwa 11–19 %, a/b 3 etwa 17–29 %). Zwei gleich weite Ausreißer verdecken sich bei
 * wenigen Schuss gegenseitig. Kein Schuss fällt aus der Wertung. Ab fünf Schuss.
 */
export function outliers(shots: readonly MetricShot[]): { n: number; flagged: Outlier[] } | null {
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
  return { n, flagged }
}

const MATCH: readonly ShotKind[] = ["match"]

/**
 * Was die markierten Ausreißer kosten (V7): Σ (Median der übrigen Wertungswerte − Wert) über die
 * von `outliers` markierten Wertungsschüsse, in Ringen der gewählten Wertung. Negativ, wenn ein
 * Ausreißer zur Mitte hin liegt und Ringe bringt; ohne markierten Schuss 0. Null ohne Urteil über
 * Ausreißer (unter fünf Wertungsschüssen mit Lage), ohne Wert in der gewählten Wertung, wenn einem
 * markierten Schuss der Wert fehlt (dann sind die Kosten unbekannt, SF-07) und wenn kein übriger
 * Wert als Vergleich bleibt. Die schwächsten 10 % zählen nicht mehr: Einen großen Verlust dort hat
 * jede normale Gruppe, er wächst mit Streuung und Schusszahl.
 */
export function outlierLoss(
  shots: readonly MetricShot[],
  scoring: Scoring
): { n: number; count: number; loss: number } | null {
  const match = shots.filter((shot) => shot.kind === "match")
  const verdict = outliers(match)
  if (!verdict) return null
  const flagged = new Set(verdict.flagged.map((outlier) => outlier.shot))
  const valued = selectShots(inShotOrder(match), { kinds: MATCH, need: valueNeed(scoring) })
  if (valued.length === 0) return null
  const marked = valued.filter((shot) => flagged.has(shot))
  if (marked.length < flagged.size) return null
  const others = valued.filter((shot) => !flagged.has(shot)).map((s) => valueTenths(s, scoring))
  if (marked.length === 0) return { n: valued.length, count: 0, loss: 0 }
  // alle markiert: kein typischer Schuss als Vergleich
  if (others.length === 0) return null
  const center = median(others) as number
  return {
    n: valued.length,
    count: marked.length,
    loss: marked.reduce((sum, shot) => sum + (center - valueTenths(shot, scoring)), 0) / 10,
  }
}
