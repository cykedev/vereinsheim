// Hotelling-T² eines Schwerpunkts gegen die Mitte, über beliebige Punkte: die Treffer einer Scheibe (`mpiConfidence`,
// L3) und die Schwerpunkte vieler Scheiben (`positionOverTime`, L10). Nicht über `./analysis` exportiert: eine Hilfe,
// keine Auswertung (`ANALYSIS_CATALOG`).

import { centroid, covarianceEllipse, type Point } from "../geometry"
import { fQuantile2 } from "../stats"
import type { MpiConfidence } from "./position"

/**
 * Hotelling-T² des Schwerpunkts beliebiger Punkte gegen die Mitte, wie `mpiConfidence`: für die Treffer einer
 * Scheibe und für die Schwerpunkte vieler Scheiben (L10, `pattern.ts`, Einheit die Scheibe)
 */
export function confidenceOf(points: readonly Point[]): MpiConfidence | null {
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
  if (!(det > 1e-12 * sxx * syy)) return null
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
