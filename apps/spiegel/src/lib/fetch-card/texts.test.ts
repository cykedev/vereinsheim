import { describe, expect, it } from "vitest"

import { forbiddenIn } from "@vereinsheim/lib/wording"

import { OLD_WORDS } from "@/lib/admin/consequences"

import {
  ALL_ERROR_TEXTS,
  fetchErrorText,
  fetchToast,
  newCardIntro,
  SEVERAL_TRANSFERRED,
  type FetchOutcome,
} from "./texts"

const dayText = (day: string) => `Mo ${day.split("-").reverse().join(".")}`

describe("Texte zu „Scheibe holen“", () => {
  it("jeder Grund hat einen Text, gleiche Ursachen sagen dasselbe", () => {
    expect(fetchErrorText("badUrl")).toBe("Das ist kein Link auf einen Ausdruck.")
    expect(fetchErrorText("redirect")).toBe(fetchErrorText("httpStatus"))
    expect(fetchErrorText("unreachable")).toBe(fetchErrorText("httpStatus"))
    expect(fetchErrorText("tooMany")).toBe(
      "Es warten schon zehn oder mehr Scheiben auf die Anlage. Mit dem Ausdruck geht es trotzdem. Ohne Ausdruck geht es erst, wenn die Anlage einige geliefert hat."
    )
    expect(fetchErrorText("nodeVersion")).toBe(
      "Dieser Server kann keine Ausdrucke lesen. Er braucht eine neuere Version von Node."
    )
    for (const text of ALL_ERROR_TEXTS) expect(text).toMatch(/\.$/)
  })

  it("Meldungen nach dem Holen", () => {
    const toast = (outcome: FetchOutcome) => fetchToast(outcome, dayText)
    expect(toast({ kind: "created", cardId: "c", values: false })).toBe(
      "Scheibe angelegt. Spiegel holt die Werte von der Anlage."
    )
    expect(toast({ kind: "created", cardId: "c", values: true })).toBe(
      "Scheibe mit den Werten vom Ausdruck angelegt."
    )
    expect(toast({ kind: "opened", cardId: "c", attached: true })).toBe(
      "Ausdruck an die Scheibe gehängt."
    )
    expect(toast({ kind: "opened", cardId: "c", attached: false })).toBe(
      "Die Scheibe liegt schon in Spiegel."
    )
    expect(toast({ kind: "restored", cardId: "c" })).toBe("Scheibe aus dem Papierkorb geholt.")
    expect(toast({ kind: "pending" })).toBe("Die Scheibe wartet in „Offen“.")
    expect(
      toast({
        kind: "choose",
        hex: "ff914420",
        day: "2026-10-21",
        relifts: false,
        disciplineId: null,
        values: false,
        several: false,
      })
    ).toBeNull()
  })

  it("Meldungen an der Scheibe aus Treffsicher: mit Werten der Tag wie im Blatt, ohne wie jeder Ausdruck", () => {
    expect(
      fetchToast({ kind: "matched", cardId: "c", day: "2026-08-03", values: true }, dayText)
    ).toBe(
      "Ausdruck an die Scheibe aus Treffsicher vom Mo 03.08.2026 gehängt. Seine Werte gelten jetzt."
    )
    expect(
      fetchToast({ kind: "matched", cardId: "c", day: "2026-08-03", values: false }, dayText)
    ).toBe("Ausdruck an die Scheibe gehängt.")
  })

  it("Blatt „Neue Scheibe“: mehrere Scheiben aus Treffsicher passen", () => {
    expect(SEVERAL_TRANSFERRED).toBe(
      "Mehrere Scheiben aus Treffsicher von diesem Abend passen zu diesem Ausdruck. Spiegel legt eine neue Scheibe an. Die übrigen bleiben, wie sie sind."
    )
  })

  it("Blatt „Neue Scheibe“: ohne und mit Werten vom Ausdruck", () => {
    expect(newCardIntro(false)).toBe(
      "Diese Scheibe liegt noch nicht in Spiegel. Spiegel legt sie an und holt die Werte von der Anlage. Wähle Disziplin und Art. Liefert die Anlage die Scheibe, gilt ihre Disziplin."
    )
    expect(newCardIntro(true)).toBe(
      "Diese Scheibe liegt noch nicht in Spiegel. Spiegel legt sie mit den Werten vom Ausdruck an. Liefert die Anlage die Scheibe, kommen ihre Messwerte und die Zeiten der Schüsse dazu, und ihre Disziplin gilt. Wähle Disziplin und Art."
    )
  })

  it("keine Semikolons, keine alten Wörter", () => {
    const toasts = (
      [
        { kind: "created", cardId: "c", values: false },
        { kind: "created", cardId: "c", values: true },
        { kind: "opened", cardId: "c", attached: true },
        { kind: "opened", cardId: "c", attached: false },
        { kind: "restored", cardId: "c" },
        { kind: "pending" },
        { kind: "matched", cardId: "c", day: "2026-08-03", values: true },
        { kind: "matched", cardId: "c", day: "2026-08-03", values: false },
      ] as const
    ).map((outcome) => fetchToast(outcome, dayText)!)
    const texts = [
      ...ALL_ERROR_TEXTS,
      ...toasts,
      newCardIntro(false),
      newCardIntro(true),
      SEVERAL_TRANSFERRED,
    ]
    expect(forbiddenIn(texts)).toEqual([])
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
  })
})
