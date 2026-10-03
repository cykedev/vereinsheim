import { describe, expect, it } from "vitest"
import { hasValidAccessToken } from "./publicAccess"

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
