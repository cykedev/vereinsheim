import { describe, expect, it } from "vitest"
import { buildPublicPdfLink, requestOrigin } from "./publicPdfLink"

function headers(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe("requestOrigin", () => {
  it("prefers x-forwarded-host over host", () => {
    const h = headers({ host: "app-ringwerk:3000", "x-forwarded-host": "ringwerk.example.org" })
    expect(requestOrigin(h, "http:")).toBe("http://ringwerk.example.org")
  })

  it("takes the first entry of a comma-separated forwarded host", () => {
    const h = headers({ "x-forwarded-host": "ringwerk.example.org, proxy.internal" })
    expect(requestOrigin(h, "http:")).toBe("http://ringwerk.example.org")
  })

  it("prefers x-forwarded-proto over the fallback protocol", () => {
    const h = headers({ host: "ringwerk.example.org", "x-forwarded-proto": "https" })
    expect(requestOrigin(h, "http:")).toBe("https://ringwerk.example.org")
  })

  it("normalizes a fallback protocol with a trailing colon", () => {
    expect(requestOrigin(headers({ host: "localhost:3000" }), "http:")).toBe(
      "http://localhost:3000"
    )
  })

  it("rejects a host with a path", () => {
    expect(requestOrigin(headers({ host: "evil.com/x" }), "https:")).toBeNull()
  })

  it("rejects a non-http protocol", () => {
    const h = headers({ host: "ringwerk.example.org", "x-forwarded-proto": "javascript" })
    expect(requestOrigin(h, "https:")).toBeNull()
  })

  it("returns null without any host header", () => {
    expect(requestOrigin(headers({}), "https:")).toBeNull()
  })
})

describe("buildPublicPdfLink", () => {
  const origin = "https://ringwerk.example.org"

  it("uses the same URL for text and QR code without a token", () => {
    const link = buildPublicPdfLink({ origin, slug: "liga-2026", accessToken: null })
    expect(link.displayUrl).toBe("https://ringwerk.example.org/api/public/c/liga-2026/pdf")
    expect(link.qrUrl).toBe(link.displayUrl)
  })

  it("puts the token into the QR code only", () => {
    const token = "0b6f0f8e-4d3a-4c5b-9a1e-2f7d8c9b0a12"
    const link = buildPublicPdfLink({ origin, slug: "liga-2026", accessToken: token })
    expect(link.qrUrl).toBe(`${link.displayUrl}?k=${token}`)
    expect(link.displayUrl).not.toContain(token)
  })
})
