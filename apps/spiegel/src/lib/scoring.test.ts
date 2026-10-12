import { describe, expect, it } from "vitest"

import { cardScoring, familyScoringOf, standScoringOf } from "./scoring"

const shot = (seq: number, displayMode: number | null, stellung = 1) => ({
  seq,
  stellung,
  displayMode,
})

describe("standScoringOf: wie am Stand", () => {
  it("1 und 7 Zehntel, 2 und 8 ganze Ringe; andere Codes zählen nicht", () => {
    expect(standScoringOf([shot(1, 1), shot(2, 7)])).toBe("decimal")
    expect(standScoringOf([shot(1, 2), shot(2, 8)])).toBe("rings")
    expect(standScoringOf([shot(1, 3), shot(2, 5), shot(3, 10)])).toBeNull()
    expect(standScoringOf([shot(1, null)])).toBeNull()
    expect(standScoringOf([])).toBeNull()
  })

  it("gemischt die häufigste; bei Gleichstand die des letzten Schusses (nach Abgabefolge)", () => {
    expect(standScoringOf([shot(1, 2), shot(2, 1), shot(3, 2)])).toBe("rings")
    expect(standScoringOf([shot(2, 1), shot(1, 2)])).toBe("decimal")
    expect(standScoringOf([shot(1, 1), shot(2, 2), shot(3, 9)])).toBe("rings")
  })

  it("wie am Ausdruck: mit Wertung nur die Wertung, sonst die Probe", () => {
    expect(standScoringOf([shot(1, 1, 0), shot(2, 1, 0), shot(3, 2)])).toBe("rings")
    expect(standScoringOf([shot(1, 1, 0), shot(2, 7, 0)])).toBe("decimal")
  })
})

describe("cardScoring: die Wertung einer Scheibe", () => {
  it("gewählt vor der Vorgabe", () => {
    expect(
      cardScoring({ kind: "competition", official: "rings", stand: "rings", choice: "decimal" })
    ).toBe("decimal")
  })

  it("Wettkampf: amtlich, sonst wie am Stand; Training: wie am Stand, sonst amtlich; ohne beides Zehntel", () => {
    expect(
      cardScoring({ kind: "competition", official: "rings", stand: "decimal", choice: null })
    ).toBe("rings")
    expect(cardScoring({ kind: "competition", official: null, stand: "rings", choice: null })).toBe(
      "rings"
    )
    expect(
      cardScoring({ kind: "training", official: "rings", stand: "decimal", choice: null })
    ).toBe("decimal")
    expect(cardScoring({ kind: "training", official: "rings", stand: null, choice: null })).toBe(
      "rings"
    )
    expect(cardScoring({ kind: "training", official: null, stand: null, choice: null })).toBe(
      "decimal"
    )
  })
})

describe("familyScoringOf: die Wertung einer Familie", () => {
  it("gespeichert, sonst die häufigste ihrer Scheiben; bei Gleichstand und ohne Scheiben Zehntel", () => {
    expect(familyScoringOf(["rings", "rings"], "decimal")).toBe("decimal")
    expect(familyScoringOf(["rings", "decimal", "rings"], null)).toBe("rings")
    expect(familyScoringOf(["rings", "decimal"], null)).toBe("decimal")
    expect(familyScoringOf([], null)).toBe("decimal")
  })
})
