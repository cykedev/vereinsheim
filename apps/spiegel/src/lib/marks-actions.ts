"use server"

import type { CardMark } from "@vereinsheim/shot-core/projection"

import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { marksOfCards } from "@/lib/db/reads"

/**
 * Die Lagen einer Scheibe für die kleine Scheibe der Ablesung im Fortschritt: Eine neue Wahl holt sie nach, statt
 * die Lagen jeder Scheibe des Zeitraums mitzuschicken. Nur die eigene, nicht gelöschte Scheibe (auch für Admins); sonst
 * und ohne Sitzung null.
 */
export async function cardMarksAction(cardId: string): Promise<CardMark[] | null> {
  const session = await getAuthSession()
  if (!session || typeof cardId !== "string" || cardId.length > 64) return null
  const marks = await marksOfCards(db, { ownerId: session.user.id, ids: [cardId] })
  return marks[cardId] ?? null
}
