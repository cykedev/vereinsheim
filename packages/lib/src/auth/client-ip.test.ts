import { describe, expect, it } from "vitest"

import { extractClientIp } from "./client-ip"

describe("extractClientIp", () => {
  it("ohne Vertrauen in Proxy-Header: null, egal was der Client schickt", () => {
    expect(extractClientIp({ "x-real-ip": "203.0.113.7" }, false)).toBeNull()
  })

  it("x-real-ip vor x-forwarded-for, Groß- und Kleinschreibung egal", () => {
    expect(
      extractClientIp({ "X-Real-IP": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }, true)
    ).toBe("203.0.113.7")
    expect(extractClientIp({ "x-forwarded-for": "198.51.100.1" }, true)).toBe("198.51.100.1")
  })

  it("x-forwarded-for: der erste lesbare Eintrag der Kette", () => {
    expect(extractClientIp({ "x-forwarded-for": "unknown, 198.51.100.2, 10.0.0.1" }, true)).toBe(
      "198.51.100.2"
    )
  })

  it("Ports und IPv6-Klammern", () => {
    expect(extractClientIp({ "x-real-ip": "203.0.113.7:443" }, true)).toBe("203.0.113.7")
    expect(extractClientIp({ "x-real-ip": "[2001:db8::1]:443" }, true)).toBe("2001:db8::1")
    expect(extractClientIp({ "x-real-ip": "2001:db8::1" }, true)).toBe("2001:db8::1")
  })

  it("Listen aus Headern, Unsinn und zu lange Werte", () => {
    expect(extractClientIp({ "x-real-ip": ["198.51.100.3", "x"] }, true)).toBe("198.51.100.3")
    expect(extractClientIp({ "x-real-ip": "kein-ip" }, true)).toBeNull()
    expect(
      extractClientIp({ "x-forwarded-for": `${"1".repeat(600)}, 198.51.100.4` }, true)
    ).toBeNull()
    expect(extractClientIp(undefined, true)).toBeNull()
  })
})
