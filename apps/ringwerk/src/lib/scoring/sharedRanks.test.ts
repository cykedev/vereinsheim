import { describe, it, expect } from "vitest"
import { assignSharedRanks, sameScore } from "./sharedRanks"

const sameValue = (a: number, b: number) => a === b

describe("assignSharedRanks", () => {
  it("leere Liste ergibt keine Plätze", () => {
    expect(assignSharedRanks([], sameValue)).toEqual([])
  })

  it("ohne Gleichstand wird fortlaufend gezählt", () => {
    expect(assignSharedRanks([10, 8, 5], sameValue)).toEqual([1, 2, 3])
  })

  it("Gleichstand teilt den Platz, der nächste zählt die geteilten mit", () => {
    expect(assignSharedRanks([10, 8, 8, 5], sameValue)).toEqual([1, 2, 2, 4])
  })

  it("alle gleich stehen alle auf Platz 1", () => {
    expect(assignSharedRanks([0, 0, 0], sameValue)).toEqual([1, 1, 1])
  })
})

describe("sameScore", () => {
  it("wertet Fließkomma-Rauschen als gleich", () => {
    expect(sameScore(8.2 * 1.5, 12.3)).toBe(true)
    expect(sameScore(0.1 + 0.2, 0.3)).toBe(true)
  })

  it("trennt echte Unterschiede und fehlende Werte", () => {
    expect(sameScore(12.3, 12.4)).toBe(false)
    expect(sameScore(12.3, null)).toBe(false)
    expect(sameScore(null, null)).toBe(true)
  })
})
