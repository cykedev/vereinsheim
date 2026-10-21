// Trefferbild über viele Scheiben (Katalog L9, L10, L7): die Form über alle Scheiben, jede um ihre eigene Mitte
// (gepoolt), die Lage als Schwerpunkt je Scheibe und die Richtung, in die Schüsse aus der Gruppe reißen. Einheit
// ist die Scheibe, wo ein Urteil über die Lage fällt; die Form zählt Abweichungen innerhalb der Scheiben. Lagen in
// µm, Mitte (0 | 0), x rechts, y oben, wie gezeichnet (ohne verdächtige Schüsse, `cardMarks`).

import type { Point } from "../geometry"
import { confidenceOf } from "./hotelling"

/** eine Scheibe des Zeitraums mit den Lagen ihrer Schüsse wie gezeichnet */
export interface PatternCard {
  id: string
  atMs: number
  points: readonly Point[]
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
