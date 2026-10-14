"use server"

import type { CardMark } from "@vereinsheim/shot-core/projection"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { marksOfCards } from "@/lib/db/reads"
import type { ActionResult } from "@/lib/types"

/**
 * Die Lagen einer Scheibe für die kleine Scheibe der Ablesung im Fortschritt: Eine neue Wahl holt sie nach, statt
 * die Lagen jeder Scheibe des Zeitraums mitzuschicken. Nur die eigene, nicht gelöschte Scheibe (auch für Admins);
 * `data: null`, wenn es sie nicht gibt. Ohne Sitzung oder mit Passwort vom Admin wie die Seiten keine Daten.
 */
export async function cardMarksAction(cardId: string): Promise<ActionResult<CardMark[] | null>> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an." }
    if (!isCardIdInput(cardId)) return { success: true, data: null }
    const marks = await marksOfCards(db, { ownerId, ids: [cardId] })
    return { success: true, data: marks[cardId] ?? null }
  } catch {
    return { error: "Die Lagen ließen sich nicht laden." }
  }
}
