import { describe, expect, it } from "vitest"

import { MATCH } from "../__fixtures__/cards"
import { r50 } from "../geometry"
import type { MetricShot } from "../metrics"
import {
  cardTrend,
  fatigue,
  longestRun,
  movingAverage,
  mpiPath,
  seriesCurve,
  seriesSpread,
} from "./course"

const shot = (i: number, decimalTenths: number, xUm = 0, yUm = 0, series = 1): MetricShot => ({
  ...MATCH[0],
  seq: i + 1,
  firedAtMs: i * 40_000,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen: false,
  xUm,
  yUm,
  series,
})

// Zehn ganzzahlige Punkte symmetrisch um (0 | 0): sechs auf den Achsen im Abstand r, vier diagonal
// (a | a) mit a ≈ r/√2. Der Schwerpunkt liegt genau in der Mitte, der Median der Abstände genau bei r.
const ring = (radius: number, k: number) => {
  const a = Math.round(radius / Math.SQRT2)
  const points = [
    [radius, 0],
    [0, radius],
    [-radius, 0],
    [0, -radius],
    [a, a],
    [-a, a],
    [-a, -a],
    [a, -a],
    [radius, 0],
    [-radius, 0],
  ]
  return points[k]
}

// Zwanzig Schuss: die ersten zehn 10,5 eng (Radius 0,5 mm), die letzten zehn 10,1 weiter (1,5 mm).
const TIRED: MetricShot[] = Array.from({ length: 20 }, (_, i) => {
  const [x, y] = ring(i < 10 ? 500 : 1500, i % 10)
  return shot(i, i < 10 ? 105 : 101, x, y, i < 10 ? 1 : 2)
})

describe("Serienkurve, Streuung und Schwerpunkt je Serie (I1, I5, I6)", () => {
  it("Serien in Reihenfolge, in Zehnteln und in ganzen Ringen", () => {
    expect(seriesCurve(TIRED, "decimal")).toEqual([
      { series: 1, shots: 10, total: 105 },
      { series: 2, shots: 10, total: 101 },
    ])
    expect(seriesCurve(TIRED, "rings")).toEqual([
      { series: 1, shots: 10, total: 100 },
      { series: 2, shots: 10, total: 100 },
    ])
  })

  it("ohne Zehntel gibt es die Kurve nur in ganzen Ringen (SF-18)", () => {
    const ringsOnly = TIRED.map((s) => ({ ...s, decimalTenths: null }))
    expect(seriesCurve(ringsOnly, "decimal")).toEqual([])
    expect(seriesCurve(ringsOnly, "rings").map((s) => s.total)).toEqual([100, 100])
  })

  it("R50 je Serie", () => {
    const spread = seriesSpread(TIRED)
    expect(spread.map((s) => s.series)).toEqual([1, 2])
    expect(spread[0].r50Um).toBe(500)
    expect(spread[1].r50Um).toBe(1500)
  })

  it("Schwerpunkt je Serie und Abstand zum Scheiben-Schwerpunkt", () => {
    const shifted = TIRED.map((s) => (s.series === 2 ? { ...s, xUm: (s.xUm as number) + 2000 } : s))
    const path = mpiPath(shifted)
    expect(path).toHaveLength(2)
    expect(path[0].center.xUm).toBeCloseTo(0, 6)
    expect(path[1].center.xUm).toBeCloseTo(2000, 6)
    expect(path[0].offsetUm).toBeCloseTo(1000, 6)
    expect(path[1].offsetUm).toBeCloseTo(1000, 6)
  })
})

describe("Ermüdung und Trend (I2, I3)", () => {
  it("letzte zehn minus erste zehn, im Wert und im R50", () => {
    const tired = fatigue(TIRED, "decimal")
    expect(tired?.deltaRings).toBeCloseTo(-0.4, 9)
    const firstTen = TIRED.slice(0, 10).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
    const lastTen = TIRED.slice(10).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
    expect(tired?.deltaR50Um).toBeCloseTo((r50(lastTen) as number) - (r50(firstTen) as number), 9)
    expect(fatigue(TIRED.slice(0, 19), "decimal")).toBeNull()
  })

  it("in ganzen Ringen sind 10,5 und 10,1 beide eine 10", () => {
    const tired = fatigue(TIRED, "rings")
    expect(tired?.firstMeanRings).toBe(10)
    expect(tired?.deltaRings).toBe(0)
  })

  it("Trend je zehn Schuss: klar nur, wenn das Intervall die 0 ausschließt", () => {
    const rising = Array.from({ length: 20 }, (_, i) => shot(i, 90 + i))
    const trend = cardTrend(rising, "decimal")
    expect(trend?.perTenShots).toBeCloseTo(1, 9)
    expect(trend?.clear).toBe(true)
    const noisy = [104, 101, 106, 102, 105, 103, 106, 101, 104, 102].map((v, i) => shot(i, v))
    expect(cardTrend(noisy, "decimal")?.clear).toBe(false)
    expect(cardTrend(noisy.slice(0, 9), "decimal")).toBeNull()
  })

  it("in ganzen Ringen wird derselbe Anstieg zur Stufe und ist nicht mehr klar", () => {
    // 9,0 … 10,9: zehnmal Ring 9, dann zehnmal Ring 10. Theil-Sen: 90 Steigungen 0 in den Hälften,
    // 100 positive dazwischen; der Median ist die fünft- und sechstkleinste positive, 1/17 je Schuss.
    const rising = Array.from({ length: 20 }, (_, i) => shot(i, 90 + i))
    const trend = cardTrend(rising, "rings")
    expect(trend?.perTenShots).toBeCloseTo(10 / 17, 9)
    expect(trend?.low).toBe(0)
    expect(trend?.clear).toBe(false)
  })
})

describe("Gleitender Schnitt und längste Folge (I4, I10)", () => {
  it("Ø der letzten bis zu zehn, am Anfang als Teilfenster gekennzeichnet", () => {
    const values = Array.from({ length: 12 }, (_, i) => shot(i, 98 + i))
    const average = movingAverage(values, "decimal", 10)
    expect(average[0]).toEqual({ number: 1, value: 9.8, meanRings: 9.8, partial: true })
    expect(average[9]).toMatchObject({ number: 10, partial: false })
    expect(average[9].meanRings).toBeCloseTo(10.25, 9)
    expect(average[11].meanRings).toBeCloseTo(10.45, 9)
  })

  it("gleitender Schnitt in ganzen Ringen", () => {
    const values = Array.from({ length: 12 }, (_, i) => shot(i, 98 + i))
    const average = movingAverage(values, "rings", 10)
    expect(average[0]).toEqual({ number: 1, value: 9, meanRings: 9, partial: true })
    expect(average[9].meanRings).toBeCloseTo(9.8, 9)
    expect(average[11].meanRings).toBe(10)
  })

  it("längste Folge ab einer Schwelle, mit Start", () => {
    const values = [101, 102, 99, 100, 103, 104, 98].map((v, i) => shot(i, v))
    expect(longestRun(values, "decimal", 100)).toEqual({ length: 3, start: 4 })
    expect(longestRun(values, "decimal", 102)).toEqual({ length: 2, start: 5 })
    expect(longestRun(values, "decimal", 110)).toEqual({ length: 0, start: null })
  })

  it("längste Folge in ganzen Ringen: 10,1 und 10,2 sind beide eine 10", () => {
    const values = [101, 102, 99, 100, 103, 104, 98].map((v, i) => shot(i, v))
    expect(longestRun(values, "rings", 100)).toEqual({ length: 3, start: 4 })
    expect(longestRun(values, "rings", 102)).toEqual({ length: 0, start: null })
    expect(longestRun(values, "rings", 90)).toEqual({ length: 7, start: 1 })
  })
})
