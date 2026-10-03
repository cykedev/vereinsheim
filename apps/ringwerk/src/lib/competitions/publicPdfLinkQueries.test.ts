import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const { findUniqueMock, resolveSlugMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  resolveSlugMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db: { competition: { findUnique: findUniqueMock } } }))
vi.mock("./publicSlugQueries", () => ({ resolveSlug: resolveSlugMock }))

import { getPublicPdfLink } from "./publicPdfLinkQueries"

const TOKEN = "0b6f0f8e-4d3a-4c5b-9a1e-2f7d8c9b0a12"

function makeRequest(host = "ringwerk.example.org"): NextRequest {
  return {
    headers: new Headers({ host, "x-forwarded-proto": "https" }),
    nextUrl: { protocol: "http:" },
  } as unknown as NextRequest
}

const published = {
  isPublic: true,
  publicSlug: "liga-2026",
  publicPasswordHash: "$2a$12$hash",
  publicAccessToken: TOKEN,
}

beforeEach(() => {
  vi.resetAllMocks()
  findUniqueMock.mockResolvedValue(published)
  resolveSlugMock.mockResolvedValue({ id: "c1" })
})

describe("getPublicPdfLink", () => {
  it("puts the token into the QR code when a password is set", async () => {
    expect(await getPublicPdfLink(makeRequest(), "c1")).toEqual({
      displayUrl: "https://ringwerk.example.org/api/public/c/liga-2026/pdf",
      qrUrl: `https://ringwerk.example.org/api/public/c/liga-2026/pdf?k=${TOKEN}`,
    })
  })

  it("leaves the token out without a password (it would be meaningless)", async () => {
    findUniqueMock.mockResolvedValue({ ...published, publicPasswordHash: null })
    const link = await getPublicPdfLink(makeRequest(), "c1")
    expect(link?.qrUrl).toBe(link?.displayUrl)
  })

  it("returns null for a competition that is not public", async () => {
    findUniqueMock.mockResolvedValue({ ...published, isPublic: false })
    expect(await getPublicPdfLink(makeRequest(), "c1")).toBeNull()
  })

  it("returns null without a slug", async () => {
    findUniqueMock.mockResolvedValue({ ...published, publicSlug: null })
    expect(await getPublicPdfLink(makeRequest(), "c1")).toBeNull()
  })

  it("returns null for an unknown competition", async () => {
    findUniqueMock.mockResolvedValue(null)
    expect(await getPublicPdfLink(makeRequest(), "c1")).toBeNull()
  })

  it("returns null when the slug resolves to another competition", async () => {
    // A completed predecessor whose slug an active successor now holds: its QR code would
    // otherwise point to the successor's PDF.
    resolveSlugMock.mockResolvedValue({ id: "successor" })
    expect(await getPublicPdfLink(makeRequest(), "c1")).toBeNull()
  })

  it("returns null for an implausible host", async () => {
    expect(await getPublicPdfLink(makeRequest("evil.com/x"), "c1")).toBeNull()
  })
})
