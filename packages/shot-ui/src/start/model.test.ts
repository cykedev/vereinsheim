import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { describe, expect, it } from "vitest"

import type { ListInputCard } from "../list/evenings"
import { urlFromRoute } from "../nav/routes"
import { NOW, periodCard, TZ } from "../period/testSeason"
import { startModel } from "./model"

const DAY = 86_400_000
/** Ortszeit MESZ (UTC+2) am Tag `day` im September 2026 */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 8, day, hour - 2, minute)
const lg = (card: PeriodCard): ListInputCard => ({ card, family: "lg-freihand" })
const lp = (card: PeriodCard): ListInputCard => ({ card, family: "lp-freihand" })
const context = { timeZone: TZ, nowMs: NOW, named: [], scoring: "decimal" as const }
const model = (cards: ListInputCard[], family: string | null = "lg-freihand") =>
  startModel({ ...context, cards, family })
/** `count` Scheiben vor dem 20. September, je ein Schuss, abwechselnd 10,0 und 10,2 */
const before = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    lg(
      periodCard(`b${i}`, 0, [i % 2 === 0 ? 100 : 102], {
        startedAtMs: at(20, 18) - (count - i) * DAY,
      })
    )
  )

describe("Start: der letzte Abend (Plan N5, D1–D6)", () => {
  it("der Abend der neuesten Scheibe, je Familie ein Block in der Folge ihrer ersten Scheibe", () => {
    const m = model([
      lg(periodCard("old", 0, [100], { startedAtMs: at(27, 18) })),
      lp(periodCard("p1", 0, [95], { startedAtMs: at(29, 19) })),
      lg(periodCard("g1", 0, [101], { startedAtMs: at(29, 18) })),
    ])
    expect(m.day).toBe("2026-09-29")
    expect(m.blocks.map((b) => [b.family, b.rows.map((r) => r.id)])).toEqual([
      ["lg-freihand", ["g1"]],
      ["lp-freihand", ["p1"]],
    ])
  })

  it("eine Scheibe vor 4 Uhr gehört zum Abend davor", () => {
    const m = model([
      lg(periodCard("e", 0, [100], { startedAtMs: at(29, 21) })),
      lg(periodCard("late", 0, [100], { startedAtMs: at(30, 1, 30) })),
    ])
    expect(m.day).toBe("2026-09-29")
    expect(m.blocks[0].rows.map((r) => r.id)).toEqual(["e", "late"])
  })

  it("Ø je Schuss über alle Schüsse des Abends, nicht Mittel der Mittel", () => {
    // 4 × 10,0 und 2 × 9,0: (40 + 18) / 6 = 9,667; das Mittel der Mittel wäre 9,5
    const m = model([
      lg(periodCard("x", 0, [100, 100, 100, 100], { startedAtMs: at(29, 18) })),
      lg(periodCard("y", 0, [90, 90], { startedAtMs: at(29, 19) })),
    ])
    expect(m.blocks[0].mean).not.toBeNull()
    expect(m.blocks[0].mean).toBeCloseTo(58 / 6, 9)
    expect(m.blocks[0].shots).toBe(6)
  })

  it("Schnitt der fünf Scheiben vor dem Abend; eine sechste ältere zählt nicht", () => {
    const cards = [
      lg(periodCard("o", 0, [50], { startedAtMs: at(20, 18) })),
      ...[100, 102, 98, 101, 99].map((t, i) =>
        lg(periodCard(`f${i}`, 0, [t], { startedAtMs: at(21 + i, 18) }))
      ),
      lg(periodCard("e", 0, [100], { startedAtMs: at(29, 18) })),
    ]
    expect(model(cards).blocks[0].average).toEqual({ value: 10, n: 5 })
    // unter zehn Scheiben kein Band und kein Urteil
    expect(model(cards).blocks[0].band).toBeNull()
    expect(model(cards).blocks[0].verdict).toBeNull()
    expect(
      model([lg(periodCard("e", 0, [100], { startedAtMs: at(29, 18) }))]).blocks[0].average
    ).toBeNull()
  })

  it("Formband wie im Verlauf des Fortschritts: an der Scheibe des Abends, mit ihr gerechnet", () => {
    // abwechselnd 10,0 und 10,2, dann der Abend: Abweichungen vom Fünferschnitt ± 0,08 und die des Abends; der MAD
    // bleibt 0,08 (Schwankung 1,4826 · 0,08), die Mitte ist der Schnitt der letzten fünf mit dem Abend
    const spread = 1.4826 * 0.08
    const evening = (t: number) =>
      model([...before(12), lg(periodCard("e", 0, [t], { startedAtMs: at(29, 18) }))]).blocks[0]
    const within = evening(101)
    // der Schnitt im Satz bleibt der der fünf Scheiben davor (Entscheidung 13)
    expect(within.average?.value).toBeCloseTo(10.12, 9)
    expect(within.band?.low).toBeCloseTo(10.1 - spread, 9)
    expect(within.band?.high).toBeCloseTo(10.1 + spread, 9)
    expect(within.verdict).toBe("within")
    const above = evening(103)
    expect(above.band?.low).toBeCloseTo(10.14 - spread, 9)
    expect(above.verdict).toBe("above")
    const below = evening(99)
    expect(below.band?.high).toBeCloseTo(10.06 + spread, 9)
    expect(below.verdict).toBe("below")
  })

  it("in ganzen Ringen: Zahl und Streifen in Ringen", () => {
    // 9,9 und 10,1: in Zehnteln 10,0 je Schuss, in ganzen Ringen (9 + 10) / 2 = 9,5
    const cards = [lg(periodCard("r", 0, [99, 101], { startedAtMs: at(29, 18) }))]
    const rings = startModel({ ...context, scoring: "rings", cards, family: null }).blocks[0]
    expect(rings.mean).not.toBeNull()
    expect(rings.mean).toBeCloseTo(9.5, 9)
    expect(rings.strip[0].value).toBeCloseTo(9.5, 9)
    expect(model(cards).blocks[0].mean).toBeCloseTo(10, 9)
  })

  it("ein Training nur aus Probe zählt wie Wertung, in der Zahl und im Streifen", () => {
    const m = model([lg(periodCard("p", 0, [100, 102], { startedAtMs: at(29, 18), probe: true }))])
    expect(m.blocks[0].mean).not.toBeNull()
    expect(m.blocks[0].mean).toBeCloseTo(10.1, 9)
    expect(m.blocks[0].shots).toBe(2)
    expect(m.blocks[0].strip.map((x) => x.id)).toEqual(["p"])
  })

  it("Scheiben davor ohne Wert: kein Schnitt, aber auch kein erster Abend", () => {
    const m = model([
      lg(periodCard("x", 0, [], { startedAtMs: at(20, 18) })),
      lg(periodCard("e", 0, [100], { startedAtMs: at(29, 18) })),
    ])
    expect(m.blocks[0].average).toBeNull()
    expect(m.blocks[0].cardsBefore).toBe(1)
  })

  it("Streifen: höchstens 20 Scheiben bis zum Abend, die des Abends markiert", () => {
    const m = model([
      ...before(25),
      lg(periodCard("e1", 0, [100], { startedAtMs: at(29, 18) })),
      lg(periodCard("e2", 0, [101], { startedAtMs: at(29, 19) })),
    ])
    const strip = m.blocks[0].strip
    expect(strip).toHaveLength(20)
    expect(strip.filter((s) => s.tonight).map((s) => s.id)).toEqual(["e1", "e2"])
    expect(strip.at(-1)?.id).toBe("e2")
  })

  it("neue Rekorde: nur die, deren Scheibe am Abend liegt", () => {
    const m = model([
      lg(periodCard("old2", 0, [104, 104], { startedAtMs: at(20, 18) })),
      lg(periodCard("old1", 0, [100], { startedAtMs: at(21, 18) })),
      lg(periodCard("e", 0, [106], { startedAtMs: at(29, 18) })),
    ])
    const records = m.blocks[0].records
    expect(records.length).toBeGreaterThan(0)
    expect(records.every((r) => r.record.cardId === "e")).toBe(true)
    expect(records.some((r) => r.label === "Bestes Ergebnis (1 Schuss)")).toBe(true)
  })

  it("Form der letzten 90 Tage für die zuletzt gewählte Familie, mit Vergleich; ohne Wahl die des ersten Blocks", () => {
    const cards = [
      lp(periodCard("p", 0, [95], { startedAtMs: at(28, 18) })),
      lg(periodCard("g", 0, [100], { startedAtMs: at(29, 18) })),
    ]
    const form = model(cards, "lp-freihand").form
    expect(form?.family).toBe("lp-freihand")
    expect(form?.mean).toBeCloseTo(9.5, 9)
    expect(urlFromRoute(form!.route)).toBe("/progress?compare=previous&family=lp-freihand")
    expect(model(cards, null).form?.family).toBe("lg-freihand")
  })

  it("ohne Scheiben kein Abend und keine Form", () => {
    expect(model([])).toEqual({ day: null, blocks: [], form: null })
  })
})
