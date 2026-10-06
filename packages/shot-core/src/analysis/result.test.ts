import { describe, expect, it } from "vitest"

import { CARD, MATCH } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
import {
  decimalHistogram,
  ringDistribution,
  ringLoss,
  seriesConsistency,
  shareAtLeast,
  shotExtremes,
  teilerStats,
} from "./result"

// Vier Serien à zehn Schuss mit festen Werten (10,0 · 10,2 · 9,8 · 10,1) und eine kurze fünfte Serie.
const FOUR_SERIES: MetricShot[] = [100, 102, 98, 101].flatMap((tenths, series) =>
  Array.from({ length: 10 }, (_, i) => ({
    ...MATCH[0],
    decimalTenths: tenths,
    ring: Math.floor(tenths / 10),
    innerTen: false,
    seq: series * 10 + i + 1,
    series: series + 1,
  }))
)
const WITH_SHORT_SERIES = [
  ...FOUR_SERIES,
  ...Array.from({ length: 5 }, (_, i) => ({ ...FOUR_SERIES[0], seq: 41 + i, series: 5 })),
]

describe("Ringverteilung und Zehntelverteilung (V1, V2)", () => {
  it("zählt die Wertung des Ausdrucks", () => {
    const distribution = ringDistribution(CARD)
    expect(distribution.n).toBe(6)
    expect(distribution.counts).toEqual([0, 0, 0, 0, 0, 0, 2, 1, 0, 0, 3])
    expect(distribution.innerTens).toBe(2)
    const histogram = decimalHistogram(CARD)
    expect(histogram.n).toBe(6)
    expect(histogram.counts[105]).toBe(2)
    expect(histogram.counts[62]).toBe(1)
    expect(histogram.counts).toHaveLength(110)
  })
})

describe("Extreme und Teiler (E6, E7, E8)", () => {
  it("bester und schwächster Schuss mit Nummer, die drei besten und weitesten Teiler", () => {
    const extremes = shotExtremes(CARD)
    expect(extremes?.best).toEqual({ number: 1, decimalTenths: 105 })
    expect(extremes?.worst).toEqual({ number: 6, decimalTenths: 62 })
    expect(extremes?.bestTeiler.map((t) => [t.number, t.teiler])).toEqual([
      [1, 331.8],
      [2, 396.4],
      [3, 547.4],
    ])
    expect(extremes?.widestTeiler.map((t) => [t.number, t.teiler])).toEqual([
      [6, 3831],
      [5, 3369],
      [4, 2656],
    ])
  })

  it("Teiler-Schnitt und -Median", () => {
    const stats = teilerStats(CARD)
    expect(stats?.n).toBe(6)
    expect(stats?.mean).toBeCloseTo(11131.6 / 6, 9)
    expect(stats?.median).toBeCloseTo((547.4 + 2656) / 2, 9)
  })

  it("ohne Wertung keine Extreme", () => {
    expect(shotExtremes(CARD.filter((shot) => shot.kind === "probe"))).toBeNull()
    expect(teilerStats([])).toBeNull()
  })
})

describe("Ringverlust, Konstanz und Quoten (E9, E10, E4, E11)", () => {
  it("Ringverlust in ganzen Ringen und in Zehnteln", () => {
    expect(ringLoss(CARD, "rings")).toEqual({ n: 6, loss: 11 })
    expect(ringLoss(CARD, "decimal")?.loss).toBeCloseTo(13.6, 9)
  })

  it("Konstanz über Serien gleicher Länge; eine kurze Serie zählt nicht mit", () => {
    const consistency = seriesConsistency(WITH_SHORT_SERIES)
    expect(consistency?.series.map((s) => [s.series, s.shots, s.tenths])).toEqual([
      [1, 10, 1000],
      [2, 10, 1020],
      [3, 10, 980],
      [4, 10, 1010],
      [5, 5, 500],
    ])
    expect(consistency?.compared).toBe(4)
    expect(consistency?.sd).toBeCloseTo(Math.sqrt(8.75 / 3), 9)
    expect(consistency?.range).toBeCloseTo(4, 9)
    expect(consistency?.mad).toBeCloseTo(0.1, 9)
  })

  it("Quote über Schwelle mit Wilson-Intervall", () => {
    const tens = shareAtLeast(CARD, 100)
    expect(tens).toMatchObject({ n: 6, count: 3, rate: 0.5 })
    expect(tens?.low).toBeCloseTo(0.1876, 4)
    expect(tens?.high).toBeCloseTo(0.8124, 4)
    expect(shareAtLeast([], 100)).toBeNull()
  })
})
