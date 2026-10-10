"use server"

import { revalidatePath } from "next/cache"

import {
  EMPTY_INSIGHTS,
  isLoginRateLimitKey,
  loadLoginRateLimitInsights,
} from "@vereinsheim/lib/auth/rate-limit/admin"

import type { AdminLoginRateLimitInsights } from "@/lib/admin/types"
import { getAuthSession, isAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

// Sperren der Anmeldung für Admins. Die Auswertung liegt in `@vereinsheim/lib/auth/rate-limit/admin`; hier bleiben die
// Server Actions mit der Rollenprüfung (eine geteilte Datei darf keine Server Action re-exportieren).

async function isAdminSession(): Promise<boolean> {
  const session = await getAuthSession()
  return !!session && isAdmin(session.user.role) && !session.user.mustChangePassword
}

export async function getAdminLoginRateLimitInsights(): Promise<AdminLoginRateLimitInsights> {
  if (!(await isAdminSession())) return EMPTY_INSIGHTS
  return loadLoginRateLimitInsights(db.loginRateLimitBucket, new Date())
}

export async function clearLoginRateLimitBucket(bucketKey: string): Promise<ActionResult> {
  if (!(await isAdminSession())) return { error: "Keine Berechtigung." }
  const key = typeof bucketKey === "string" ? bucketKey.trim() : ""
  if (!isLoginRateLimitKey(key)) return { error: "Ungültiger Rate-Limit-Schlüssel." }
  await db.loginRateLimitBucket.deleteMany({ where: { key } })
  revalidatePath("/admin/users", "layout")
  return { success: true }
}
