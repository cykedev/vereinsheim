import { describe, expect, it } from "vitest"

import { forbiddenIn } from "@vereinsheim/lib/wording"

import { OLD_WORDS } from "@/lib/admin/consequences"

import { ALL_ERROR_TEXTS, fetchErrorText, fetchToast, type FetchOutcome } from "./texts"

describe("Texte zu „Scheibe holen“", () => {
  it("jeder Grund hat einen Text, gleiche Ursachen sagen dasselbe", () => {
    expect(fetchErrorText("badUrl")).toBe("Das ist kein Link auf einen Ausdruck.")
    expect(fetchErrorText("redirect")).toBe(fetchErrorText("httpStatus"))
    expect(fetchErrorText("unreachable")).toBe(fetchErrorText("httpStatus"))
    expect(fetchErrorText("tooMany")).toBe(
      "Es warten schon zehn Scheiben auf die Anlage. Warte, bis die Anlage sie geliefert hat."
    )
    for (const text of ALL_ERROR_TEXTS) expect(text).toMatch(/\.$/)
  })

  it("Meldungen nach dem Holen", () => {
    const toast = (outcome: FetchOutcome) => fetchToast(outcome)
    expect(toast({ kind: "created", cardId: "c" })).toBe(
      "Scheibe angelegt. Spiegel holt die Werte von der Anlage."
    )
    expect(toast({ kind: "opened", cardId: "c", attached: true })).toBe(
      "Ausdruck an die Scheibe gehängt."
    )
    expect(toast({ kind: "opened", cardId: "c", attached: false })).toBe(
      "Die Scheibe liegt schon in Spiegel."
    )
    expect(toast({ kind: "restored", cardId: "c" })).toBe("Scheibe aus dem Papierkorb geholt.")
    expect(toast({ kind: "pending" })).toBe("Die Scheibe wartet in „Offen“.")
    expect(toast({ kind: "choose", hex: "ff914420", day: "2026-10-21", relifts: false })).toBeNull()
  })

  it("keine Semikolons, keine alten Wörter", () => {
    const toasts = (
      [
        { kind: "created", cardId: "c" },
        { kind: "opened", cardId: "c", attached: true },
        { kind: "opened", cardId: "c", attached: false },
        { kind: "restored", cardId: "c" },
        { kind: "pending" },
      ] as const
    ).map((outcome) => fetchToast(outcome)!)
    const texts = [...ALL_ERROR_TEXTS, ...toasts]
    expect(forbiddenIn(texts)).toEqual([])
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
  })
})
