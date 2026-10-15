import bcrypt from "bcryptjs"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"

import type { Db } from "@/lib/db"

export const BCRYPT_COST = 12

export type SeedAdminResult = "created" | "restored" | "exists" | "missing-env"

/**
 * Das erste Admin-Konto aus `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD`, nur wenn es keinen aktiven Admin gibt (wie
 * Ringwerk). Gibt es das Konto mit dieser E-Mail schon (herabgestuft oder deaktiviert), wird es wieder aktiver Admin,
 * mit seinem Passwort: der Weg zurück, wenn kein Admin mehr übrig ist. Die E-Mail wird normalisiert wie bei der
 * Anmeldung. Das Passwort aus der Umgebung ist das eigene des Admins, kein Wechsel nötig.
 */
export async function ensureSeedAdmin(
  db: Pick<Db, "user">,
  env: { email?: string; password?: string }
): Promise<SeedAdminResult> {
  const email = env.email ? normalizeLoginEmail(env.email) : null
  if (!email || !env.password) return "missing-env"
  const active = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  })
  if (active) return "exists"
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", isActive: true, sessionVersion: { increment: 1 } },
    })
    return "restored"
  }
  await db.user.create({
    data: { email, passwordHash: await bcrypt.hash(env.password, BCRYPT_COST), role: "ADMIN" },
  })
  return "created"
}
