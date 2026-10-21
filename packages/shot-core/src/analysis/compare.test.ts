import { describe, expect, it } from "vitest"

import { normalPoints } from "../__fixtures__/random"
import type { Point } from "../geometry"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { compareCenters, comparePicture, compareShots } from "./compare"

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

/** ein Wertungsschuss mit Wert und Lage */
const shot = (
  decimalTenths: number,
  xUm: number | null = 0,
  yUm: number | null = 0
): MetricShot => ({
  xUm,
  yUm,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind: "match",
  series: 1,
})

/** Schüsse an den Punkten mit gleichem Wert */
const shotsAt = (points: readonly Point[], decimalTenths = 100) =>
  points.map((p) => shot(decimalTenths, p.xUm, p.yUm))

describe("compareShots (C2)", () => {
  const points = normalPoints(40, 1500, 5)

  it("dieselbe Scheibe zweimal: kein Unterschied in Ergebnis, Streuung und Lage", () => {
    const card = points.map((p, i) => shot(90 + (i % 10), p.xUm, p.yUm))
    const result = compareShots(card, card, "decimal")
    expect(result.result?.verdict).toBe("unclear")
    expect(result.spread?.verdict).toBe("unclear")
    expect(result.position?.verdict).toBe("none")
    expect(result.shots).toEqual({ a: 40, b: 40 })
  })

  it("lauter 10,4 gegen lauter 9,0: A höher, Δ = A − B = 1,4", () => {
    const result = compareShots(shotsAt(points, 104), shotsAt(points, 90), "decimal")
    expect(result.result?.verdict).toBe("higher")
    expect(result.result?.delta).toBeCloseTo(1.4, 12)
  })

  it("in ganzen Ringen zählt der Ring: 10,4 gegen 10,0 ist gleich", () => {
    const result = compareShots(shotsAt(points, 104), shotsAt(points, 100), "rings")
    expect(result.result?.delta).toBe(0)
    expect(result.result?.verdict).toBe("unclear")
  })

  it("A doppelt so weit gestreut: Streuung höher (größer), Lage gleich", () => {
    const wide = points.map((p) => ({ xUm: p.xUm * 2, yUm: p.yUm * 2 }))
    const result = compareShots(shotsAt(wide), shotsAt(points), "decimal")
    expect(result.spread?.verdict).toBe("higher")
    expect(result.spread?.delta).toBeGreaterThan(0)
  })

  it("Probeschüsse zählen nicht, eine Scheibe nur aus Probe zählt wie am Ausdruck", () => {
    const probe = (s: MetricShot): MetricShot => ({ ...s, kind: "probe", series: null })
    const withProbe = [...shotsAt(points.slice(0, 5), 50).map(probe), ...shotsAt(points, 100)]
    expect(compareShots(withProbe, shotsAt(points), "decimal").result?.a.n).toBe(40)
    const onlyProbe = shotsAt(points.slice(0, 10), 100).map(probe)
    expect(compareShots(onlyProbe, shotsAt(points), "decimal").result?.a.n).toBe(10)
  })

  it("ohne Lage und verdächtig: im Ergebnis ja, in Streuung und Lage nicht", () => {
    const suspicious = { ...shot(100, 9000, 9000), flags: [FLAG_SUSPICIOUS] }
    const a = [...shotsAt(points), shot(100, null, null), suspicious]
    const result = compareShots(a, shotsAt(points), "decimal")
    expect(result.result?.a.n).toBe(42)
    expect(result.spread?.a.n).toBe(40)
    expect(result.position?.a.n).toBe(40)
  })
})

describe("comparePicture (C2, C3)", () => {
  it("60 gegen 60 Punkte: zwei Umrisse aus Rastern von 64 × 64 auf einem Ausschnitt", () => {
    const picture = comparePicture(normalPoints(60, 1500, 1), normalPoints(60, 1500, 2))
    expect(picture.style).toBe("outlines")
    if (picture.style !== "outlines") return
    expect(picture.a.grid.cells).toHaveLength(64 * 64)
    expect(picture.b.grid.cells).toHaveLength(64 * 64)
    expect(picture.a.grid.levels).toHaveLength(6)
    expect(picture.halfUm).toBeGreaterThan(1500)
  })

  it("60 gegen 40 Punkte: Punkte, jeder auf 10 µm, die Mitten auf ganze µm", () => {
    const picture = comparePicture(normalPoints(60, 1500, 1), normalPoints(40, 1500, 2))
    expect(picture.style).toBe("dots")
    if (picture.style !== "dots") return
    expect(picture.a.points).toHaveLength(60)
    expect(picture.b.points).toHaveLength(40)
    expect(Number.isInteger(picture.a.center?.xUm)).toBe(true)
  })

  it("die Gruppe: bei Punkten bis zum weitesten, bei Umrissen bis 95 von 100 um die Mitte aller", () => {
    const dots = comparePicture(CROSS, shifted(CROSS, 2000))
    // Mitte (1 | 0) mm, der weiteste Punkt (−1 | 0) bzw. (3 | 0) mm liegt 2 mm davon
    expect(dots.focus).toEqual({ xUm: 1000, yUm: 0, radiusUm: 2000 })
    const far = [...normalPoints(59, 1500, 1), { xUm: 40_000, yUm: 0 }]
    const outlines = comparePicture(far, normalPoints(60, 1500, 2))
    expect(outlines.style).toBe("outlines")
    // ein einzelner Abreißer bei 40 mm zieht den Ausschnitt nicht auf
    expect(outlines.focus!.radiusUm).toBeLessThan(5000)
    expect(comparePicture([], []).focus).toBeNull()
  })

  it("eine leere Seite: Punkte, ihre Mitte null", () => {
    const picture = comparePicture([], CROSS)
    expect(picture.style).toBe("dots")
    if (picture.style !== "dots") return
    expect(picture.a.center).toBeNull()
    expect(picture.b.center).toEqual({ xUm: 0, yUm: 0 })
  })

  it("kein −0 nach JSON (Punkte knapp links der Mitte)", () => {
    const near = [{ xUm: -3, yUm: -4 }]
    const json = JSON.stringify(comparePicture(near, near))
    expect(json).not.toContain("-0")
    expect(JSON.parse(json).a.points).toEqual([[0, 0]])
  })
})
