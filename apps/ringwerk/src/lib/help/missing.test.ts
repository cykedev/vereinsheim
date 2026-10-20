import { readFileSync } from "node:fs"
import path from "node:path"

import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import { RINGWERK_OLD_WORDS } from "@/lib/consequences"

import { DATA_WORDS } from "../../../tools/pruefen-ringwerk/normalize"
import { MISSING_KINDS, missingReason } from "./missing"

const reasons = MISSING_KINDS.map(missingReason)

/** die Tabelle im Textbuch, Zeilen ohne Zeilenumbruch */
const textbook = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../../../vault/_attachments/textbuch-ringwerk-treffsicher.md"
  ),
  "utf8"
)
  .split("## Ringwerk: „–“ mit Grund (WD3)")[1]
  .split("\n---\n")[0]

describe("„–“ mit Grund", () => {
  it("jede Art hat einen eigenen Grund nach den Schreibregeln", () => {
    expect(reasons.length).toBe(9)
    expect(new Set(reasons).size).toBe(reasons.length)
    expect(reasons.every((reason) => reason.length > 0)).toBe(true)
    expect(forbiddenIn(reasons, RINGWERK_OLD_WORDS)).toEqual([])
  })

  it("kein Grund enthält eine Zahl oder ein Wort, das der Abgleich als Daten liest", () => {
    const dataWords = DATA_WORDS.map((word) => word.toLowerCase())
    for (const reason of reasons) {
      expect(reason).not.toMatch(/\d/)
      const words = reason.toLowerCase().split(" ")
      expect(words.filter((word) => dataWords.includes(word))).toEqual([])
    }
  })

  it("jeder Grund steht so im freigegebenen Textbuch", () => {
    for (const reason of reasons) expect(textbook).toContain(reason)
  })
})
