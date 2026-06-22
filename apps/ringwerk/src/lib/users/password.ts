"use server"

import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import { validatePasswordChangeInput } from "@/lib/authValidation"
import type { ActionResult } from "@/lib/types"
import { BCRYPT_COST } from "./_shared"

export async function changeOwnPassword(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }

  const currentPassword = String(formData.get("currentPassword") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  const validationError = validatePasswordChangeInput({
    currentPassword,
    newPassword,
    confirmPassword,
  })
  if (validationError) return { error: validationError }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  })
  if (!user) return { error: "Nutzer nicht gefunden." }

  const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!passwordValid) return { error: "Aktuelles Passwort ist falsch." }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_COST)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, sessionVersion: { increment: 1 } },
  })

  return { success: true }
}
