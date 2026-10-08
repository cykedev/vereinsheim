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

/** Irrtum des Ausreißer-Tests je Schritt: 0,04, damit der Fehlalarm über alle Schritte bei etwa 5 % bleibt */
const OUTLIER_ALPHA = 0.04

/** höchstens so viele Schritte: unter 10 Schuss einer, sonst jeder zehnte Schuss, mindestens zwei */
const outlierSteps = (n: number) => (n < 10 ? 1 : Math.max(2, Math.floor(n / 10)))

export interface Outlier {
  shot: MetricShot
  /** Nummer in der Abgabefolge seiner Art (`shotNumbers`) */
  number: number
}

/** der Schuss, der am weitesten von den übrigen liegt, gemessen an ihrer Streuung: Index und T */
function strongest(points: readonly Point[]): { index: number; t: number } {
  const m = points.length
  let best = { index: 0, t: -1 }
  points.forEach((p, i) => {
    const others = points.filter((_, j) => j !== i)
    const center = centroid(others) as Point
    const s2 = distancesTo(others, center).reduce((sum, r) => sum + r * r, 0) / (2 * (m - 2))
    const d2 = (p.xUm - center.xUm) ** 2 + (p.yUm - center.yUm) ** 2
    const t = s2 > 0 ? d2 / (2 * s2 * (1 + 1 / (m - 1))) : d2 > 0 ? Number.POSITIVE_INFINITY : 0
    if (t > best.t) best = { index: i, t }
  })
  return best
}

/**
 * Ausreißer (V6), schrittweise (verallgemeinerter ESD nach Rosner, in der Ebene): Von den m übrigen Schüssen
 * wird der weiteste gegen die anderen geprüft, d sein Abstand zu ihrem Schwerpunkt, S² ihre Streuung um
 * ihn, Σr²/(2(m − 2)). Bei einer runden Normalgruppe ist T = d² / (2 S² (1 + 1/(m − 1))) exakt
 * F(2, 2(m − 2))-verteilt; die Grenze ist das (1 − 0,04/m)-Quantil (Bonferroni). Dann wird er beiseitegelegt
 * und mit den übrigen weitergeprüft, höchstens `outlierSteps(n)` Schritte und solange fünf Schuss übrig sind.
 * Ausreißer sind alle beiseitegelegten bis zum letzten Schritt über seiner Grenze, auch wenn ein früherer
 * darunter blieb: So verdecken sich zwei nahe Abreißer nicht mehr gegenseitig (bis Oktober 2026 wurde jeder
 * Schuss einzeln geprüft; zwei gleich weite bei 10 Schuss fand die Regel dann nur in 13,7 % überhaupt). Unter
 * 10 Schuss bleibt es bei einem Schritt. α 0,04 statt 0,05 hält den Fehlalarm in einer runden normalen Gruppe
 * bei höchstens etwa 5 % der Scheiben (Simulation B2); bei gestreckten Gruppen steigt die Rate. Kein Schuss
 * fällt aus der Wertung. Ab fünf Schuss.
 */
export function outliers(shots: readonly MetricShot[]): { n: number; flagged: Outlier[] } | null {
  const selected = selectShots(shots, { need: "position" })
  const n = selected.length
  if (n < 5) return null
  const numbers = shotNumbers(shots)
  let rest = selected.map((shot) => ({
    shot,
    point: { xUm: shot.xUm as number, yUm: shot.yUm as number },
  }))
  const removed: MetricShot[] = []
  let count = 0
  for (let step = 1; step <= outlierSteps(n) && rest.length >= 5; step++) {
    const m = rest.length
    const { index, t } = strongest(rest.map((r) => r.point))
    // der letzte Schritt über seiner Grenze zählt, auch wenn ein früherer darunter blieb (Maskierung)
    if (t > fQuantile2(1 - OUTLIER_ALPHA / m, 2 * (m - 2))) count = step
    removed.push(rest[index].shot)
    rest = rest.filter((_, j) => j !== index)
  }
  const out = new Set(removed.slice(0, count))
  return {
    n,
    flagged: selected
      .filter((shot) => out.has(shot))
      .map((shot) => ({ shot, number: numbers.get(shot) as number })),
  }
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
