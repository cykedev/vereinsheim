import { describe, it, expect } from "vitest"
import { assignSharedRanks } from "./sharedRanks"

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
