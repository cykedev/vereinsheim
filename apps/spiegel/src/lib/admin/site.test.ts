import { describe, expect, it } from "vitest"

import { heldBackText } from "./site"

describe("zurückgehaltene Scheiben in Worten (SF-19, SF-20)", () => {
  it("verdeckt und Anzeigeart 0 getrennt, Einzahl und Mehrzahl", () => {
    expect(heldBackText([])).toBeNull()
    expect(heldBackText([{ displayMode: 5, cards: 1 }])).toBe("1 Scheibe verdeckt zurückgehalten")
    expect(
      heldBackText([
        { displayMode: 0, cards: 1 },
        { displayMode: 5, cards: 2 },
        { displayMode: 10, cards: 1 },
      ])
    ).toBe("3 Scheiben verdeckt zurückgehalten · 1 Scheibe mit Anzeigeart 0 zurückgehalten")
  })
})
