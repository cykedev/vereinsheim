"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { ACTIVE_CONSENT } from "@/lib/consent/status"
import { db } from "@/lib/db"
import { purgeCards } from "@/lib/db/purge"
import { PENDING_CARD } from "@/lib/db/visible"
import type { ActionResult } from "@/lib/types"

// Erste Scheibe bestätigen (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D4, D5): Bis der Schütze die
// erste Scheibe einer Zustimmung als seine bestätigt, wartet jede neue (`Card.ownerPending`) und steht nur in „Offen“.
// Beide Actions gelten für alle wartenden Scheiben des Kontos unter derselben SportpassID.

const MISSING = "Die Scheibe gibt es nicht."
const FAILED = "Das ließ sich nicht speichern. Bitte noch einmal versuchen."

/**
 * eine eigene wartende Scheibe, ihre Zeile gesperrt: Ein zweiter Aufruf zugleich wartet und findet sie danach nicht
 * mehr (Review). Dazu, worauf sich beide Actions beziehen: dieselbe SportpassID an derselben Anlage (Review: eine Nummer
 * kann an zwei Anlagen vorkommen).
 */
async function pendingCard(tx: Prisma.TransactionClient, cardId: string, ownerId: string) {
  await tx.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`
  const card = await tx.card.findFirst({
    where: { id: cardId, ownerId, ...PENDING_CARD },
    select: { sportpassId: true, source: { select: { siteId: true } } },
  })
  if (!card?.source) return null
  const siteId = card.source.siteId
  return {
    siteId,
    sportpassId: card.sportpassId,
    /** die wartenden Scheiben desselben Kontos, derselben SportpassID und Anlage */
    waiting: { ownerId, sportpassId: card.sportpassId, source: { siteId }, ...PENDING_CARD },
  }
}

/** „Ja, meine“: die Wartenden der SportpassID werden sichtbar, die erste Scheibe der Zustimmung gilt als bestätigt */
export async function confirmFirstCard(cardId: string): Promise<ActionResult> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: "Nicht angemeldet" }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  try {
    const found = await db.$transaction(async (tx) => {
      const card = await pendingCard(tx, cardId, ownerId)
      if (!card) return false
      if (card.sportpassId !== null)
        await tx.sportpassConsent.updateMany({
          // nur eine aktive: Hat ein „Nicht meine“ sie gerade zurückgegeben, bleibt sie offen (Review)
          where: {
            userId: ownerId,
            siteId: card.siteId,
            sportpassId: card.sportpassId,
            firstCardConfirmedAt: null,
            returnedAt: null,
            ...ACTIVE_CONSENT,
          },
          data: { firstCardConfirmedAt: new Date() },
        })
      await tx.card.updateMany({ where: card.waiting, data: { ownerPending: false } })
      return true
    })
    if (!found) return { error: MISSING }
  } catch {
    return { error: FAILED }
  }
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
  try {
    const found = await db.$transaction(async (tx) => {
      const card = await pendingCard(tx, cardId, ownerId)
      if (!card) return false
      const waiting = await tx.card.findMany({ where: card.waiting, select: { id: true } })
      await purgeCards(
        tx,
        waiting.map((c) => c.id),
        { tombstone: "nicht-meine" }
      )
      if (card.sportpassId !== null)
        await tx.sportpassConsent.updateMany({
          where: {
            userId: ownerId,
            siteId: card.siteId,
            sportpassId: card.sportpassId,
            rejectedAt: null,
          },
          data: { returnedAt: new Date(), confirmedAt: null, firstCardConfirmedAt: null },
        })
      return true
    })
    if (!found) return { error: MISSING }
  } catch {
    return { error: FAILED }
  }
  revalidatePath("/", "layout")
  return { success: true }
}
