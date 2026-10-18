import { describe, expect, it } from "vitest"

import { BASE_FORBIDDEN, forbiddenIn, forbiddenWords } from "./wording"

describe("Schreibregeln", () => {
  it("Semikolon und drei Punkte sind verboten, die Ellipse als Zeichen nicht", () => {
    expect("Erst prüfen; dann löschen.").toMatch(BASE_FORBIDDEN)
    expect("Lädt...").toMatch(BASE_FORBIDDEN)
    expect("Lädt…").not.toMatch(BASE_FORBIDDEN)
    expect("Erst prüfen. Dann löschen.").not.toMatch(BASE_FORBIDDEN)
  })

  it("liefert genau die Texte mit Treffer, in ihrer Reihenfolge", () => {
    const texts = ["Gut.", "Schlecht; sehr.", "Auch gut…", "Warte..."]
    expect(forbiddenIn(texts)).toEqual(["Schlecht; sehr.", "Warte..."])
    expect(forbiddenIn(["Gut."])).toEqual([])
  })

  it("die alten Wörter einer App kommen zur Grundregel dazu", () => {
    const old = /Rangliste|\bMeldung/
    expect(forbiddenIn(["Die Rangliste", "Die Liste", "Eine Meldung", "Semi; kolon"], old)).toEqual(
      ["Die Rangliste", "Eine Meldung", "Semi; kolon"]
    )
    const rule = forbiddenWords(old)
    expect("Rangliste").toMatch(rule)
    expect("Liste").not.toMatch(rule)
    expect(";").toMatch(rule)
  })
})
