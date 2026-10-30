import { describe, expect, it } from "vitest"

import {
  cardsText,
  dayLabel,
  entryLine,
  entryMeta,
  entryTitle,
  resultText,
  shotResult,
} from "./summaries"

const ZONE = "Europe/Berlin"
const r = (value: number, digits = 1) => ({ value, scoring: "decimal" as const, digits })
/** eine Scheibe mit Wertung bzw. nur aus Probe */
const scored = (value: number | null) => ({
  result: value === null ? null : r(value),
  probeOnly: false,
})
const probe = (value: number | null) => ({
  result: value === null ? null : r(value),
  probeOnly: true,
})

describe("Zeilen eines Eintrags", () => {
  it("nennt den Tag wie die Listen", () => {
    expect(dayLabel("2026-03-13", ZONE)).toBe("Fr 13.03.")
  })

  it("nennt Ergebnisse in Ringen in ihrer Wertung", () => {
    expect(resultText(r(374.3))).toBe("374,3 Ringe")
    expect(resultText({ value: 358, scoring: "rings", digits: 0 })).toBe("358 Ringe")
  })

  it("nimmt als geschossen nur das Ergebnis genau einer Scheibe mit Wertung", () => {
    expect(shotResult([scored(374.3)])).toEqual(r(374.3))
    expect(shotResult([scored(null)])).toBeNull()
    expect(shotResult([])).toBeNull()
    expect(shotResult([scored(374.3), scored(370)])).toBeNull()
  })

  it("zählt neben einer Wertung nur die Wertung, in jeder Reihenfolge", () => {
    expect(shotResult([probe(92.4), scored(374.3)])).toEqual(r(374.3))
    expect(shotResult([scored(374.3), probe(92.4)])).toEqual(r(374.3))
    expect(shotResult([probe(92.4), scored(374.3), probe(95.1)])).toEqual(r(374.3))
    expect(shotResult([probe(92.4), scored(null)])).toBeNull()
  })

  it("zwei Wertungen geben auch mit Probe kein Ergebnis", () => {
    expect(shotResult([probe(92.4), scored(374.3), scored(370)])).toBeNull()
  })

  it("nimmt ohne Wertung genau eine Probe-Scheibe", () => {
    expect(shotResult([probe(92.4)])).toEqual(r(92.4))
    expect(shotResult([probe(92.4), probe(95.1)])).toBeNull()
  })

  it("nennt die Scheiben: alle als Zahl mit dem Ergebnis des Eintrags, keine, oder die Art", () => {
    expect(cardsText("shooting", [scored(374.3)])).toBe("1 Scheibe · 374,3 Ringe")
    expect(cardsText("shooting", [scored(null)])).toBe("1 Scheibe")
    expect(cardsText("shooting", [scored(1), scored(2)])).toBe("2 Scheiben")
    expect(cardsText("shooting", [probe(92.4), scored(374.3)])).toBe("2 Scheiben · 374,3 Ringe")
    expect(cardsText("shooting", [probe(92.4), probe(95.1)])).toBe("2 Scheiben")
    expect(cardsText("shooting", [probe(92.4)])).toBe("1 Scheibe · 92,4 Ringe")
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
    const base = { day: "2026-03-13", kind: "shooting" as const, cards: [scored(374.3)] }
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
        { ...base, intention: null, family: "Luftpistole", cards: [probe(92.4), scored(374.3)] },
        ZONE
      )
    ).toBe("Fr 13.03. · 2 Scheiben · 374,3 Ringe")
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
