"use server"

import bcrypt from "bcryptjs"

import { validatePasswordChangeInput } from "@vereinsheim/lib/auth/validation"

import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { BCRYPT_COST } from "@/lib/startup"
import type { ActionResult } from "@/lib/types"

/**
 * Das eigene Passwort ändern (wie Ringwerk): mit dem aktuellen, beendet alle Sitzungen und hebt ein Passwort vom Admin
 * auf. Auch mit einem Passwort vom Admin erlaubt, dafür ist die Seite da.
 */
export async function changeOwnPassword(
  _previous: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }

  const currentPassword = String(formData.get("currentPassword") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const invalid = validatePasswordChangeInput({ currentPassword, newPassword, confirmPassword })
  if (invalid) return { error: invalid }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  })
  if (!user) return { error: "Konto nicht gefunden." }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
    return { error: "Das aktuelle Passwort stimmt nicht." }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  })
  return { success: true }
}
