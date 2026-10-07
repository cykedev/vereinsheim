import { describe, expect, it } from "vitest"

import { CARD, MATCH } from "../__fixtures__/cards"
import { computeMetric, FLAG_SUSPICIOUS, metricByKey, type MetricShot } from "../metrics"
import {
  decimalHistogram,
  ringDistribution,
  seriesConsistency,
  shareAtLeast,
  shotExtremes,
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

describe("Beste und weiteste Teiler (E8)", () => {
  it("die drei besten und weitesten Teiler mit Nummer, ohne eigene Angabe über den Wert", () => {
    const extremes = shotExtremes(CARD)
    expect(Object.keys(extremes ?? {}).sort()).toEqual(["bestTeiler", "widestTeiler"])
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

  it("ein Platzhalter zählt nicht bei den Teilern, aber für die Nummern", () => {
    const placeholder: MetricShot = {
      ...MATCH[2],
      firedAtMs: 310_000,
      decimalTenths: 109,
      ring: 10,
      flags: [FLAG_SUSPICIOUS],
    }
    const extremes = shotExtremes([...CARD, placeholder])
    // der Platzhalter liegt zeitlich zwischen Schuss 1 und 2: die späteren rücken um eins
    expect(extremes?.bestTeiler.map((t) => t.number)).toEqual([1, 3, 4])
    expect(extremes?.widestTeiler.map((t) => t.number)).toEqual([7, 6, 5])
  })

  it("gleich weite Teiler: der frühere Schuss zuerst", () => {
    const twin: MetricShot = { ...MATCH[5], firedAtMs: 900_000 }
    const extremes = shotExtremes([...CARD, twin])
    expect(extremes?.widestTeiler.map((t) => [t.number, t.teiler])).toEqual([
      [6, 3831],
      [7, 3831],
      [5, 3369],
    ])
  })

  it("ohne Wertung keine Extreme", () => {
    expect(shotExtremes(CARD.filter((shot) => shot.kind === "probe"))).toBeNull()
  })
})

describe("Konstanz und Quoten (E10, E4, E11)", () => {
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

  it("ein Platzhalter zählt mit seinem amtlichen Wert, wie in der Registry (SF-15)", () => {
    const placeholder: MetricShot = {
      ...MATCH[2],
      firedAtMs: 900_000,
      decimalTenths: 109,
      ring: 10,
      flags: [FLAG_SUSPICIOUS],
    }
    const card = [...CARD, placeholder]
    const share = shareAtLeast(card, "decimal", 100)
    expect(share).toMatchObject({ n: 7, count: 4 })
    const tensRate = metricByKey("result.tensRate")
    if (!tensRate) throw new Error("result.tensRate fehlt")
    const rate = computeMetric(tensRate, card)
    expect(rate).not.toBeNull()
    expect(rate).toBeCloseTo(((share?.count as number) / 7) * 100, 9)
  })

  it("Quote in ganzen Ringen: eine Schwelle über 10,0 erreicht keiner, 9,5 erreicht jede 10", () => {
    expect(shareAtLeast(RINGS_ONLY, "rings", 100)).toMatchObject({ n: 6, count: 3 })
    expect(shareAtLeast(CARD, "rings", 105)?.count).toBe(0)
    expect(shareAtLeast(CARD, "rings", 95)?.count).toBe(3)
    expect(shareAtLeast(RINGS_ONLY, "decimal", 100)).toBeNull()
  })
})
