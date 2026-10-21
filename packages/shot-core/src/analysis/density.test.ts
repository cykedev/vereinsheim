import { describe, expect, it } from "vitest"

import { normalPoints } from "../__fixtures__/random"
import type { Point } from "../geometry"
import { densityGrid, HEAT_SHARES, patternHalf } from "./density"

describe("densityGrid", () => {
  it("ein Punkt in der Mitte: die mittlere Zelle ist die dichteste, das Raster ist symmetrisch", () => {
    const grid = densityGrid([{ xUm: 0, yUm: 0 }], 2500, 5)
    expect(grid.size).toBe(5)
    expect(grid.cells[12]).toBe(255)
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 5; col++) {
        expect(grid.cells[row * 5 + col]).toBe(grid.cells[col * 5 + row])
        expect(grid.cells[row * 5 + col]).toBe(grid.cells[row * 5 + (4 - col)])
        expect(grid.cells[row * 5 + col]).toBe(grid.cells[(4 - row) * 5 + col])
      }
  })

  it("Zeile 0 liegt oben: ein Punkt oben links füllt die erste Zelle", () => {
    const grid = densityGrid([{ xUm: -2400, yUm: 2400 }], 2500, 5)
    expect(grid.cells[0]).toBe(255)
    expect(grid.cells[24]).toBeLessThan(255)
  })

  it("die Flächen halten etwa die Hälfte und neun Zehntel der Punkte einer Normalverteilung", () => {
    const points = normalPoints(2000, 1000, 20261021)
    const half = patternHalf(points)
    const grid = densityGrid(points, half)
    const cell = (2 * half) / grid.size
    const valueAt = (p: Point) => {
      const col = Math.floor((p.xUm + half) / cell)
      const row = Math.floor((half - p.yUm) / cell)
      return grid.cells[row * grid.size + col] ?? 0
    }
    const share = (level: number) =>
      points.filter((p) => valueAt(p) >= level).length / points.length
    // jedes Band hält etwa seinen Anteil der Punkte, von außen nach innen steigen die Grenzen
    HEAT_SHARES.forEach((expected, i) => {
      expect(share(grid.levels[i]), `Band ${expected}`).toBeGreaterThan(expected - 0.06)
      expect(share(grid.levels[i]), `Band ${expected}`).toBeLessThan(expected + 0.06)
    })
    for (let i = 1; i < grid.levels.length; i++)
      expect(grid.levels[i]).toBeGreaterThan(grid.levels[i - 1])
  })

  it("ohne Punkte ein leeres Raster", () => {
    const grid = densityGrid([], 1000, 4)
    expect(grid.cells).toEqual(new Array(16).fill(0))
    expect(grid.levels).toEqual([0, 0, 0, 0, 0])
  })
})

describe("patternHalf", () => {
  it("Punkte auf einem Kreis mit 2 mm: 2,3 mm", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({
      xUm: 2000 * Math.cos((i * Math.PI) / 6),
      yUm: 2000 * Math.sin((i * Math.PI) / 6),
    }))
    expect(patternHalf(points)).toBeCloseTo(2300, 6)
  })

  it("mindestens 1 mm, auch ohne Punkte", () => {
    expect(patternHalf([{ xUm: 100, yUm: 0 }])).toBe(1000)
    expect(patternHalf([])).toBe(1000)
  })
})
