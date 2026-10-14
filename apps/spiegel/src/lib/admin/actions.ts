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

/**
 * null für einen Admin, der loslegen darf; sonst der Fehler. Wie die Kontoverwaltung (`users/actions.ts`): Ein Admin mit
 * Passwort vom Admin ändert erst das eigene (die Seiten leiten ihn über `requireAdmin` ohnehin dorthin).
 */
async function adminRefusal(): Promise<ActionResult | null> {
  const session = await getAuthSession()
  if (!session || !isAdmin(session.user.role)) return { error: "Das darf nur ein Admin." }
  if (session.user.mustChangePassword) return { error: "Bitte zuerst das eigene Passwort ändern." }
  return null
}

export async function getAdminLoginRateLimitInsights(): Promise<AdminLoginRateLimitInsights> {
  if (await adminRefusal()) return EMPTY_INSIGHTS
  return loadLoginRateLimitInsights(db.loginRateLimitBucket, new Date())
}

export async function clearLoginRateLimitBucket(bucketKey: string): Promise<ActionResult> {
  const refusal = await adminRefusal()
  if (refusal) return refusal
  const key = typeof bucketKey === "string" ? bucketKey.trim() : ""
  if (!isLoginRateLimitKey(key)) return { error: "Ungültiger Rate-Limit-Schlüssel." }
  await db.loginRateLimitBucket.deleteMany({ where: { key } })
  revalidatePath("/admin/users", "layout")
  return { success: true }
}
