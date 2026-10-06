import { describe, expect, it } from "vitest"

import {
  centroid,
  covarianceEllipse,
  extremeSpread,
  meanRadius,
  r50,
  segmentGroups,
  smallestEnclosingCircle,
  standardDeviation,
  type Circle,
  type Point,
} from "./geometry"

const pt = (xUm: number, yUm: number): Point => ({ xUm, yUm })
const SQUARE = [pt(0, 0), pt(2000, 0), pt(0, 2000), pt(2000, 2000)]

// Fester Zufallsgenerator (LCG), damit die Eigenschaftstests wiederholbar sind.
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function circleThrough2(a: Point, b: Point): Circle {
  return {
    xUm: (a.xUm + b.xUm) / 2,
    yUm: (a.yUm + b.yUm) / 2,
    radiusUm: Math.hypot(a.xUm - b.xUm, a.yUm - b.yUm) / 2,
  }
}

function circumcircle(a: Point, b: Point, c: Point): Circle | null {
  const bx = b.xUm - a.xUm
  const by = b.yUm - a.yUm
  const cx = c.xUm - a.xUm
  const cy = c.yUm - a.yUm
  const d = 2 * (bx * cy - by * cx)
  if (d === 0) return null
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const ux = (cy * b2 - by * c2) / d
  const uy = (bx * c2 - cx * b2) / d
  return { xUm: a.xUm + ux, yUm: a.yUm + uy, radiusUm: Math.hypot(ux, uy) }
}

// Brute Force: kleinster Kreis aus allen Paaren und Dreiergruppen, der alle Punkte enthält.
function bruteForceRadius(points: readonly Point[]): number {
  const containsAll = (c: Circle) =>
    points.every((p) => Math.hypot(p.xUm - c.xUm, p.yUm - c.yUm) <= c.radiusUm * (1 + 1e-9) + 1e-6)
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const pair = circleThrough2(points[i], points[j])
      if (pair.radiusUm < best && containsAll(pair)) best = pair.radiusUm
      for (let k = j + 1; k < points.length; k++) {
        const triple = circumcircle(points[i], points[j], points[k])
        if (triple && triple.radiusUm < best && containsAll(triple)) best = triple.radiusUm
      }
    }
  }
  return best
}

describe("Schwerpunkt und Streukreis", () => {
  it("Quadrat: Schwerpunkt in der Mitte, Kreis über die Diagonale", () => {
    expect(centroid(SQUARE)).toEqual({ xUm: 1000, yUm: 1000 })
    const circle = smallestEnclosingCircle(SQUARE)
    expect(circle?.xUm).toBeCloseTo(1000, 6)
    expect(circle?.yUm).toBeCloseTo(1000, 6)
    expect(circle?.radiusUm).toBeCloseTo(1414.2136, 3)
    expect(extremeSpread(SQUARE)).toBeCloseTo(2828.4271, 3)
  })

  it("gleichseitiges Dreieck: Umkreis", () => {
    const side = 3000
    const circle = smallestEnclosingCircle([
      pt(0, 0),
      pt(side, 0),
      pt(side / 2, (side * Math.sqrt(3)) / 2),
    ])
    expect(circle?.radiusUm).toBeCloseTo(side / Math.sqrt(3), 6)
  })

  it("stumpfes Dreieck: Kreis über der langen Seite", () => {
    const circle = smallestEnclosingCircle([pt(0, 0), pt(4000, 0), pt(2000, 500)])
    expect(circle).toEqual({ xUm: 2000, yUm: 0, radiusUm: 2000 })
  })

  it("Punkte auf einer Linie: halber größter Abstand", () => {
    const circle = smallestEnclosingCircle([pt(0, 0), pt(1000, 0), pt(5000, 0)])
    expect(circle).toEqual({ xUm: 2500, yUm: 0, radiusUm: 2500 })
  })

  it("ein Punkt hat Radius 0, keine Punkte keinen Kreis", () => {
    expect(smallestEnclosingCircle([pt(123, -456)])).toEqual({ xUm: 123, yUm: -456, radiusUm: 0 })
    expect(smallestEnclosingCircle([])).toBeNull()
    expect(centroid([])).toBeNull()
    expect(extremeSpread([])).toBeNull()
  })

  it("Eigenschaft: enthält alle Punkte und ist der kleinste Kreis (300 Zufallsmengen)", () => {
    const random = lcg(20261006)
    for (let set = 0; set < 300; set++) {
      const n = 3 + Math.floor(random() * 23)
      const points = Array.from({ length: n }, () =>
        pt(Math.round((random() - 0.5) * 40000), Math.round((random() - 0.5) * 40000))
      )
      const circle = smallestEnclosingCircle(points)
      expect(circle).not.toBeNull()
      if (!circle) continue
      for (const p of points) {
        expect(Math.hypot(p.xUm - circle.xUm, p.yUm - circle.yUm)).toBeLessThanOrEqual(
          circle.radiusUm + 1e-6
        )
      }
      const best = bruteForceRadius(points)
      expect(Math.abs(circle.radiusUm - best)).toBeLessThanOrEqual(best * 1e-9 + 1e-6)
    }
  })

  it("Verschieben ändert keine Streumaße", () => {
    const random = lcg(42)
    const points = Array.from({ length: 12 }, () =>
      pt(Math.round(random() * 9000), Math.round(random() * 9000))
    )
    const moved = points.map((p) => pt(p.xUm + 12340, p.yUm - 5670))
    expect(smallestEnclosingCircle(moved)?.radiusUm).toBeCloseTo(
      smallestEnclosingCircle(points)?.radiusUm ?? Number.NaN,
      6
    )
    expect(meanRadius(moved)).toBeCloseTo(meanRadius(points) ?? Number.NaN, 6)
    expect(r50(moved)).toBeCloseTo(r50(points) ?? Number.NaN, 6)
    expect(standardDeviation(moved.map((p) => p.xUm))).toBeCloseTo(
      standardDeviation(points.map((p) => p.xUm)) ?? Number.NaN,
      6
    )
  })
})

describe("Radien und Streuung", () => {
  it("R50 ist der Median der Abstände zum Schwerpunkt, der mittlere Radius ihr Mittel", () => {
    // Quadrat plus Mittelpunkt: viermal 1414,21 µm und einmal 0.
    const points = [...SQUARE, pt(1000, 1000)]
    expect(r50(points)).toBeCloseTo(1414.2136, 3)
    expect(meanRadius(points)).toBeCloseTo(1131.3708, 3)
  })

  it("Streuung mit n − 1", () => {
    expect(standardDeviation([-1000, 0, 1000])).toBe(1000)
    expect(standardDeviation([500])).toBeNull()
  })

  it("Ellipse: entlang x gestreckt liegt die große Achse bei 0, um 45° gedreht bei π/4", () => {
    const stretched = [pt(-3000, 0), pt(3000, 0), pt(0, -1000), pt(0, 1000)]
    const ellipse = covarianceEllipse(stretched)
    expect(ellipse?.angleRad).toBeCloseTo(0, 9)
    expect(ellipse?.majorUm).toBeCloseTo(Math.sqrt(6e6), 3)
    expect(ellipse?.minorUm).toBeCloseTo(Math.sqrt(2e6 / 3), 3)

    const turn = Math.PI / 4
    const rotated = stretched.map((p) =>
      pt(
        p.xUm * Math.cos(turn) - p.yUm * Math.sin(turn),
        p.xUm * Math.sin(turn) + p.yUm * Math.cos(turn)
      )
    )
    expect(covarianceEllipse(rotated)?.angleRad).toBeCloseTo(Math.PI / 4, 9)
    expect(covarianceEllipse([pt(0, 0)])).toBeNull()
  })
})

describe("segmentGroups (Visier verstellt, SF-63)", () => {
  const shots = Array.from({ length: 10 }, (_, i) => i + 1)

  it("teilt nach den angegebenen Schussnummern", () => {
    expect(segmentGroups(shots, [4]).map((g) => g.length)).toEqual([4, 6])
    expect(segmentGroups(shots, [7, 2]).map((g) => g.length)).toEqual([2, 5, 3])
  })

  it("ohne Verstellung oder mit Nummern am Rand bleibt es eine Gruppe", () => {
    expect(segmentGroups(shots, [])).toEqual([shots])
    expect(segmentGroups(shots, [0, 10, 10])).toEqual([shots])
  })
})
