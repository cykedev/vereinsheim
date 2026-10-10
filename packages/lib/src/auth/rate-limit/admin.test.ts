import { describe, expect, it } from "vitest"

import {
  isLoginRateLimitKey,
  loadLoginRateLimitInsights,
  parseLoginRateLimitKey,
  toAdminBucket,
} from "./admin"
import type { LoginRateLimitBucketDelegate, LoginRateLimitBucketRow } from "./stores"

const row = (key: string, attempts: number, lastMs: number, blockedMs: number | null = null) => ({
  key,
  attempts,
  windowStartedAt: new Date(lastMs),
  blockedUntil: blockedMs === null ? null : new Date(blockedMs),
  lastAttemptAt: new Date(lastMs),
})

describe("Schlüssel", () => {
  it("E-Mail und IP; anderes, leeres und Unsinn nicht", () => {
    expect(parseLoginRateLimitKey("email:a@example.com")).toEqual({
      type: "EMAIL",
      identifier: "a@example.com",
    })
    expect(parseLoginRateLimitKey("ip:2001:db8::1")).toEqual({
      type: "IP",
      identifier: "2001:db8::1",
    })
    expect(parseLoginRateLimitKey("ip:kein-ip")).toBeNull()
    expect(parseLoginRateLimitKey("email:")).toBeNull()
    expect(parseLoginRateLimitKey("user:x")).toBeNull()
    expect(isLoginRateLimitKey("email:a@example.com")).toBe(true)
    expect(isLoginRateLimitKey(`email:${"a".repeat(400)}`)).toBe(false)
    expect(isLoginRateLimitKey("")).toBe(false)
  })

  it("eine Zeile mit unlesbarem Schlüssel fällt weg", () => {
    expect(toAdminBucket(row("ip:x", 1, 0))).toBeNull()
    expect(toAdminBucket(row("ip:198.51.100.1", 3, 5))).toMatchObject({
      type: "IP",
      identifier: "198.51.100.1",
      attempts: 3,
    })
  })
})

describe("loadLoginRateLimitInsights", () => {
  it("zählt, zeigt aktive Sperren und die lautesten der letzten 24 Stunden", async () => {
    const now = new Date(Date.UTC(2026, 9, 10, 12))
    const hour = 3_600_000
    const rows: LoginRateLimitBucketRow[] = [
      row("email:aktiv@example.com", 5, now.getTime() - hour, now.getTime() + hour),
      row("email:alt@example.com", 9, now.getTime() - 30 * hour),
      row("ip:198.51.100.1", 2, now.getTime() - 2 * hour),
      row("unlesbar", 7, now.getTime() - hour),
    ]
    const calls: unknown[] = []
    const table = {
      async count(args?: { where?: { blockedUntil: { gt: Date } } }) {
        return args?.where
          ? rows.filter((r) => r.blockedUntil && r.blockedUntil > args.where!.blockedUntil.gt)
              .length
          : rows.length
      },
      async findMany(args: Parameters<LoginRateLimitBucketDelegate["findMany"]>[0]) {
        calls.push(args.where)
        const where = args.where
        let found = rows
        if (where && "blockedUntil" in where)
          found = found.filter((r) => r.blockedUntil && r.blockedUntil > where.blockedUntil.gt)
        if (where && "lastAttemptAt" in where)
          found = found.filter((r) => r.lastAttemptAt >= where.lastAttemptAt.gte)
        return [...found].sort((a, b) => b.attempts - a.attempts)
      },
    } as unknown as LoginRateLimitBucketDelegate
    const insights = await loadLoginRateLimitInsights(table, now)
    expect(insights.totalBucketCount).toBe(4)
    expect(insights.activeBlockedCount).toBe(1)
    expect(insights.activeBlockedBuckets.map((b) => b.key)).toEqual(["email:aktiv@example.com"])
    // der 30 Stunden alte und der unlesbare fallen weg
    expect(insights.topNoisyBuckets.map((b) => b.key)).toEqual([
      "email:aktiv@example.com",
      "ip:198.51.100.1",
    ])
    expect(calls).toContainEqual({ lastAttemptAt: { gte: new Date(now.getTime() - 24 * hour) } })
  })
})
