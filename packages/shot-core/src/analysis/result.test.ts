import { describe, expect, it } from "vitest"

import { CARD, MATCH } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
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

// Die Wertung des Ausdrucks nur in ganzen Ringen, ohne Zehntel (SF-18)
const RINGS_ONLY: MetricShot[] = CARD.map((shot) => ({ ...shot, decimalTenths: null }))

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
    const extremes = shotExtremes(CARD, "decimal")
    expect(extremes?.best).toEqual({ number: 1, value: 10.5 })
    expect(extremes?.worst).toEqual({ number: 6, value: 6.2 })
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

  it("in ganzen Ringen: gleiche Ringe, der frühere zählt; ohne Zehntel nur in ganzen Ringen", () => {
    // 6,7 und 6,2 sind beide Ring 6: der schwächste ist dann Schuss 5, nicht 6
    const extremes = shotExtremes(CARD, "rings")
    expect(extremes?.best).toEqual({ number: 1, value: 10 })
    expect(extremes?.worst).toEqual({ number: 5, value: 6 })
    expect(shotExtremes(RINGS_ONLY, "rings")?.worst).toEqual({ number: 5, value: 6 })
    expect(shotExtremes(RINGS_ONLY, "decimal")).toBeNull()
  })

  it("ein Platzhalter ist nie bester oder schwächster Schuss, zählt aber für die Nummern", () => {
    const placeholder: MetricShot = {
      ...MATCH[2],
      firedAtMs: 310_000,
      decimalTenths: 109,
      ring: 10,
      flags: [FLAG_SUSPICIOUS],
    }
    const extremes = shotExtremes([...CARD, placeholder], "decimal")
    expect(extremes?.best).toEqual({ number: 1, value: 10.5 })
    // der Platzhalter liegt zeitlich zwischen Schuss 1 und 2: der schwächste ist jetzt Schuss 7
    expect(extremes?.worst).toEqual({ number: 7, value: 6.2 })
  })

  it("gleich weite Teiler: der frühere Schuss zuerst", () => {
    const twin: MetricShot = { ...MATCH[5], firedAtMs: 900_000 }
    const extremes = shotExtremes([...CARD, twin], "decimal")
    expect(extremes?.widestTeiler.map((t) => [t.number, t.teiler])).toEqual([
      [6, 3831],
      [7, 3831],
      [5, 3369],
    ])
  })

  it("Teiler-Schnitt und -Median", () => {
    const stats = teilerStats(CARD)
    expect(stats?.n).toBe(6)
    expect(stats?.mean).toBeCloseTo(11131.6 / 6, 9)
    expect(stats?.median).toBeCloseTo((547.4 + 2656) / 2, 9)
  })

  it("ohne Wertung keine Extreme", () => {
    expect(
      shotExtremes(
        CARD.filter((shot) => shot.kind === "probe"),
        "decimal"
      )
    ).toBeNull()
    expect(teilerStats([])).toBeNull()
  })
})

describe("Ringverlust, Konstanz und Quoten (E9, E10, E4, E11)", () => {
  it("Ringverlust in ganzen Ringen und in Zehnteln", () => {
    expect(ringLoss(CARD, "rings")).toEqual({ n: 6, loss: 11 })
    expect(ringLoss(CARD, "decimal")?.loss).toBeCloseTo(13.6, 9)
  })

  it("Konstanz über Serien gleicher Länge; eine kurze Serie zählt nicht mit", () => {
    const consistency = seriesConsistency(WITH_SHORT_SERIES, "decimal")
    expect(consistency?.series.map((s) => [s.series, s.shots, s.total])).toEqual([
      [1, 10, 100],
      [2, 10, 102],
      [3, 10, 98],
      [4, 10, 101],
      [5, 5, 50],
    ])
    expect(consistency?.compared).toBe(4)
    expect(consistency?.sd).toBeCloseTo(Math.sqrt(8.75 / 3), 9)
    expect(consistency?.range).toBeCloseTo(4, 9)
    expect(consistency?.mad).toBeCloseTo(0.1, 9)
  })

  it("eine Serie mit fehlendem Wert hat keine Summe und zählt nicht für die Konstanz", () => {
    const gap = WITH_SHORT_SERIES.map((shot) =>
      shot.seq === 15 ? { ...shot, decimalTenths: null } : shot
    )
    const consistency = seriesConsistency(gap, "decimal")
    expect(consistency?.series[1]).toEqual({ series: 2, shots: 10, total: null })
    expect(consistency?.compared).toBe(3)
    // Serien 1, 3, 4: 100, 98, 101
    expect(consistency?.sd).toBeCloseTo(Math.sqrt(14 / 6), 9)
    // in ganzen Ringen ist der Ring bekannt, die Serie also vollständig
    expect(seriesConsistency(gap, "rings")?.compared).toBe(4)
  })

  it("Konstanz in ganzen Ringen: 9,8 zählt 9", () => {
    const consistency = seriesConsistency(WITH_SHORT_SERIES, "rings")
    expect(consistency?.series.map((s) => s.total)).toEqual([100, 100, 90, 100, 50])
    expect(consistency?.sd).toBe(5)
    expect(consistency?.range).toBe(10)
    expect(consistency?.mad).toBe(0)
  })

  it("Quote über Schwelle mit Wilson-Intervall", () => {
    const tens = shareAtLeast(CARD, "decimal", 100)
    expect(tens).toMatchObject({ n: 6, count: 3, rate: 0.5 })
    expect(tens?.low).toBeCloseTo(0.1876, 4)
    expect(tens?.high).toBeCloseTo(0.8124, 4)
    expect(shareAtLeast(CARD, "decimal", 105)?.count).toBe(2)
    expect(shareAtLeast([], "decimal", 100)).toBeNull()
  })

  it("Quote in ganzen Ringen: eine Schwelle zwischen zwei Ringen erreicht keiner", () => {
    expect(shareAtLeast(RINGS_ONLY, "rings", 100)).toMatchObject({ n: 6, count: 3 })
    expect(shareAtLeast(CARD, "rings", 105)?.count).toBe(0)
    expect(shareAtLeast(RINGS_ONLY, "decimal", 100)).toBeNull()
  })
})
