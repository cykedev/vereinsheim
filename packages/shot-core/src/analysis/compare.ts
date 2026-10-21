// Zwei Seiten im Vergleich (C2, C3): die Lage zweier Stichproben von Punkten, die Schüsse zweier Scheiben und das Bild
// beider Seiten. Die Funktionen nehmen Werte und Punkte, keine Scheiben einer App: Schüsse einer Scheibe (Einheit der
// Schuss) oder Mitten vieler Scheiben (Einheit die Scheibe). Lagen in µm, Mitte (0 | 0), x rechts, y oben.

import { centroid, type Point } from "../geometry"
import { MIN_CARDS_PER_SIDE } from "./period"

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
