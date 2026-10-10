"use server"

import { revalidatePath } from "next/cache"

import {
  EMPTY_INSIGHTS,
  isLoginRateLimitKey,
  loadLoginRateLimitInsights,
} from "@vereinsheim/lib/auth/rate-limit/admin"

import type { AdminLoginRateLimitInsights } from "@/lib/admin/types"
import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

// Login-Rate-Limit für Admins. Die Auswertung liegt in `@vereinsheim/lib/auth/rate-limit/admin`; hier bleiben die
// Server Actions mit der Rollenprüfung (geteilte Dateien dürfen keine Server-Action-Re-Exports sein).

async function requireAdminSession(): Promise<{ id: string } | null> {
  const session = await getAuthSession()
  if (!session || session.user.role !== "ADMIN") return null
  return { id: session.user.id }
}

export async function getAdminLoginRateLimitInsights(): Promise<AdminLoginRateLimitInsights> {
  if (!(await requireAdminSession())) return EMPTY_INSIGHTS
  return loadLoginRateLimitInsights(db.loginRateLimitBucket, new Date())
}

export async function clearLoginRateLimitBucket(bucketKey: string): Promise<ActionResult> {
  if (!(await requireAdminSession())) return { error: "Keine Berechtigung." }
  const key = typeof bucketKey === "string" ? bucketKey.trim() : ""
  if (!isLoginRateLimitKey(key)) return { error: "Ungültiger Rate-Limit-Schlüssel." }
  await db.loginRateLimitBucket.deleteMany({ where: { key } })
  // Layout-Revalidation deckt /admin/users und alle Unterseiten ab.
  revalidatePath("/admin/users", "layout")
  return { success: true }
}
