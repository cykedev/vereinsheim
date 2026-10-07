// Lage und Systematik: Ist der Versatz echt oder Zufall (Hotelling-T²), wie viele Ringe kostet die Lage
// gegen die Streuung, in welche Richtungen gehen die Treffer und wandert die Gruppe (Katalog L3, L4, L6,
// L8, dazu der Ringverlust E9). Lagen in µm, Mitte (0 | 0), x rechts, y oben.

import { centroid, covarianceEllipse, distancesTo, type Point } from "../geometry"
import { inShotOrder, selectShots, stepsInOrder, type MetricShot, type ShotKind } from "../metrics"
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

/**
 * Ab drei Schuss; liegen alle Treffer auf einer Linie, lässt sich nichts sagen. Die Schwelle für „auf
 * einer Linie“ ist relativ (|Korrelation| bis auf 10⁻¹² an 1), weil die Rundung bei exakt kollinearen
 * Treffern einen winzigen Rest lässt, der sonst ein riesiges T² ergäbe.
 */
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

interface Totals {
  /** Summe in Zehntelwertung, in Ringen (103 = 103,0) */
  decimal: number
  /** Summe in ganzen Ringen */
  rings: number
}

export interface RingLossSplit {
  /** Wertungsschüsse mit Lage, aus ihr neu gewertet; verdächtige zählen nicht (SF-15) */
  n: number
  actual: Totals
  /**
   * jeder Treffer um den Schwerpunkt der übrigen verschoben (Leave-one-out) und neu gewertet:
   * schätzt, was eine Korrektur um den gemessenen Versatz auf neuen Schüssen bringt. In der
   * Stichprobe zentriert wäre das zu optimistisch, weil der Schwerpunkt aus denselben Schüssen
   * stammt.
   */
  centered: Totals
  /**
   * Ringverlust zum Höchstwert (Katalog E9): Lage plus Streuung. Nur, wenn jeder Wertungsschuss
   * darin steckt; fehlt einem die Lage oder ist er verdächtig, null: Eine Summe über einen Teil der
   * Schüsse ist kein Ringverlust der Scheibe (SF-07). Lage und Streuung bleiben dann eine Schätzung
   * über die übrigen.
   */
  total: Totals | null
  /** zentriert minus Ist; ohne echten Versatz meist leicht negativ, bei schiefen Gruppen auch deutlich */
  positionLoss: Totals
  spreadLoss: Totals
  /**
   * belastbar ab 10 Schuss, wenn die Lage echt ist (L3) und das Zentrieren nicht kostet: Bei schiefen
   * Gruppen ist der Schwerpunkt nicht der beste Punkt zum Verschieben, dann taugt die Aufteilung nicht.
   * Nie amtlich.
   */
  reliable: boolean
}

const MATCH: readonly ShotKind[] = ["match"]

interface Score {
  tenths: number
  rings: number
}

function score(target: TargetImage, points: readonly Point[]): Score {
  let tenths = 0
  let rings = 0
  for (const p of points) {
    const s = scoreFromCoordinates(target, Math.round(p.xUm), Math.round(p.yUm))
    tenths += s.decimalTenths
    rings += s.ring
  }
  return { tenths, rings }
}

// in Zehnteln gerechnet und erst am Ende geteilt: 7,4 statt 7,400000000000006
const totals = (s: Score): Totals => ({ decimal: s.tenths / 10, rings: s.rings })
const minus = (a: Score, b: Score): Totals => ({
  decimal: (a.tenths - b.tenths) / 10,
  rings: a.rings - b.rings,
})

/**
 * Ringverlust nach Ursache: Lage (Versatz des Schwerpunkts) gegen Streuung (Gruppe um ihn), L4.
 * Gewertet wird aus der Lage, nur mit den Wertungsschüssen mit Lage; den Ringverlust der Scheibe
 * (`total`) gibt es nur, wenn das alle sind.
 */
export function ringLossSplit(
  shots: readonly MetricShot[],
  target: TargetImage
): RingLossSplit | null {
  const match = selectShots(shots, { kinds: MATCH, need: "position" })
  const points = match.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  const n = points.length
  if (n < 2) return null
  const center = centroid(points) as Point
  const actual = score(target, points)
  // pᵢ − m₋ᵢ = (pᵢ − m) · n/(n − 1): der Schwerpunkt der übrigen, ohne n Schwerpunkte zu rechnen
  const stretch = n / (n - 1)
  const centered = score(
    target,
    points.map((p) => ({
      xUm: (p.xUm - center.xUm) * stretch,
      yUm: (p.yUm - center.yUm) * stretch,
    }))
  )
  const best = { tenths: n * 109, rings: n * 10 }
  const positionLoss = minus(centered, actual)
  const complete = shots.filter((shot) => shot.kind === "match").length === n
  return {
    n,
    actual: totals(actual),
    centered: totals(centered),
    total: complete ? minus(best, actual) : null,
    positionLoss,
    spreadLoss: minus(best, centered),
    reliable:
      n >= 10 &&
      mpiConfidence(match)?.real === true &&
      positionLoss.decimal > 0 &&
      positionLoss.rings >= 0,
  }
}

/** Ab so vielen Treffern sagt die Richtungsuhr etwas (Katalog L6) */
const CLOCK_MIN_SHOTS = 30

/**
 * Richtungsuhr: Zahl der Treffer je Uhrzeit um die Mitte oder einen anderen Bezugspunkt; Index 0 ist
 * 12 Uhr (oben), 3 ist rechts. Treffer genau im Bezugspunkt haben keine Richtung und zählen nicht.
 * Aussagekräftig erst ab 30 Treffern (`reliable`); darunter ist sie ein Bild, kein Befund.
 */
export function directionClock(
  shots: readonly MetricShot[],
  reference: Point = { xUm: 0, yUm: 0 }
): { n: number; counts: number[]; reliable: boolean } {
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
  return { n, counts, reliable: n >= CLOCK_MIN_SHOTS }
}

/**
 * Drift in der Abgabefolge: das von-Neumann-Verhältnis, je Sprung und je Freiheitsgrad normiert: (Σ
 * Sprung²/k) / (Σ rᵢ²/(n − 1)). Um 2 bei unabhängigen Schüssen, deutlich darunter wandert die
 * Gruppe; ein Urteil gibt es nicht, weil die Zahl bei kleinem n stark schwankt. Ø und größter
 * Sprung entfallen (Oktober 2026): Der Ø Sprung ist im Mittel √π · σ, sagt also nichts Neues, und
 * der größte wächst mit der Schusszahl. Fehlt ein Schuss (Sprung in `seq`, SF-30), zählt der Sprung
 * darüber nicht, und die Normierung je Sprung hält das Verhältnis trotzdem bei 2. Ab drei Schuss.
 */
export function drift(shots: readonly MetricShot[]): { n: number; vonNeumann: number } | null {
  const steps = stepsInOrder(selectShots(inShotOrder(shots), { need: "position" }))
  if (steps.length < 3) return null
  const points = steps.map(({ shot }) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  const jumps: number[] = []
  for (let i = 1; i < points.length; i++) {
    if (steps[i].gapBefore) continue
    jumps.push(Math.hypot(points[i].xUm - points[i - 1].xUm, points[i].yUm - points[i - 1].yUm))
  }
  const sumSquares = distancesTo(points, centroid(points) as Point).reduce((s, r) => s + r * r, 0)
  if (jumps.length === 0 || sumSquares === 0) return null
  const n = points.length
  return {
    n,
    vonNeumann: jumps.reduce((s, j) => s + j * j, 0) / jumps.length / (sumSquares / (n - 1)),
  }
}
