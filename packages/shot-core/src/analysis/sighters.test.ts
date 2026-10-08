import { describe, expect, it } from "vitest"

import { MATCH, PROBE } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { c4 } from "../stats"
import { sighterComparison, sighterSummary, sighterZeroed, sightersBeforeMatch } from "./sighters"

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

// Acht Probeschüsse: die ersten drei um (3 | 3) mm, dann fünf um die Mitte; dann zehn Wertungsschüsse auf
// (±0,15 | ±0,15) mm, je fünf oben und unten. Spiegel fragt keine Visierverstellung ab (User, 8. Oktober
// 2026): Die Probe zählt immer ganz (S3) bzw. mit ihren letzten fünf (S1, S4).
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
const CARD_FAR_FIRST = [...SIGHTERS, ...MATCHES]
// nur die fünf Probeschüsse um die Mitte, dann die Wertung
const NEAR_SIGHTERS = SIGHTERS.slice(3).map((s, i) => ({ ...s, seq: i + 1 }))
const CARD_NEAR = [...NEAR_SIGHTERS, ...MATCHES.map((m, i) => ({ ...m, seq: 6 + i }))]

describe("Probe vor der Wertung", () => {
  it("in Abgabefolge, auch bei vertauschter Liste; Probe nach Beginn der Wertung zählt nicht", () => {
    const card = [
      shot("probe", 0, 0, 0),
      shot("probe", 1, 100, 0),
      shot("match", 2, 0, 0),
      shot("probe", 3, 0, 100),
    ]
    expect(sightersBeforeMatch([...card].reverse())).toEqual(card.slice(0, 2))
    expect(sightersBeforeMatch(card.filter((s) => s.kind === "probe"))).toHaveLength(3)
    expect(sightersBeforeMatch(card.filter((s) => s.kind === "match"))).toEqual([])
  })
})

describe("Probe-Umfang (S2)", () => {
  it("Zahl, Blöcke, Dauer und Zeit bis zum ersten Wertungsschuss", () => {
    expect(sighterSummary(CARD_FAR_FIRST)).toEqual({
      count: 8,
      blocks: 1,
      durationMs: 7 * 30_000,
      untilMatchMs: 8 * 30_000,
    })
    expect(sighterSummary(MATCHES)).toBeNull()
  })

  it("ein Platzhalter bringt keine Zeit mit (SF-15)", () => {
    const card = CARD_FAR_FIRST.map((shot, i) =>
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
    const summary = sighterSummary([...CARD_FAR_FIRST, ...late])
    expect(summary?.count).toBe(8)
    expect(summary?.durationMs).toBe(7 * 30_000)
  })

  it("springt die Uhr zurück, gibt es keine Dauer und keinen negativen Abstand", () => {
    const jumped = CARD_FAR_FIRST.map((shot, i) =>
      i >= 2 ? { ...shot, firedAtMs: (shot.firedAtMs as number) - 3_600_000 } : shot
    )
    const summary = sighterSummary(jumped)
    expect(summary?.count).toBe(8)
    expect(summary?.durationMs).toBeNull()
    expect(summary?.untilMatchMs).toBeNull()
  })
})

describe("Probe gegen Wertung (S3)", () => {
  it("die ganze Probe vor der Wertung zählt, auch frühe Schüsse weit daneben", () => {
    const comparison = sighterComparison(CARD_FAR_FIRST, "decimal")
    expect(comparison?.probe.n).toBe(8)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.1, 9)
    expect(comparison?.match.meanRings).toBeCloseTo(10.3, 9)
  })

  it("in ganzen Ringen: 9,6 zählt 9, 10,4 und 10,3 zählen 10", () => {
    const comparison = sighterComparison(CARD_FAR_FIRST, "rings")
    expect(comparison?.probe.meanRings).toBeCloseTo(77 / 8, 9)
    expect(comparison?.match.meanRings).toBe(10)
  })

  it("Maße der Probe: Ø, R50 und σ̂ nach Handwerten", () => {
    const comparison = sighterComparison(CARD_NEAR, "decimal")
    expect(comparison?.probe.n).toBe(5)
    expect(comparison?.probe.meanRings).toBeCloseTo(10.4, 9)
    expect(comparison?.probe.r50Um).toBeCloseTo(100, 9)
    expect(comparison?.match.r50Um).toBeCloseTo(Math.hypot(150, 150), 6)
    // σ̂ hängt kaum von n ab und taugt für Probe (5) gegen Wertung (10): Σr² = 40 000 µm²
    expect(comparison?.probe.sigmaUm).toBeCloseTo(Math.sqrt(40_000 / 8) / c4(9), 6)
    expect(comparison?.match.sigmaUm).toBeCloseTo(Math.sqrt((10 * 2 * 150 ** 2) / 18) / c4(19), 6)
  })

  it("n je Maß: ein Platzhalter zählt mit seinem Wert, nicht mit seiner Lage", () => {
    const placeholder = { ...shot("probe", 5, 0, 0, 109), flags: [FLAG_SUSPICIOUS] }
    const card = [...NEAR_SIGHTERS, placeholder, ...MATCHES.map((m, i) => ({ ...m, seq: 7 + i }))]
    const comparison = sighterComparison(card, "decimal")
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
    const zeroed = sighterZeroed(CARD_FAR_FIRST)
    expect(zeroed?.n).toBe(5)
    expect(zeroed?.real).toBe(false)
  })

  it("erst die Schüsse mit Lage, dann die letzten fünf", () => {
    const placeholder = { ...shot("probe", 8, 0, 0), flags: [FLAG_SUSPICIOUS] }
    const card = [
      ...SIGHTERS,
      placeholder,
      ...MATCHES.map((m) => ({ ...m, seq: (m.seq as number) + 1 })),
    ]
    expect(sighterZeroed(card)?.n).toBe(5)
    expect(sighterZeroed(CARD_FAR_FIRST)?.ellipse.majorUm).toBeGreaterThan(0)
    // unter drei Probeschüssen mit Lage kein Urteil
    expect(sighterZeroed([...SIGHTERS.slice(0, 2), ...MATCHES])).toBeNull()
  })

  it("eine enge Probe neben der Mitte: echt versetzt", () => {
    const offCenter = PROBE.map((p, i) => ({ ...p, seq: i + 1 }))
    const match = MATCHES.map((m, i) => ({ ...m, seq: 10 + i }))
    expect(sighterZeroed([...offCenter, ...match])?.real).toBe(true)
  })
})

describe("Versatz Probe → Wertung (S1, in S4)", () => {
  // P1–P5 um (3 | 0) mm, P6–P8 um die Mitte (nicht auf einer Linie); Wertung um die Mitte. Die letzten fünf
  // mischen beide Lagen: Schwerpunkt (1,2 | −0,02) mm. Eine Verstellung nach P5 kennt Spiegel nicht.
  const BEFORE = [
    [3100, 0],
    [2900, 0],
    [3000, 100],
    [3000, -100],
    [3000, 0],
  ]
  const AFTER = [
    [100, 0],
    [-50, 87],
    [-50, -87],
  ]
  const MIXED = [
    ...BEFORE.map(([x, y], i) => shot("probe", i, x, y)),
    ...AFTER.map(([x, y], i) => shot("probe", 5 + i, x, y)),
    ...MATCHES,
  ]

  it("der Versatz zählt die letzten fünf Probeschüsse, wie der Test", () => {
    const zeroed = sighterZeroed(MIXED)
    expect(zeroed?.n).toBe(5)
    expect(zeroed?.matchOffsetUm).toEqual(expect.any(Number))
    expect(zeroed?.matchOffsetUm).toBeCloseTo(Math.hypot(1200, 20), 6)
  })

  it("die Reihenfolge der Liste zählt nicht, nur die Abgabefolge", () => {
    const shuffled = [...MATCHES, ...MIXED.slice(5, 8), ...MIXED.slice(0, 5)]
    const zeroed = sighterZeroed(shuffled)
    expect(zeroed?.matchOffsetUm).toEqual(expect.any(Number))
    expect(zeroed?.matchOffsetUm).toBeCloseTo(Math.hypot(1200, 20), 6)
  })

  it("der Versatz misst gegen den Schwerpunkt der Wertung, nicht gegen die Mitte", () => {
    // die Probe um die Mitte, die Wertung 2 mm rechts davon
    const shifted = [
      ...NEAR_SIGHTERS,
      ...MATCHES.map((m, i) => ({ ...m, seq: 6 + i, xUm: (m.xUm as number) + 2000 })),
    ]
    const zeroed = sighterZeroed(shifted)
    expect(zeroed?.offsetUm).toEqual(expect.any(Number))
    expect(zeroed?.offsetUm).toBeCloseTo(0, 9)
    expect(zeroed?.matchOffsetUm).toEqual(expect.any(Number))
    expect(zeroed?.matchOffsetUm).toBeCloseTo(2000, 9)
  })

  it("Probe nach Beginn der Wertung zählt nicht zum Versatz", () => {
    const late = [9, 10, 11].map((i) => shot("probe", 10 + i, 9000, 0))
    const zeroed = sighterZeroed([...SIGHTERS, ...MATCHES, ...late])
    expect(zeroed?.matchOffsetUm).toEqual(expect.any(Number))
    expect(zeroed?.matchOffsetUm).toBeCloseTo(0, 9)
  })

  it("unter drei Wertungsschüssen mit Lage kein Versatz, der Test bleibt", () => {
    const zeroed = sighterZeroed([...SIGHTERS, ...MATCHES.slice(0, 2)])
    expect(zeroed?.n).toBe(5)
    expect(zeroed?.matchOffsetUm).toBeNull()
  })
})
