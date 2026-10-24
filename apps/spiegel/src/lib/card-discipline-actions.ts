"use server"

import { isCardIdInput, isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { chooseCardDiscipline } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

// Disziplin einer Scheibe wählen: nur eigene Scheiben, auch für Admins, und nur aus `disciplineOptions`. Die Familie
// zieht mit; danach rechnet die Seite über `router.refresh()` neu (kein `revalidatePath`: nach ihm scrollt Next zum
// Anker der Adresse).

/** die gewählte Disziplin einer eigenen Scheibe speichern; die vom Stand hebt eine Wahl auf */
export async function setCardDiscipline(
  cardId: string,
  disciplineId: number
): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: "Diese Scheibe gibt es nicht mehr." }
    if (!isRowId(disciplineId))
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    const result = await chooseCardDiscipline(db, { cardId, ownerId, disciplineId })
    if (result === "missing") return { error: "Diese Scheibe gibt es nicht mehr." }
    if (result === "notAllowed")
      return { error: "Diese Disziplin passt nicht zu der Scheibe. Bitte lade die Seite neu." }
    return { success: true }
  } catch {
    return { error: "Die Disziplin ließ sich nicht speichern." }
  }
}
