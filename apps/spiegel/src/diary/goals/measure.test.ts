import { describe, expect, it } from "vitest"

import type { GoalCard } from "@/lib/results-read"

import { measureGoal, type GoalRule } from "./measure"

let n = 0
/** eine Scheibe an einem Tag im Oktober 2026, 40 Schuss, in ganzen Ringen und Zehnteln */
const card = (day: number, rings: number | null, extra: Partial<GoalCard> = {}): GoalCard => ({
  id: `c${n++}`,
  day: `2026-10-${String(day).padStart(2, "0")}`,
  startedAtMs: Date.UTC(2026, 9, day, 18),
  kind: "training",
  warmup: false,
  shots: 40,
  rings,
  decimal: rings === null ? null : rings + 9.5,
  series: [],
  ...extra,
})

const rule = (extra: Partial<GoalRule> = {}): GoalRule => ({
  measure: "card",
  threshold: 355,
  scoring: "rings",
  shots: 40,
  cards: "all",
  from: "2026-10-01",
  to: "2026-10-31",
  ...extra,
})

describe("measureGoal: Scheibe ab X", () => {
  const cards = [
    card(2, 350),
    card(3, 355),
    card(4, 360),
    card(5, 354),
    card(6, 362, { kind: "competition" }),
    card(7, 370, { warmup: true }),
    card(8, null),
    card(9, 380, { shots: 20 }),
    card(32, 390, { day: "2026-11-01" }),
  ]

  it("zählt Scheiben im Zeitraum mit der Schusszahl, die Schwelle selbst trifft", () => {
    const stand = measureGoal(rule(), cards)
    expect(stand.counted).toBe(5)
    expect(stand.hits).toBe(3)
    expect(stand.points.map((p) => p.value)).toEqual([350, 355, 360, 354, 362])
    expect(stand.best?.value).toBe(362)
    expect(stand.mean).toBeNull()
  })

  it("nennt, was nicht zählt; Einschießen und Scheiben außerhalb des Zeitraums gar nicht", () => {
    const stand = measureGoal(rule(), cards)
    expect(stand.cards).toBe(7)
    expect(stand.left).toEqual({ noValue: 1, otherShots: 1, noSeries: 0 })
  })

  it("nur Training oder nur Wettkampf", () => {
    expect(measureGoal(rule({ cards: "training" }), cards).counted).toBe(4)
    expect(measureGoal(rule({ cards: "competition" }), cards).points.map((p) => p.value)).toEqual([
      362,
    ])
  })

  it("in Zehnteln, auf eine Stelle gerundet, ohne dass ein Rechenrest über die Schwelle kippt", () => {
    const tenths = [card(10, null, { decimal: 364.99999999 }), card(11, null, { decimal: 365.0 })]
    const stand = measureGoal(rule({ scoring: "decimal", threshold: 365 }), tenths)
    expect(stand.points.map((p) => [p.value, p.hit])).toEqual([
      [365, true],
      [365, true],
    ])
    const below = measureGoal(rule({ scoring: "decimal", threshold: 365.1 }), tenths)
    expect(below.hits).toBe(0)
  })

  it("die letzten zehn und bei Gleichstand das frühere Beste", () => {
    const many = Array.from({ length: 14 }, (_, i) => card(i + 1, i < 4 ? 360 : 350))
    const stand = measureGoal(rule(), many)
    expect(stand.recent).toEqual({ counted: 10, hits: 0 })
    expect(stand.hits).toBe(4)
    expect(stand.best?.day).toBe("2026-10-01")
  })
})

describe("measureGoal: Serie ab X", () => {
  const series = (...rings: number[]) =>
    rings.map((r, i) => ({ series: i + 1, shots: 10, rings: r, decimal: r + 2.5 }))

  it("zählt jede Serie mit der Schusszahl, Scheiben ohne Serien unter „ohne Serien“", () => {
    const cards = [
      card(2, 365, { series: series(91, 92, 90, 92) }),
      card(3, 360, { series: [...series(93), { series: 2, shots: 5, rings: 48, decimal: 49 }] }),
      card(4, 360, { series: [] }),
      // die Projektion ist älter als Version 7 und wird nachgerechnet: zählt bis dahin nicht
      card(5, 360, { series: null }),
    ]
    const stand = measureGoal(rule({ measure: "series", threshold: 92, shots: 10 }), cards)
    expect(stand.points.map((p) => [p.series, p.value])).toEqual([
      [1, 91],
      [2, 92],
      [3, 90],
      [4, 92],
      [1, 93],
    ])
    expect(stand.hits).toBe(3)
    expect(stand.left).toEqual({ noValue: 0, otherShots: 0, noSeries: 2 })
  })

  it("eine Scheibe, deren Serien alle nicht passen, steht in der Grundlage", () => {
    const cards = [
      card(2, 365, { series: [{ series: 1, shots: 20, rings: 180, decimal: 185 }] }),
      card(3, 360, { series: [{ series: 1, shots: 10, rings: null, decimal: 95.5 }] }),
    ]
    const stand = measureGoal(rule({ measure: "series", threshold: 92, shots: 10 }), cards)
    expect(stand.counted).toBe(0)
    expect(stand.left).toEqual({ noValue: 1, otherShots: 1, noSeries: 0 })
  })
})

describe("measureGoal: Schnitt ab X", () => {
  it("der Schnitt der gezählten Scheiben", () => {
    const stand = measureGoal(rule({ measure: "average", threshold: 355 }), [
      card(2, 350),
      card(3, 356),
      card(4, 359),
    ])
    expect(stand.mean).not.toBeNull()
    expect(stand.mean).toBeCloseTo(355, 10)
    expect(stand.counted).toBe(3)
  })

  it("ohne gezählte Scheibe kein Schnitt und kein Bestes", () => {
    const stand = measureGoal(rule({ measure: "average" }), [card(2, null)])
    expect(stand.mean).toBeNull()
    expect(stand.best).toBeNull()
    expect(stand.recent).toEqual({ counted: 0, hits: 0 })
  })
})
