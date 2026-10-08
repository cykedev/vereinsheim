// Geometrie von Trefferbildern: Schwerpunkt, Streukreis, Radien, Streuung, Ellipse.
//
// Gerechnet wird in µm mit Gleitkomma; die Lagen selbst sind ganze µm (SP-1.1). Der Streukreis ist
// der kleinste Kreis um alle Trefferzentren, ohne Kaliber (Mitte zu Mitte). Daneben gibt es den
// größten Abstand zweier Treffer: Welches der beiden Meytons „Trefferkreis“ ist, klärt SP-0.6.

export interface Point {
  xUm: number
  yUm: number
}

export interface Circle {
  xUm: number
  yUm: number
  radiusUm: number
}

/** Toleranz für „liegt im Kreis“, gegen Rundungsfehler der Gleitkomma-Rechnung */
const EPS_UM = 1e-6

export function centroid(points: readonly Point[]): Point | null {
  if (points.length === 0) return null
  let x = 0
  let y = 0
  for (const p of points) {
    x += p.xUm
    y += p.yUm
  }
  return { xUm: x / points.length, yUm: y / points.length }
}

export function distancesTo(points: readonly Point[], center: Point): number[] {
  return points.map((p) => Math.hypot(p.xUm - center.xUm, p.yUm - center.yUm))
}

function contains(circle: Circle, p: Point): boolean {
  return Math.hypot(p.xUm - circle.xUm, p.yUm - circle.yUm) <= circle.radiusUm + EPS_UM
}

function circleThrough2(a: Point, b: Point): Circle {
  return {
    xUm: (a.xUm + b.xUm) / 2,
    yUm: (a.yUm + b.yUm) / 2,
    radiusUm: Math.hypot(a.xUm - b.xUm, a.yUm - b.yUm) / 2,
  }
}

/**
 * Umkreis dreier Punkte. Der Rückfall auf den Kreis über die beiden äußeren schützt nur vor Rundung:
 * In exakter Rechnung liegen die drei Randpunkte des Verfahrens nie auf einer Linie.
 */
function circleThrough3(a: Point, b: Point, c: Point): Circle {
  const bx = b.xUm - a.xUm
  const by = b.yUm - a.yUm
  const cx = c.xUm - a.xUm
  const cy = c.yUm - a.yUm
  const d = 2 * (bx * cy - by * cx)
  if (d !== 0) {
    const b2 = bx * bx + by * by
    const c2 = cx * cx + cy * cy
    const ux = (cy * b2 - by * c2) / d
    const uy = (bx * c2 - cx * b2) / d
    if (Number.isFinite(ux) && Number.isFinite(uy)) {
      return { xUm: a.xUm + ux, yUm: a.yUm + uy, radiusUm: Math.hypot(ux, uy) }
    }
  }
  const pairs: [Point, Point][] = [
    [a, b],
    [a, c],
    [b, c],
  ]
  return pairs
    .map(([p, q]) => circleThrough2(p, q))
    .reduce((widest, circle) => (circle.radiusUm > widest.radiusUm ? circle : widest))
}

/**
 * Kleinster Kreis um alle Punkte, inkrementell nach Welzl ohne Zufall: Liegt ein Punkt außerhalb,
 * wird der Kreis mit ihm auf dem Rand neu gebaut, dann mit zwei und drei Randpunkten. Ohne Mischen
 * ist das Ergebnis deterministisch; für einige hundert Schuss reicht auch der ungünstigste Fall.
 */
export function smallestEnclosingCircle(points: readonly Point[]): Circle | null {
  if (points.length === 0) return null
  let circle: Circle = { xUm: points[0].xUm, yUm: points[0].yUm, radiusUm: 0 }
  for (let i = 1; i < points.length; i++) {
    if (contains(circle, points[i])) continue
    circle = { xUm: points[i].xUm, yUm: points[i].yUm, radiusUm: 0 }
    for (let j = 0; j < i; j++) {
      if (contains(circle, points[j])) continue
      circle = circleThrough2(points[i], points[j])
      for (let k = 0; k < j; k++) {
        if (contains(circle, points[k])) continue
        circle = circleThrough3(points[i], points[j], points[k])
      }
    }
  }
  return circle
}

/** größter Abstand zweier Treffer */
export function extremeSpread(points: readonly Point[]): number | null {
  if (points.length === 0) return null
  let widest = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      widest = Math.max(
        widest,
        Math.hypot(points[i].xUm - points[j].xUm, points[i].yUm - points[j].yUm)
      )
    }
  }
  return widest
}

/**
 * Mittel der Abstände zum Schwerpunkt. Keine Kennzahl mehr (P3 entfiel im Oktober 2026, ≈ 1,24 · σ̂);
 * bleibt als Baustein, etwa für Vergleiche mit Literatur, die den mittleren Radius angibt.
 */
export function meanRadius(points: readonly Point[]): number | null {
  const center = centroid(points)
  if (!center) return null
  const distances = distancesTo(points, center)
  return distances.reduce((sum, d) => sum + d, 0) / distances.length
}

/**
 * Median der Abstände zum Schwerpunkt. Robuster als der mittlere Radius, aber der Schwerpunkt selbst
 * ist ein Mittel, den ein ferner Ausreißer verschiebt; die Kennzahl R50 lässt Fehlschüsse deshalb weg.
 */
export function r50(points: readonly Point[]): number | null {
  const center = centroid(points)
  if (!center) return null
  const distances = distancesTo(points, center).sort((a, b) => a - b)
  const middle = Math.floor(distances.length / 2)
  return distances.length % 2 === 1
    ? distances[middle]
    : (distances[middle - 1] + distances[middle]) / 2
}

/** Stichproben-Standardabweichung (n − 1); unter zwei Werten keine. */
export function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squares = values.reduce((sum, v) => sum + (v - mean) ** 2, 0)
  return Math.sqrt(squares / (values.length - 1))
}

/**
 * Streu-Ellipse aus der Kovarianzmatrix (n − 1): Halbachsen sind die Wurzeln der Eigenwerte (1 σ),
 * der Winkel zeigt die große Achse, von der x-Achse gegen den Uhrzeigersinn (y nach oben), in [0, π).
 * In SVG mit y nach unten ist er −θ.
 */
export function covarianceEllipse(
  points: readonly Point[]
): { majorUm: number; minorUm: number; angleRad: number } | null {
  const center = centroid(points)
  if (!center || points.length < 2) return null
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
  const n = points.length - 1
  sxx /= n
  syy /= n
  sxy /= n
  const half = (sxx + syy) / 2
  const spread = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2)
  let angle = Math.atan2(2 * sxy, sxx - syy) / 2
  if (angle < 0) angle += Math.PI
  return {
    majorUm: Math.sqrt(half + spread),
    minorUm: Math.sqrt(Math.max(0, half - spread)),
    angleRad: angle,
  }
}
