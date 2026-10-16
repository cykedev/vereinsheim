import { describe, expect, it } from "vitest"

import { BRIDGE_STATUS_TEXT } from "./bridge-status"
import { OLD_WORDS } from "./consequences"
import { heldBackText } from "./site"

describe("zurückgehaltene Scheiben in Worten (SF-19, SF-20)", () => {
  it("verdeckt und Anzeigeart 0 getrennt, Einzahl und Mehrzahl", () => {
    expect(heldBackText([])).toBeNull()
    expect(heldBackText([{ displayMode: 5, cards: 1 }])).toBe(
      "1 Scheibe mit verdeckter Wertung nicht geschickt"
    )
    expect(
      heldBackText([
        { displayMode: 0, cards: 1 },
        { displayMode: 5, cards: 2 },
        { displayMode: 10, cards: 1 },
      ])
    ).toBe(
      "3 Scheiben mit verdeckter Wertung nicht geschickt · 1 Scheibe mit unbekannter Wertungsart nicht geschickt"
    )
  })
})

describe("Texte der Brücke ohne alte Wörter", () => {
  it("jeder Zustand und die zurückgehaltenen Scheiben", () => {
    const texts = [
      ...Object.values(BRIDGE_STATUS_TEXT),
      heldBackText([
        { displayMode: 0, cards: 2 },
        { displayMode: 5, cards: 1 },
      ]),
    ]
    expect(Object.keys(BRIDGE_STATUS_TEXT)).toHaveLength(6)
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
  })
})
