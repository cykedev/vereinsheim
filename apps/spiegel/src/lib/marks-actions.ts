"use server"

import type { CardMark } from "@vereinsheim/shot-core/projection"
import { isCardId } from "@vereinsheim/shot-ui/nav/routes"

import { getAuthSession } from "@/lib/auth-helpers"
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
    const session = await getAuthSession()
    if (!session || session.user.mustChangePassword) return { error: "Nicht angemeldet" }
    if (typeof cardId !== "string" || cardId.length > 64 || !isCardId(cardId))
      return { success: true, data: null }
    const marks = await marksOfCards(db, { ownerId: session.user.id, ids: [cardId] })
    return { success: true, data: marks[cardId] ?? null }
  } catch {
    return { error: "Die Lagen ließen sich nicht laden." }
  }
}
