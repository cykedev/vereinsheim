import {
  EMPTY_INSIGHTS,
  isLoginRateLimitKey,
  loadBlockedLoginBuckets,
  loadLoginRateLimitInsights,
} from "@vereinsheim/lib/auth/rate-limit/admin"
import { db } from "@/lib/db"
import { revalidateAdminPaths, requireAdminSession } from "@/lib/admin/actions/shared"
import type {
  ActionResult,
  AdminLoginRateLimitBucket,
  AdminLoginRateLimitInsights,
} from "@/lib/admin/types"

// Login-Rate-Limit für Admins. Die Auswertung liegt in `@vereinsheim/lib/auth/rate-limit/admin` ("noisy" und
// "blocked" getrennt, damit aktive Sperren die Trendanalyse nicht verdrängen); hier bleiben Rollenprüfung und Löschen.

export async function getAdminBlockedLoginRateLimitBucketsAction(): Promise<
  AdminLoginRateLimitBucket[]
> {
  const admin = await requireAdminSession()
  if (!admin) return []
  return loadBlockedLoginBuckets(db.loginRateLimitBucket, new Date())
}

export async function getAdminLoginRateLimitInsightsAction(): Promise<AdminLoginRateLimitInsights> {
  const admin = await requireAdminSession()
  if (!admin) return EMPTY_INSIGHTS
  return loadLoginRateLimitInsights(db.loginRateLimitBucket, new Date())
}

export async function clearLoginRateLimitBucketAction(bucketKey: string): Promise<ActionResult> {
  const admin = await requireAdminSession()
  if (!admin) return { error: "Keine Berechtigung." }

  const key = typeof bucketKey === "string" ? bucketKey.trim() : ""
  if (!isLoginRateLimitKey(key)) return { error: "Ungültiger Rate-Limit-Schlüssel." }

  await db.loginRateLimitBucket.deleteMany({ where: { key } })

  revalidateAdminPaths()
  return { success: true }
}
