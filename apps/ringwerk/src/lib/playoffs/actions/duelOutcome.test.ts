import { describe, expect, it } from "vitest"

import { storedDuelOutcome } from "./duelOutcome"

const result = (rings: number, teiler: number, ringteiler: number) => ({
  totalRings: { toNumber: () => rings },
  teiler: { toNumber: () => teiler },
  ringteiler: { toNumber: () => ringteiler },
})

describe("storedDuelOutcome", () => {
  it("Finale mit Teiler als Stichkriterium: zuerst die Ringe, wie beim Eintragen", () => {
    // A hat mehr Ringe, B den kleineren Ringteiler: im Finale (Ringe, dann Teiler) gewinnt A
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), true, "RINGS", "TEILER", null)
    ).toBe("A")
  })

  it("Finale mit Teiler als Stichkriterium: bei gleichen Ringen entscheidet der Teiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(95, 5, 10), true, "RINGS", "TEILER", null)
    ).toBe("B")
  })

  it("Viertel- und Halbfinale: der kleinere Ringteiler", () => {
    expect(
      storedDuelOutcome(result(95, 30, 35), result(94, 5, 11), false, "RINGS", null, null)
    ).toBe("B")
  })
})
