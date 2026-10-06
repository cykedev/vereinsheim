import { describe, expect, it } from "vitest"

import { MATCH, PROBE } from "../__fixtures__/cards"
import type { MetricShot } from "../metrics"
import { sighterComparison, sighterSummary, sighterZeroed } from "./sighters"

const shot = (
  kind: MetricShot["kind"],
  i: number,
  xUm: number,
  yUm: number,
  tenths = 104
): MetricShot => ({
  ...MATCH[0],
  kind,
  seq: i + 1,
  firedAtMs: i * 30_000,
  xUm,
  yUm,
  decimalTenths: tenths,
  ring: Math.floor(tenths / 10),
  series: kind === "match" ? 1 : null,
})

// Acht Probeschüsse: drei um (3 | 3) mm, nach Schuss 3 Visier verstellt, fünf um die Mitte;
// dann zehn Wertungsschüsse auf (±0,15 | ±0,15) mm, je fünf oben und unten.
const FAR = [
  [100, 0],
  [-100, 0],
  [0, 100],
]
const NEAR = [
  [100, 0],
  [-100, 0],
  [0, 100],
  [0, -100],
  [0, 0],
]
const SIGHTERS = [
  ...FAR.map(([dx, dy], i) => shot("probe", i, 3000 + dx, 3000 + dy, 96)),
  ...NEAR.map(([dx, dy], i) => shot("probe", 3 + i, dx, dy, 104)),
]
const MATCHES = Array.from({ length: 10 }, (_, i) =>
  shot("match", 8 + i, i % 2 === 0 ? 150 : -150, i < 5 ? 150 : -150, 103)
)
const CARD_WITH_ADJUSTMENT = [...SIGHTERS, ...MATCHES]

describe("Probe-Umfang (S2)", () => {
  it("Zahl, Blöcke, Dauer und Zeit bis zum ersten Wertungsschuss", () => {
    expect(sighterSummary(CARD_WITH_ADJUSTMENT)).toEqual({
      count: 8,
      blocks: 1,
      durationMs: 7 * 30_000,
      untilMatchMs: 8 * 30_000,
    })
    expect(sighterSummary(MATCHES)).toBeNull()
  })
})

describe("Probe gegen Wertung (S3)", () => {
  it("ohne Verstellung zählt die ganze Probe", () => {
    const comparison = sighterComparison(CARD_WITH_ADJUSTMENT)
    expect(comparison?.probe.n).toBe(8)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.1, 9)
    expect(comparison?.match.meanRings).toBeCloseTo(10.3, 9)
  })

  it("nach der letzten Verstellung zählt nur die Probe danach", () => {
    const comparison = sighterComparison(CARD_WITH_ADJUSTMENT, { adjustAfter: [3] })
    expect(comparison?.probe.n).toBe(5)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.4, 9)
    expect(comparison?.probe.r50Um).toBeCloseTo(100, 9)
    expect(comparison?.match.r50Um).toBeCloseTo(Math.hypot(150, 150), 6)
  })

  it("ohne Wertung kein Vergleich", () => {
    expect(sighterComparison(SIGHTERS)).toBeNull()
  })
})

describe("Eingeschossen? (S4)", () => {
  it("die letzten fünf Probeschüsse um die Mitte: Lage nicht echt versetzt", () => {
    const zeroed = sighterZeroed(CARD_WITH_ADJUSTMENT)
    expect(zeroed?.n).toBe(5)
    expect(zeroed?.real).toBe(false)
  })

  it("eine enge Probe neben der Mitte: echt versetzt", () => {
    const offCenter = PROBE.map((p, i) => ({ ...p, seq: i + 1 }))
    const match = MATCHES.map((m, i) => ({ ...m, seq: 10 + i }))
    expect(sighterZeroed([...offCenter, ...match])?.real).toBe(true)
  })
})
