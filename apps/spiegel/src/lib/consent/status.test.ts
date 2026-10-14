import { describe, expect, it } from "vitest"

import { OLD_WORDS } from "@/lib/admin/consequences"

import {
  consentStatus,
  consentStatusText,
  isOpenConsent,
  ownerActionOf,
  sportpassSummary,
} from "./status"

const at = new Date("2026-10-14T18:00:00Z")
const row = (fields: Partial<Record<"confirmedAt" | "rejectedAt" | "returnedAt", Date>>) => ({
  confirmedAt: null,
  rejectedAt: null,
  returnedAt: null,
  ...fields,
})

describe("consentStatus", () => {
  it("ohne Entscheidung wartet die Zustimmung auf den Admin", () => {
    expect(consentStatus(row({}))).toBe("requested")
  })

  it("bestätigt ist aktiv, abgelehnt ist abgelehnt, zurückgegeben ist zurück beim Admin", () => {
    expect(consentStatus(row({ confirmedAt: at }))).toBe("active")
    expect(consentStatus(row({ rejectedAt: at }))).toBe("rejected")
    expect(consentStatus(row({ returnedAt: at }))).toBe("returned")
  })

  it("Vorrang: abgelehnt vor bestätigt vor zurückgegeben", () => {
    expect(consentStatus(row({ rejectedAt: at, confirmedAt: at }))).toBe("rejected")
    expect(consentStatus(row({ rejectedAt: at, returnedAt: at }))).toBe("rejected")
    expect(consentStatus(row({ confirmedAt: at, returnedAt: at }))).toBe("active")
  })
})

describe("in Worten und Aktionen", () => {
  it("Status in Worten, aktiv mit Datum", () => {
    expect(consentStatusText("requested", null)).toBe("wartet auf Prüfung durch einen Admin")
    expect(consentStatusText("active", "14.10.2026")).toBe("aktiv seit 14.10.2026")
    expect(consentStatusText("rejected", null)).toBe("von einem Admin abgelehnt")
    expect(consentStatusText("returned", null)).toBe("wird nach „nicht meine“ wieder geprüft")
    // Schreibregeln (P2f)
    for (const status of ["requested", "active", "rejected", "returned"] as const)
      expect(consentStatusText(status, "14.10.2026")).not.toMatch(OLD_WORDS)
  })

  it("der Schütze widerruft, was zählt oder zählen kann; eine Ablehnung entfernt er", () => {
    expect(ownerActionOf("requested")).toBe("revoke")
    expect(ownerActionOf("active")).toBe("revoke")
    expect(ownerActionOf("returned")).toBe("revoke")
    expect(ownerActionOf("rejected")).toBe("remove")
  })

  it("offen für den Admin sind wartende und zurückgegebene", () => {
    expect(isOpenConsent("requested")).toBe(true)
    expect(isOpenConsent("returned")).toBe(true)
    expect(isOpenConsent("active")).toBe(false)
    expect(isOpenConsent("rejected")).toBe(false)
  })
})

describe("Stand des Sportpasses je Konto", () => {
  it("was wartet, geht vor; dann aktiv, abgelehnt, keiner", () => {
    expect(sportpassSummary(["active", "requested"])).toBe("Sportpass: Nummer prüfen")
    expect(sportpassSummary(["active", "returned"])).toBe("Sportpass: wieder prüfen")
    expect(sportpassSummary(["rejected", "active"])).toBe("Sportpass aktiv")
    expect(sportpassSummary(["rejected"])).toBe("Sportpass abgelehnt")
    expect(sportpassSummary([])).toBe("kein Sportpass")
  })
})
