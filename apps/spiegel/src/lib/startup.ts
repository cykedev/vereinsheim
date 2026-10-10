import bcrypt from "bcryptjs"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"

import type { Db } from "@/lib/db"

export const BCRYPT_COST = 12

export type SeedAdminResult = "created" | "exists" | "missing-env"

/**
 * Das erste Admin-Konto aus `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD`, nur wenn es noch keinen Admin gibt (wie
 * Ringwerk). Die E-Mail wird normalisiert gespeichert, wie die Anmeldung sie vergleicht.
 */
export async function ensureSeedAdmin(
  db: Pick<Db, "user">,
  env: { email?: string; password?: string }
): Promise<SeedAdminResult> {
  const email = env.email ? normalizeLoginEmail(env.email) : null
  if (!email || !env.password) return "missing-env"
  if (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) return "exists"
  await db.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(env.password, BCRYPT_COST),
      role: "ADMIN",
    },
  })
  return "created"
}
