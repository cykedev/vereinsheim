import { describe, expect, it } from "vitest"

import { saveScoring } from "./scoring-save"

describe("saveScoring", () => {
  it("gespeichert: kein Fehler; die Wertung geht an die Action", async () => {
    const seen: string[] = []
    expect(
      await saveScoring(async (scoring) => {
        seen.push(scoring)
        return { success: true }
      }, "rings")
    ).toBeNull()
    expect(seen).toEqual(["rings"])
  })

  it("ein Fehler der Action als Text, auch je Feld", async () => {
    expect(await saveScoring(async () => ({ error: "Nicht angemeldet" }), "rings")).toBe(
      "Nicht angemeldet"
    )
    expect(
      await saveScoring(async () => ({ error: { scoring: ["Unbekannte Wertung."] } }), "rings")
    ).toBe("Unbekannte Wertung.")
  })

  it("ein abgelehnter Aufruf (kein Netz, unbekannte Action) wird zur Meldung, statt zu werfen", async () => {
    expect(
      await saveScoring(async () => {
        throw new TypeError("Failed to fetch")
      }, "decimal")
    ).toBe("Die Wertung ließ sich nicht speichern.")
  })
})
