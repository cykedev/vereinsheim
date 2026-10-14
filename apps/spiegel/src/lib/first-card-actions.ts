"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { purgeCards } from "@/lib/db/purge"
import { PENDING_CARD } from "@/lib/db/visible"
import type { ActionResult } from "@/lib/types"

// Erste Scheibe bestätigen (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D4, D5): Bis der Schütze die
// erste Scheibe einer Zustimmung als seine bestätigt, wartet jede neue (`Card.ownerPending`) und steht nur in „Offen“.
// Beide Actions gelten für alle wartenden Scheiben des Kontos unter derselben SportpassID.

const MISSING = "Die Scheibe gibt es nicht."

/** eine eigene wartende Scheibe; die Anlage über ihre Quelle */
async function pendingCard(tx: Prisma.TransactionClient, cardId: string, ownerId: string) {
  return tx.card.findFirst({
    where: { id: cardId, ownerId, ...PENDING_CARD },
    select: { sportpassId: true, source: { select: { siteId: true } } },
  })
}

/** „Ja, meine“: die Wartenden der SportpassID werden sichtbar, die erste Scheibe der Zustimmung gilt als bestätigt */
export async function confirmFirstCard(cardId: string): Promise<ActionResult> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: "Nicht angemeldet" }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  const found = await db.$transaction(async (tx) => {
    const card = await pendingCard(tx, cardId, ownerId)
    if (!card) return false
    if (card.sportpassId !== null && card.source)
      await tx.sportpassConsent.updateMany({
        where: {
          userId: ownerId,
          siteId: card.source.siteId,
          sportpassId: card.sportpassId,
          firstCardConfirmedAt: null,
        },
        data: { firstCardConfirmedAt: new Date() },
      })
    await tx.card.updateMany({
      where: { ownerId, sportpassId: card.sportpassId, ...PENDING_CARD },
      data: { ownerPending: false },
    })
    return true
  })
  if (!found) return { error: MISSING }
  revalidatePath("/", "layout")
  return { success: true }
}

/**
 * „Nicht meine“: die Wartenden der SportpassID werden entfernt und bekommen einen Grabstein, die Zustimmung geht zurück
 * an den Admin (User, 14. Oktober 2026); eine abgelehnte bleibt abgelehnt. Bis der Admin erneut bestätigt, lädt die
 * Brücke unter dieser Nummer nichts mehr.
 */
export async function rejectFirstCard(cardId: string): Promise<ActionResult> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: "Nicht angemeldet" }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  const found = await db.$transaction(async (tx) => {
    const card = await pendingCard(tx, cardId, ownerId)
    if (!card) return false
    const waiting = await tx.card.findMany({
      where: { ownerId, sportpassId: card.sportpassId, ...PENDING_CARD },
      select: { id: true },
    })
    await purgeCards(
      tx,
      waiting.map((c) => c.id),
      "nicht-meine"
    )
    if (card.sportpassId !== null && card.source)
      await tx.sportpassConsent.updateMany({
        where: {
          userId: ownerId,
          siteId: card.source.siteId,
          sportpassId: card.sportpassId,
          rejectedAt: null,
        },
        data: { returnedAt: new Date(), confirmedAt: null, firstCardConfirmedAt: null },
      })
    return true
  })
  if (!found) return { error: MISSING }
  revalidatePath("/", "layout")
  return { success: true }
}
