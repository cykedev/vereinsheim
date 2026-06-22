import { beforeEach, describe, expect, it } from "vitest"
import { slugify, SLUG_REGEX } from "./publicSlug"
import { resolveSlug, findActiveSlugConflict } from "./publicSlugQueries"
import { db } from "@/lib/db"

describe("slugify", () => {
  it("lowercases and dash-joins basic names", () => {
    expect(slugify("Jahrespreisschiessen 2026")).toBe("jahrespreisschiessen-2026")
  })

  it("transliterates German umlauts", () => {
    expect(slugify("Schützenmeister-Pokal")).toBe("schuetzenmeister-pokal")
    expect(slugify("Großer Preis ÄÖÜß")).toBe("grosser-preis-aeoeuess")
  })

  it("strips punctuation and collapses dashes", () => {
    expect(slugify("Kranzl 2026 — Runde #1!!")).toBe("kranzl-2026-runde-1")
  })

  it("trims leading and trailing dashes", () => {
    expect(slugify("---Liga---")).toBe("liga")
  })

  it("returns empty string for input that produces nothing valid", () => {
    expect(slugify("***")).toBe("")
    expect(slugify("")).toBe("")
  })
})

describe("SLUG_REGEX", () => {
  it("accepts valid slugs", () => {
    expect(SLUG_REGEX.test("liga")).toBe(true)
    expect(SLUG_REGEX.test("jahrespreisschiessen-2026")).toBe(true)
    expect(SLUG_REGEX.test("abc")).toBe(true)
  })

  it("rejects too short, dashes at edges, uppercase, non-ascii", () => {
    expect(SLUG_REGEX.test("ab")).toBe(false)
    expect(SLUG_REGEX.test("-liga")).toBe(false)
    expect(SLUG_REGEX.test("liga-")).toBe(false)
    expect(SLUG_REGEX.test("Liga")).toBe(false)
    expect(SLUG_REGEX.test("liga--2026")).toBe(false)
    expect(SLUG_REGEX.test("löwen")).toBe(false)
  })

  it("accepts up to 60 chars and rejects 61+", () => {
    expect(SLUG_REGEX.test("a".repeat(60))).toBe(true)
    expect(SLUG_REGEX.test("a".repeat(61))).toBe(false)
  })
})

// These tests assume a working dev DB. They use db.competition directly.
describe("resolveSlug", () => {
  beforeEach(async () => {
    await db.competition.deleteMany({ where: { publicSlug: "test-slug" } })
  })

  it("returns null when no competition matches", async () => {
    expect(await resolveSlug("test-slug")).toBeNull()
  })

  it("returns ACTIVE+isPublic competition when present", async () => {
    const active = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(active.id)
  })

  it("ignores isPublic=false rows", async () => {
    await createTestCompetition({ status: "ACTIVE", isPublic: false, publicSlug: "test-slug" })
    expect(await resolveSlug("test-slug")).toBeNull()
  })

  it("ignores DRAFT+isPublic rows", async () => {
    await createTestCompetition({ status: "DRAFT", isPublic: true, publicSlug: "test-slug" })
    expect(await resolveSlug("test-slug")).toBeNull()
  })

  it("falls back to most recent COMPLETED/ARCHIVED when no ACTIVE claim exists", async () => {
    const older = await createTestCompetition({
      status: "ARCHIVED",
      isPublic: true,
      publicSlug: "test-slug",
      createdAt: new Date("2024-01-01"),
    })
    const newer = await createTestCompetition({
      status: "COMPLETED",
      isPublic: true,
      publicSlug: "test-slug",
      createdAt: new Date("2025-01-01"),
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(newer.id)
    // suppress unused variable warning
    void older
  })

  it("prefers ACTIVE claim over ARCHIVED predecessors", async () => {
    await createTestCompetition({ status: "ARCHIVED", isPublic: true, publicSlug: "test-slug" })
    const active = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    const result = await resolveSlug("test-slug")
    expect(result?.id).toBe(active.id)
  })
})

describe("findActiveSlugConflict", () => {
  beforeEach(async () => {
    await db.competition.deleteMany({ where: { publicSlug: "test-slug" } })
  })

  it("returns null when no other ACTIVE+isPublic competition holds the slug", async () => {
    expect(await findActiveSlugConflict("no-such-slug", "other-id")).toBeNull()
  })

  it("returns the conflicting competition's name + id", async () => {
    const existing = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
      name: "Test Competition",
    })
    const result = await findActiveSlugConflict("test-slug", "different-id")
    expect(result).toEqual({ id: existing.id, name: "Test Competition" })
  })

  it("does not flag the same competition as its own conflict", async () => {
    const c = await createTestCompetition({
      status: "ACTIVE",
      isPublic: true,
      publicSlug: "test-slug",
    })
    expect(await findActiveSlugConflict("test-slug", c.id)).toBeNull()
  })
})

// Helper — adjust required fields to match your Competition schema (name, type, scoringMode, etc.)
async function createTestCompetition(
  overrides: Partial<{
    status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
    isPublic: boolean
    publicSlug: string | null
    name: string
    createdAt: Date
  }>
) {
  // Find or create a test user to satisfy createdByUserId
  const user =
    (await db.user.findFirst()) ??
    (await db.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: "Test",
        role: "ADMIN",
        // bcrypt hash for "password" — only used in tests, never validated
        passwordHash: "$2b$10$placeholder.hash.for.tests.only",
      },
    }))
  return db.competition.create({
    data: {
      name: overrides.name ?? "Test",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: 10,
      status: overrides.status ?? "ACTIVE",
      isPublic: overrides.isPublic ?? false,
      publicSlug: overrides.publicSlug ?? null,
      createdAt: overrides.createdAt,
      createdByUserId: user.id,
    },
  })
}
