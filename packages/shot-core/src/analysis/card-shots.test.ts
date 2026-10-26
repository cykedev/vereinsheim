import { describe, expect, it } from "vitest"

import { CARD, MATCH, PROBE } from "../__fixtures__/cards"
import { EMPTY, TOTAL_RINGS } from "../__fixtures__/sums"
import { cardShots, shotCountOf } from "./card-shots"

describe("cardShots wie am Ausdruck", () => {
  it("eine Karte mit Probe und Wertung zählt nur die Wertung; die ganze Karte bleibt Kontext (SF-04)", () => {
    const shots = cardShots(CARD)!
    expect(shots.match).toEqual(MATCH)
    expect(shots.whole).toBe(CARD)
  })

  it("nur Probe zählt nur mit dem Schalter, dann als Wertung", () => {
    expect(cardShots(PROBE)).toBeNull()
    const training = cardShots(PROBE, true)!
    expect(training.whole.every((s) => s.kind === "match")).toBe(true)
    expect(training.match).toHaveLength(PROBE.length)
  })
})

describe("shotCountOf", () => {
  it("Schüsse wie am Ausdruck, ohne sie die Schusszahl der Summen, sonst 0", () => {
    expect(shotCountOf({ shots: CARD })).toBe(MATCH.length)
    expect(shotCountOf(TOTAL_RINGS)).toBe(40)
    expect(shotCountOf(EMPTY)).toBe(0)
  })
})
