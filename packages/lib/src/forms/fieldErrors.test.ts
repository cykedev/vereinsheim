import { describe, expect, it } from "vitest"

import { getErrorMessage, getFieldError, getGeneralError } from "./fieldErrors"

describe("getGeneralError", () => {
  it("liefert einen String-Fehler", () => {
    expect(getGeneralError({ error: "Nicht angemeldet." })).toBe("Nicht angemeldet.")
  })

  it("liefert nichts fuer Feldfehler, null oder Erfolg", () => {
    expect(getGeneralError({ error: { name: ["Pflichtfeld"] } })).toBeUndefined()
    expect(getGeneralError(null)).toBeUndefined()
    expect(getGeneralError({ success: true })).toBeUndefined()
  })
})

describe("getFieldError", () => {
  it("liefert den ersten Fehler des Feldes", () => {
    expect(getFieldError({ error: { name: ["Zu kurz", "Zweiter"] } }, "name")).toBe("Zu kurz")
  })

  it("liefert nichts fuer ein anderes Feld, String-Fehler oder Erfolg", () => {
    expect(getFieldError({ error: { name: ["Zu kurz"] } }, "email")).toBeUndefined()
    expect(getFieldError({ error: "Allgemein" }, "name")).toBeUndefined()
    expect(getFieldError({ success: true }, "name")).toBeUndefined()
    expect(getFieldError(null, "name")).toBeUndefined()
  })
})

describe("getErrorMessage", () => {
  it("gibt einen String-Fehler unveraendert zurueck", () => {
    expect(getErrorMessage({ error: "Nicht angemeldet." })).toBe("Nicht angemeldet.")
  })

  it("reduziert ein Feldfehler-Objekt auf den ersten nicht-leeren Eintrag", () => {
    expect(getErrorMessage({ error: { name: ["Pflichtfeld"] } })).toBe("Pflichtfeld")
    // Leere und undefined-Eintraege werden uebersprungen.
    expect(
      getErrorMessage({ error: { name: [], email: undefined, dateFrom: ["Ungueltig"] } })
    ).toBe("Ungueltig")
  })

  it("nimmt den Fallback, wenn das Fehlerobjekt keine Meldung enthaelt", () => {
    expect(getErrorMessage({ error: { name: [] } })).toBe("Aktion fehlgeschlagen.")
    expect(getErrorMessage({ error: { name: [] } }, "Eigener Text")).toBe("Eigener Text")
  })

  it("liefert undefined, wenn kein Fehler vorliegt", () => {
    expect(getErrorMessage({ success: true })).toBeUndefined()
    expect(getErrorMessage(null)).toBeUndefined()
    expect(getErrorMessage(undefined)).toBeUndefined()
    // Ein leerer String ist kein Fehler.
    expect(getErrorMessage({ error: "" })).toBeUndefined()
  })
})
