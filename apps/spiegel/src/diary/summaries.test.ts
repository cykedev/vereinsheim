import { describe, expect, it } from "vitest"

import { cardsText, dayLabel, entryLine, entryMeta, entryTitle, resultText } from "./summaries"

const ZONE = "Europe/Berlin"
const r = (value: number, digits = 1) => ({ value, scoring: "decimal" as const, digits })

describe("Zeilen eines Eintrags", () => {
  it("nennt den Tag wie die Listen", () => {
    expect(dayLabel("2026-03-13", ZONE)).toBe("Fr 13.03.")
  })

  it("nennt Ergebnisse in Ringen in ihrer Wertung", () => {
    expect(resultText(r(374.3))).toBe("374,3 Ringe")
    expect(resultText({ value: 358, scoring: "rings", digits: 0 })).toBe("358 Ringe")
  })

  it("nennt die Scheiben: eine mit Ergebnis, mehrere als Zahl, keine, oder die Art", () => {
    expect(cardsText("shooting", [{ result: r(374.3) }])).toBe("1 Scheibe · 374,3 Ringe")
    expect(cardsText("shooting", [{ result: null }])).toBe("1 Scheibe")
    expect(cardsText("shooting", [{ result: r(1) }, { result: r(2) }])).toBe("2 Scheiben")
    expect(cardsText("shooting", [])).toBe("Noch keine Scheibe")
    expect(cardsText("dry", [])).toBe("Trockentraining")
    expect(cardsText("mental", [])).toBe("Mentaltraining")
  })

  it("nimmt das Vorhaben als Titel, sonst die Disziplin, sonst die Art", () => {
    expect(entryTitle({ intention: "Ruhe im Kopf", family: "Luftpistole", kind: "shooting" })).toBe(
      "Ruhe im Kopf"
    )
    expect(entryTitle({ intention: null, family: "Luftpistole", kind: "shooting" })).toBe(
      "Luftpistole"
    )
    expect(entryTitle({ intention: null, family: null, kind: "mental" })).toBe("Mentaltraining")
  })

  it("schreibt die Disziplin in die Zeile, wenn das Vorhaben Titel ist", () => {
    const base = { day: "2026-03-13", kind: "shooting" as const, cards: [{ result: r(374.3) }] }
    expect(entryLine({ ...base, intention: "Ruhe im Kopf", family: "Luftpistole" }, ZONE)).toBe(
      "Fr 13.03. · Luftpistole · 1 Scheibe · 374,3 Ringe"
    )
    expect(entryLine({ ...base, intention: null, family: "Luftpistole" }, ZONE)).toBe(
      "Fr 13.03. · 1 Scheibe · 374,3 Ringe"
    )
    expect(
      entryLine(
        { day: "2026-10-21", kind: "mental", cards: [], intention: null, family: null },
        ZONE
      )
    ).toBe("Mi 21.10.")
    expect(
      entryLine(
        { day: "2026-10-14", kind: "dry", cards: [], intention: "Halten", family: "Luftpistole" },
        ZONE
      )
    ).toBe("Mi 14.10. · Luftpistole · Trockentraining")
  })

  it("nennt im Kopf Disziplin und Art", () => {
    expect(entryMeta({ family: "Luftpistole", kind: "shooting", competition: false })).toBe(
      "Luftpistole · Training"
    )
    expect(entryMeta({ family: "Luftpistole", kind: "shooting", competition: true })).toBe(
      "Luftpistole · Wettkampf"
    )
    expect(entryMeta({ family: null, kind: "mental", competition: false })).toBe("Mentaltraining")
    expect(entryMeta({ family: "Luftpistole", kind: "dry", competition: false })).toBe(
      "Trockentraining · Luftpistole"
    )
  })
})
