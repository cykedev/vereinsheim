import { describe, expect, it } from "vitest"

import { CARD, MATCH, PROBE } from "../__fixtures__/cards"
import { cardShots } from "./card-shots"

describe("cardShots wie am Ausdruck (U4, D1)", () => {
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
