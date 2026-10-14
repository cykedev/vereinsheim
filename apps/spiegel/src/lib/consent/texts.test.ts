import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { CONSENT_TEXTS, CURRENT_CONSENT_VERSION, consentTextOf } from "./texts"

describe("Hinweistexte", () => {
  it("v1 ist festgeschrieben: ein neuer Wortlaut ist eine neue Version, nie eine Änderung an v1", () => {
    const hash = createHash("sha256").update(JSON.stringify(CONSENT_TEXTS.v1)).digest("hex")
    expect(hash).toBe("dff0dde1a4459e9219076268ccf1ece2c7d2b43b96e04164c3300c2445747cd5")
  })

  it("die aktuelle Version gibt es", () => {
    expect(consentTextOf(CURRENT_CONSENT_VERSION)).toBe(CONSENT_TEXTS[CURRENT_CONSENT_VERSION])
  })

  it("eine unbekannte Version ergibt keinen Text", () => {
    expect(consentTextOf("v0")).toBeNull()
  })
})
