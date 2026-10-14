import { describe, expect, it } from "vitest"

import { inScope, saveChoice } from "./save-choice"

const NOT_SAVED = "Die Wertung ließ sich nicht speichern."

describe("saveChoice", () => {
  it("gespeichert: kein Fehler; die Wahl geht an die Action", async () => {
    const seen: string[] = []
    expect(
      await saveChoice(
        async (scoring) => {
          seen.push(scoring)
          return { success: true }
        },
        "rings",
        NOT_SAVED
      )
    ).toBeNull()
    expect(seen).toEqual(["rings"])
  })

  it("ein Fehler der Action als Text, auch je Feld", async () => {
    expect(
      await saveChoice(
        async () => ({ error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an." }),
        "rings",
        NOT_SAVED
      )
    ).toBe("Du bist nicht mehr angemeldet. Bitte melde dich neu an.")
    expect(
      await saveChoice(
        async () => ({ error: { scoring: ["Unbekannte Wertung."] } }),
        "rings",
        NOT_SAVED
      )
    ).toBe("Unbekannte Wertung.")
  })

  it("ein abgelehnter Aufruf (kein Netz, unbekannte Action) wird zur Meldung der Wahl, statt zu werfen", async () => {
    const offline = async () => {
      throw new TypeError("Failed to fetch")
    }
    expect(await saveChoice(offline, "decimal", NOT_SAVED)).toBe(NOT_SAVED)
    expect(await saveChoice(offline, "competition", "Die Art ließ sich nicht speichern.")).toBe(
      "Die Art ließ sich nicht speichern."
    )
  })
})

describe("inScope", () => {
  it("ein Wert gilt nur für seine Familie: nach dem Wechsel kein alter Fehler, keine alte Wahl", () => {
    const failed = { scope: "lp-freihand", value: "Die Wertung ließ sich nicht speichern." }
    expect(inScope(failed, "lp-freihand", null)).toBe("Die Wertung ließ sich nicht speichern.")
    expect(inScope(failed, "lg-freihand", null)).toBeNull()
    expect(inScope({ scope: "lp-freihand", value: "rings" }, "lg-freihand", "decimal")).toBe(
      "decimal"
    )
    expect(inScope(null, "lp-freihand", "decimal")).toBe("decimal")
  })
})
