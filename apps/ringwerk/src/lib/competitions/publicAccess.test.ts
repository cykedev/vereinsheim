import { describe, expect, it } from "vitest"
import { hasValidAccessToken, resolveAccessTokenUpdate } from "./publicAccess"

const TOKEN = "0b6f0f8e-4d3a-4c5b-9a1e-2f7d8c9b0a12"

describe("hasValidAccessToken", () => {
  it("rejects a missing or empty token", () => {
    expect(hasValidAccessToken(null, TOKEN)).toBe(false)
    expect(hasValidAccessToken("", TOKEN)).toBe(false)
  })

  it("rejects any token when none is stored (bypass off)", () => {
    expect(hasValidAccessToken(TOKEN, null)).toBe(false)
  })

  it("accepts the stored token", () => {
    expect(hasValidAccessToken(TOKEN, TOKEN)).toBe(true)
  })

  it("rejects a different token of the same length", () => {
    expect(hasValidAccessToken(TOKEN.replace(/.$/, "3"), TOKEN)).toBe(false)
  })

  it("rejects a token of a different length without throwing", () => {
    expect(hasValidAccessToken(`${TOKEN}x`, TOKEN)).toBe(false)
  })
})

describe("resolveAccessTokenUpdate", () => {
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it("leaves the column alone when the publish block was not rendered", () => {
    expect(
      resolveAccessTokenUpdate({
        fieldsPresent: false,
        bypass: false,
        rotate: false,
        existing: TOKEN,
      })
    ).toBeUndefined()
  })

  it("clears the token when the bypass is switched off", () => {
    expect(
      resolveAccessTokenUpdate({
        fieldsPresent: true,
        bypass: false,
        rotate: false,
        existing: TOKEN,
      })
    ).toBeNull()
  })

  it("keeps an existing token while the bypass stays on", () => {
    expect(
      resolveAccessTokenUpdate({
        fieldsPresent: true,
        bypass: true,
        rotate: false,
        existing: TOKEN,
      })
    ).toBeUndefined()
  })

  it("creates a fresh UUID when the bypass is switched on", () => {
    const next = resolveAccessTokenUpdate({
      fieldsPresent: true,
      bypass: true,
      rotate: false,
      existing: null,
    })
    expect(next).toMatch(UUID_V4)
  })

  it("replaces the token on rotation", () => {
    const next = resolveAccessTokenUpdate({
      fieldsPresent: true,
      bypass: true,
      rotate: true,
      existing: TOKEN,
    })
    expect(next).toMatch(UUID_V4)
    expect(next).not.toBe(TOKEN)
  })
})
