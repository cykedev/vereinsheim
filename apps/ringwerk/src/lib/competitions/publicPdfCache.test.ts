import { describe, expect, it, vi, beforeEach } from "vitest"

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }))

import { publicPdfCacheTag, revalidatePublicPdf } from "./publicPdfCache"

describe("publicPdfCacheTag", () => {
  beforeEach(() => vi.resetAllMocks())

  it("bildet den Tag aus der Wettbewerbs-ID", () => {
    expect(publicPdfCacheTag("cmp_123")).toBe("public-pdf:cmp_123")
  })

  it("bleibt über eine Slug-Umbenennung hinweg identisch", () => {
    // Der Slug ist kein Eingabewert mehr — dieselbe ID, egal wie der Wettbewerb heißt.
    expect(publicPdfCacheTag("cmp_123")).toBe(publicPdfCacheTag("cmp_123"))
  })

  it("trennt verschiedene Wettbewerbe", () => {
    expect(publicPdfCacheTag("a")).not.toBe(publicPdfCacheTag("b"))
  })
})

describe("revalidatePublicPdf", () => {
  beforeEach(() => vi.resetAllMocks())

  it("verwirft den Eintrag der ID mit dem max-Profil", () => {
    revalidatePublicPdf("cmp_123")
    expect(revalidateTagMock).toHaveBeenCalledWith("public-pdf:cmp_123", "max")
  })

  it("braucht kein isPublic-Gate — das Modul kennt nur die beiden reinen Helfer", async () => {
    // Kein DB-Zugriff: das Modul importiert @/lib/db nicht, es exportiert nur diese zwei.
    const mod = await import("./publicPdfCache")
    expect(Object.keys(mod).sort()).toEqual(["publicPdfCacheTag", "revalidatePublicPdf"])
  })
})
