"use server"

import { getAuthSession } from "@/lib/auth-helpers"
import { ACCOUNT_TEXTS } from "@/lib/admin/consequences"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"
import { sweepUploadsSoon } from "@/lib/uploads"

import { deleteAccount } from "./account"

/**
 * Das eigene Konto löschen (Profil → Deine Daten). Nicht mit einem Passwort vom Admin: Das kennt der Admin. Danach
 * meldet die Oberfläche ab; die Sitzung gilt ohnehin nicht mehr, `getAuthSession` findet das Konto nicht.
 */
export async function deleteOwnAccount(password: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session || session.user.mustChangePassword || typeof password !== "string")
    return { error: ACCOUNT_TEXTS.failed }
  const result = await deleteAccount(db, session.user.id, password)
  switch (result) {
    case "deleted":
      sweepUploadsSoon(db)
      return { success: true }
    case "wrongPassword":
      return { error: ACCOUNT_TEXTS.wrongPassword }
    case "lastAdmin":
      return { error: ACCOUNT_TEXTS.lastAdmin }
    case "gone":
      return { error: ACCOUNT_TEXTS.failed }
  }
}
