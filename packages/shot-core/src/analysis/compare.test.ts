import { describe, expect, it } from "vitest"

import { normalPoints } from "../__fixtures__/random"
import type { Point } from "../geometry"
import { compareCenters } from "./compare"

const shifted = (points: readonly Point[], dxUm: number, dyUm = 0) =>
  points.map((p) => ({ xUm: p.xUm + dxUm, yUm: p.yUm + dyUm }))

// ein Kreuz um (0 | 0) mit der Mitte: Mittel (0 | 0), sxx = syy = 0,5 mm², sxy = 0
const CROSS: Point[] = [
  { xUm: -1000, yUm: 0 },
  { xUm: 1000, yUm: 0 },
  { xUm: 0, yUm: -1000 },
  { xUm: 0, yUm: 1000 },
  { xUm: 0, yUm: 0 },
]

describe("compareCenters (C2, C3)", () => {
  it("dieselben Punkte auf beiden Seiten: p 1, kein Versatz", () => {
    const points = normalPoints(20, 1500, 3)
    const result = compareCenters(points, points)
    expect(result?.p).toBeCloseTo(1, 12)
    expect(result?.verdict).toBe("none")
    expect(result?.distanceUm).toBe(0)
  })

  it("von Hand: Kreuz gegen dasselbe Kreuz 2 mm weiter rechts, T² 20, F 8,75, p = 3,5^−3,5", () => {
    const result = compareCenters(CROSS, shifted(CROSS, 2000))
    expect(result?.shiftUm).toEqual({ xUm: -2000, yUm: 0 })
    expect(result?.distanceUm).toBe(2000)
    expect(result?.p).toBeCloseTo(3.5 ** -3.5, 12)
    expect(result?.verdict).toBe("shifted")
  })

  it("20 Punkte gegen dieselben 3 σ weiter rechts: versetzt, A liegt rechts", () => {
    const b = normalPoints(20, 1500, 11)
    const result = compareCenters(shifted(b, 4500), b)
    expect(result?.verdict).toBe("shifted")
    expect(result?.shiftUm.xUm).toBeGreaterThan(0)
    expect(result?.distanceUm).toBeGreaterThan(4500 * 0.9)
    expect(result?.distanceUm).toBeLessThan(4500 * 1.1)
    expect(result?.a.n).toBe(20)
  })

  it("unter fünf Punkten auf einer Seite: zu wenige, ohne p", () => {
    const result = compareCenters(CROSS.slice(0, 4), CROSS)
    expect(result?.verdict).toBe("few")
    expect(result?.p).toBeNull()
    expect(result?.a.n).toBe(4)
  })

  it("alle Punkte auf einer Linie: zu wenige", () => {
    const line = [0, 1, 2, 3, 4].map((i) => ({ xUm: i * 1000, yUm: 0 }))
    expect(compareCenters(line, shifted(line, 0, 0))?.verdict).toBe("few")
  })

  it("ohne Punkte auf einer Seite: null", () => {
    expect(compareCenters([], CROSS)).toBeNull()
  })
})
