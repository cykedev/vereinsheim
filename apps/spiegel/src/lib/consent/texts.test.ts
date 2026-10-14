import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { OLD_WORDS } from "@/lib/admin/consequences"

import { CONSENT_TEXTS, CURRENT_CONSENT_VERSION, consentTextOf } from "./texts"

describe("Hinweistexte", () => {
  it("v1 ist festgeschrieben: ein neuer Wortlaut ist eine neue Version, nie eine Änderung an v1", () => {
    const hash = createHash("sha256").update(JSON.stringify(CONSENT_TEXTS.v1)).digest("hex")
    expect(hash).toBe("dff0dde1a4459e9219076268ccf1ece2c7d2b43b96e04164c3300c2445747cd5")
  })

  it("v2 ist festgeschrieben (P2f, Textbuch) und gilt für neue Zustimmungen", () => {
    const hash = createHash("sha256").update(JSON.stringify(CONSENT_TEXTS.v2)).digest("hex")
    expect(hash).toBe("5d3a1cd845351db5e94f3414dc8d5c1823a0525a0d81a46c631d467c47374935")
    expect(CURRENT_CONSENT_VERSION).toBe("v2")
    // was v2 neu sagt: ältere Scheiben, Zahlen für den Admin
    const all = CONSENT_TEXTS.v2!.paragraphs.join(" ")
    expect(all).toContain("Auch ältere Scheiben holt Spiegel")
    expect(all).toContain("wie viele Scheiben dein Konto hat und wann die letzte kam")
    for (const text of [CONSENT_TEXTS.v2!.title, ...CONSENT_TEXTS.v2!.paragraphs])
      expect(text).not.toMatch(OLD_WORDS)
  })

  it("die aktuelle Version gibt es", () => {
    expect(consentTextOf(CURRENT_CONSENT_VERSION)).toBe(CONSENT_TEXTS[CURRENT_CONSENT_VERSION])
  })

  it("eine unbekannte Version ergibt keinen Text", () => {
    expect(consentTextOf("v0")).toBeNull()
  })
})
