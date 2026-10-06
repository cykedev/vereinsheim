import { describe, expect, it } from "vitest"

import { MATCH, PROBE } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { c4 } from "../stats"
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

  it("ein Platzhalter bringt keine Zeit mit (SF-15)", () => {
    const card = CARD_WITH_ADJUSTMENT.map((shot, i) =>
      i === 0 ? { ...shot, firedAtMs: -600_000, flags: [FLAG_SUSPICIOUS] } : shot
    )
    const summary = sighterSummary(card)
    expect(summary?.count).toBe(8)
    // von Probe 2 (30 s) bis Probe 8 (210 s), bis zur Wertung (240 s)
    expect(summary?.durationMs).toBe(180_000)
    expect(summary?.untilMatchMs).toBe(210_000)
  })

  it("Probe nach Beginn der Wertung zählt nicht", () => {
    const late = [8, 9, 10].map((i) => shot("probe", 20 + i, 0, 0))
    const summary = sighterSummary([...CARD_WITH_ADJUSTMENT, ...late])
    expect(summary?.count).toBe(8)
    expect(summary?.durationMs).toBe(7 * 30_000)
  })

  it("springt die Uhr zurück, gibt es keine Dauer und keinen negativen Abstand", () => {
    const jumped = CARD_WITH_ADJUSTMENT.map((shot, i) =>
      i >= 2 ? { ...shot, firedAtMs: (shot.firedAtMs as number) - 3_600_000 } : shot
    )
    const summary = sighterSummary(jumped)
    expect(summary?.count).toBe(8)
    expect(summary?.durationMs).toBeNull()
    expect(summary?.untilMatchMs).toBeNull()
  })
})

describe("Probe gegen Wertung (S3)", () => {
  it("ohne Verstellung zählt die ganze Probe", () => {
    const comparison = sighterComparison(CARD_WITH_ADJUSTMENT, "decimal")
    expect(comparison?.probe.n).toBe(8)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.1, 9)
    expect(comparison?.match.meanRings).toBeCloseTo(10.3, 9)
  })

  it("in ganzen Ringen: 9,6 zählt 9, 10,4 und 10,3 zählen 10", () => {
    const comparison = sighterComparison(CARD_WITH_ADJUSTMENT, "rings")
    expect(comparison?.probe.meanRings).toBeCloseTo(77 / 8, 9)
    expect(comparison?.match.meanRings).toBe(10)
  })

  it("nach der letzten Verstellung zählt nur die Probe danach", () => {
    const comparison = sighterComparison(CARD_WITH_ADJUSTMENT, "decimal", { adjustAfter: [3] })
    expect(comparison?.probe.n).toBe(5)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.4, 9)
    expect(comparison?.probe.r50Um).toBeCloseTo(100, 9)
    expect(comparison?.match.r50Um).toBeCloseTo(Math.hypot(150, 150), 6)
    // σ̂ hängt kaum von n ab und taugt für Probe (5) gegen Wertung (10): Σr² = 40 000 µm²
    expect(comparison?.probe.sigmaUm).toBeCloseTo(Math.sqrt(40_000 / 8) / c4(9), 6)
    expect(comparison?.match.sigmaUm).toBeCloseTo(Math.sqrt((10 * 2 * 150 ** 2) / 18) / c4(19), 6)
  })

  it("n je Maß: ein Platzhalter zählt mit seinem Wert, nicht mit seiner Lage", () => {
    const placeholder = { ...shot("probe", 8, 0, 0, 109), flags: [FLAG_SUSPICIOUS] }
    const card = [
      ...SIGHTERS,
      placeholder,
      ...MATCHES.map((m) => ({ ...m, seq: (m.seq as number) + 1 })),
    ]
    const comparison = sighterComparison(card, "decimal", { adjustAfter: [3] })
    expect(comparison?.probe.n).toBe(6)
    expect(comparison?.probe.valued).toBe(6)
    expect(comparison?.probe.positioned).toBe(5)
  })

  it("ohne Wertung kein Vergleich", () => {
    expect(sighterComparison(SIGHTERS, "decimal")).toBeNull()
  })
})

describe("Eingeschossen? (S4)", () => {
  it("die letzten fünf Probeschüsse um die Mitte: Lage nicht echt versetzt", () => {
    const zeroed = sighterZeroed(CARD_WITH_ADJUSTMENT)
    expect(zeroed?.n).toBe(5)
    expect(zeroed?.real).toBe(false)
  })

  it("erst die Schüsse mit Lage, dann die letzten fünf nach der letzten Verstellung", () => {
    const placeholder = { ...shot("probe", 8, 0, 0), flags: [FLAG_SUSPICIOUS] }
    const card = [
      ...SIGHTERS,
      placeholder,
      ...MATCHES.map((m) => ({ ...m, seq: (m.seq as number) + 1 })),
    ]
    expect(sighterZeroed(card)?.n).toBe(5)
    expect(sighterZeroed(CARD_WITH_ADJUSTMENT, { adjustAfter: [3] })?.n).toBe(5)
    // nach Probe 6 verstellt: nur noch zwei Schuss, zu wenig für ein Urteil
    expect(sighterZeroed(CARD_WITH_ADJUSTMENT, { adjustAfter: [6] })).toBeNull()
    expect(sighterZeroed(CARD_WITH_ADJUSTMENT)?.ellipse.majorUm).toBeGreaterThan(0)
  })

  it("eine enge Probe neben der Mitte: echt versetzt", () => {
    const offCenter = PROBE.map((p, i) => ({ ...p, seq: i + 1 }))
    const match = MATCHES.map((m, i) => ({ ...m, seq: 10 + i }))
    expect(sighterZeroed([...offCenter, ...match])?.real).toBe(true)
  })
})
