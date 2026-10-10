import { describe, expect, it } from "vitest"

import { bucketTable } from "./__fixtures__/table"
import {
  BLOCKED_LIMIT,
  isLoginRateLimitKey,
  loadBlockedLoginBuckets,
  loadLoginRateLimitInsights,
  parseLoginRateLimitKey,
  TOP_NOISY_LIMIT,
  toAdminBucket,
} from "./admin"
import type { LoginRateLimitBucketRow } from "./stores"

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
    const { table } = bucketTable(rows)
    const insights = await loadLoginRateLimitInsights(table, now)
    expect(insights.totalBucketCount).toBe(4)
    expect(insights.activeBlockedCount).toBe(1)
    expect(insights.activeBlockedBuckets.map((b) => b.key)).toEqual(["email:aktiv@example.com"])
    // der 30 Stunden alte und der unlesbare fallen weg
    expect(insights.topNoisyBuckets.map((b) => b.key)).toEqual([
      "email:aktiv@example.com",
      "ip:198.51.100.1",
    ])
  })

  it("die lautesten zuerst, bei Gleichstand der jüngere, dann nach Schlüssel; höchstens zehn", async () => {
    const now = new Date(Date.UTC(2026, 9, 10, 12))
    const at = (minutes: number) => now.getTime() - minutes * 60_000
    const rows = [
      row("email:b@example.com", 3, at(10)),
      row("email:a@example.com", 3, at(10)),
      row("email:jung@example.com", 3, at(5)),
      row("email:viel@example.com", 4, at(50)),
      ...Array.from({ length: 12 }, (_, i) => row(`email:leise-${i}@example.com`, 1, at(i))),
    ]
    const { topNoisyBuckets } = await loadLoginRateLimitInsights(bucketTable(rows).table, now)
    expect(topNoisyBuckets).toHaveLength(TOP_NOISY_LIMIT)
    expect(topNoisyBuckets.slice(0, 5).map((b) => b.identifier)).toEqual([
      "viel@example.com",
      "jung@example.com",
      "a@example.com",
      "b@example.com",
      "leise-0@example.com",
    ])
  })
})

describe("loadBlockedLoginBuckets", () => {
  it("nur aktive Sperren, die bald endende zuerst, höchstens 200", async () => {
    const now = new Date(Date.UTC(2026, 9, 10, 12))
    const t = now.getTime()
    const rows = [
      row("email:spaet@example.com", 5, t - 1000, t + 9000),
      row("email:bald@example.com", 5, t - 2000, t + 1000),
      row("email:vorbei@example.com", 5, t - 3000, t - 1),
      row("email:frei@example.com", 2, t - 500),
    ]
    const blocked = await loadBlockedLoginBuckets(bucketTable(rows).table, now)
    expect(blocked.map((b) => b.identifier)).toEqual(["bald@example.com", "spaet@example.com"])

    const many = Array.from({ length: BLOCKED_LIMIT + 5 }, (_, i) =>
      row(`email:x${i}@example.com`, 5, t - 1000, t + 1000 + i)
    )
    const limited = await loadBlockedLoginBuckets(bucketTable(many).table, now)
    expect(limited).toHaveLength(BLOCKED_LIMIT)
    expect(limited[0].identifier).toBe("x0@example.com")
  })
})
