"use server"

import { isIP } from "node:net"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import { MAX_USER_EMAIL_LENGTH } from "@/lib/authValidation"
import type { ActionResult } from "@/lib/types"
import type { AdminLoginRateLimitBucket, AdminLoginRateLimitInsights } from "@/lib/admin/types"

const TOP_NOISY_WINDOW_HOURS = 24
const TOP_NOISY_LIMIT = 10

const LOGIN_BUCKET_SELECT = {
  key: true,
  attempts: true,
  windowStartedAt: true,
  blockedUntil: true,
  lastAttemptAt: true,
} as const

type LoginRateLimitBucketRow = {
  key: string
  attempts: number
  windowStartedAt: Date
  blockedUntil: Date | null
  lastAttemptAt: Date
}

const EMPTY_INSIGHTS: AdminLoginRateLimitInsights = {
  totalBucketCount: 0,
  activeBlockedCount: 0,
  activeBlockedBuckets: [],
  topNoisyBuckets: [],
}

const LoginRateLimitBucketKeySchema = z
  .string()
  .trim()
  .min(1, "Ungültiger Rate-Limit-Schlüssel.")
  .max(400, "Ungültiger Rate-Limit-Schlüssel.")
  .refine((value) => parseLoginRateLimitKey(value) !== null, "Ungültiger Rate-Limit-Schlüssel.")

function parseLoginRateLimitKey(
  key: string
): { type: AdminLoginRateLimitBucket["type"]; identifier: string } | null {
  if (key.startsWith("email:")) {
    const identifier = key.slice("email:".length)
    if (!identifier || identifier.length > MAX_USER_EMAIL_LENGTH) {
      return null
    }
    return { type: "EMAIL", identifier }
  }

  if (key.startsWith("ip:")) {
    const identifier = key.slice("ip:".length)
    if (!identifier || isIP(identifier) === 0) {
      return null
    }
    return { type: "IP", identifier }
  }

  return null
}

function mapLoginRateLimitRowToAdminBucket(
  row: LoginRateLimitBucketRow
): AdminLoginRateLimitBucket | null {
  const parsedKey = parseLoginRateLimitKey(row.key)
  if (!parsedKey) return null

  return {
    key: row.key,
    type: parsedKey.type,
    identifier: parsedKey.identifier,
    attempts: row.attempts,
    windowStartedAt: row.windowStartedAt,
    blockedUntil: row.blockedUntil,
    lastAttemptAt: row.lastAttemptAt,
  }
}

async function requireAdminSession(): Promise<{ id: string } | null> {
  const session = await getAuthSession()
  if (!session || session.user.role !== "ADMIN") {
    return null
  }
  return { id: session.user.id }
}

function revalidateAdminPaths(): void {
  // Layout-Revalidation deckt /admin/users und alle Unterseiten ab.
  revalidatePath("/admin/users", "layout")
}

export async function getAdminLoginRateLimitInsights(): Promise<AdminLoginRateLimitInsights> {
  const admin = await requireAdminSession()
  if (!admin) return EMPTY_INSIGHTS

  const now = new Date()
  const noisyWindowStart = new Date(now.getTime() - TOP_NOISY_WINDOW_HOURS * 60 * 60 * 1000)

  const [totalBucketCount, activeBlockedCount, activeRows, noisyRows] = await Promise.all([
    db.loginRateLimitBucket.count(),
    db.loginRateLimitBucket.count({
      where: { blockedUntil: { gt: now } },
    }),
    db.loginRateLimitBucket.findMany({
      where: { blockedUntil: { gt: now } },
      select: LOGIN_BUCKET_SELECT,
      orderBy: [{ blockedUntil: "asc" }, { lastAttemptAt: "desc" }],
      take: 200,
    }),
    db.loginRateLimitBucket.findMany({
      where: { lastAttemptAt: { gte: noisyWindowStart } },
      select: LOGIN_BUCKET_SELECT,
      orderBy: [{ attempts: "desc" }, { lastAttemptAt: "desc" }, { key: "asc" }],
      take: TOP_NOISY_LIMIT,
    }),
  ])

  const activeBlockedBuckets = activeRows.flatMap((row) => {
    const mapped = mapLoginRateLimitRowToAdminBucket(row)
    return mapped ? [mapped] : []
  })

  const topNoisyBuckets = noisyRows.flatMap((row) => {
    const mapped = mapLoginRateLimitRowToAdminBucket(row)
    return mapped ? [mapped] : []
  })

  return {
    totalBucketCount,
    activeBlockedCount,
    activeBlockedBuckets,
    topNoisyBuckets,
  }
}

export async function clearLoginRateLimitBucket(bucketKey: string): Promise<ActionResult> {
  const admin = await requireAdminSession()
  if (!admin) return { error: "Keine Berechtigung." }

  const parsed = LoginRateLimitBucketKeySchema.safeParse(bucketKey)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültiger Rate-Limit-Schlüssel." }
  }

  await db.loginRateLimitBucket.deleteMany({
    where: { key: parsed.data },
  })

  revalidateAdminPaths()
  return { success: true }
}
