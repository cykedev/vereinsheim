import { randomUUID } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { clearLoginRateLimitBucket, getAdminLoginRateLimitInsights } = await import("./actions")

const key = `email:sperre-${randomUUID().slice(0, 8)}@example.com`

afterAll(async () => {
  await db.loginRateLimitBucket.deleteMany({ where: { key } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: "admin", role: "ADMIN" } }
})

describe("clearLoginRateLimitBucket", () => {
  it("nur ein Admin, der sein Passwort vom Admin schon ersetzt hat", async () => {
    mocks.session = null
    expect(await clearLoginRateLimitBucket(key)).toEqual({ error: "Das darf nur ein Admin." })
    mocks.session = { user: { id: "u", role: "USER" } }
    expect(await clearLoginRateLimitBucket(key)).toEqual({ error: "Das darf nur ein Admin." })
    mocks.session = { user: { id: "admin", role: "ADMIN", mustChangePassword: true } }
    expect(await clearLoginRateLimitBucket(key)).toEqual({
      error: "Bitte zuerst das eigene Passwort ändern.",
    })
    expect(await getAdminLoginRateLimitInsights()).toEqual({
      totalBucketCount: 0,
      activeBlockedCount: 0,
      activeBlockedBuckets: [],
      topNoisyBuckets: [],
    })
  })

  it("prüft den Schlüssel und löscht die Sperre", async () => {
    const now = new Date()
    await db.loginRateLimitBucket.create({
      data: {
        key,
        attempts: 5,
        windowStartedAt: now,
        blockedUntil: new Date(now.getTime() + 60_000),
        lastAttemptAt: now,
      },
    })
    expect(await clearLoginRateLimitBucket("user:x")).toEqual({
      error: "Ungültiger Rate-Limit-Schlüssel.",
    })
    expect(await clearLoginRateLimitBucket(`  ${key}  `)).toEqual({ success: true })
    expect(await db.loginRateLimitBucket.findUnique({ where: { key } })).toBeNull()
  })
})
