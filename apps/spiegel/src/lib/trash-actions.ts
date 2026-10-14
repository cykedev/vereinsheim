"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { lockCard, purgeCards } from "@/lib/db/purge"
import { trashEndsAt } from "@/lib/db/trash"
import type { ActionResult } from "@/lib/types"

// Löschen mit Papierkorb (P2b, Plan `plans/2026-10-14-spiegel-papierkorb.md`, D3): nur eigene Scheiben, jede Action
// unter der Sperre der Zeile, Prüfung und Änderung in einer Transaktion (§9). Eine wartende Scheibe in „Offen“ hat
// „Nicht meine“ und lässt sich hier nicht löschen.

const MISSING = "Die Scheibe gibt es nicht."
const NOT_IN_TRASH = "Die Scheibe liegt nicht im Papierkorb."
const FAILED = "Das ließ sich nicht speichern. Bitte noch einmal versuchen."

/** die eigene, nicht wartende Scheibe, gesperrt wie beim Schreiben (`lockCard`); sonst null */
async function ownCard(tx: Prisma.TransactionClient, cardId: string, ownerId: string) {
  if (!(await lockCard(tx, cardId))) return null
  return tx.card.findFirst({
    where: { id: cardId, ownerId, ownerPending: false },
    select: { deletedAt: true },
  })
}

/** Rahmen jeder Action: Sitzung, Kennung, Transaktion, Fehler als Text, danach alle Ansichten neu */
async function run(
  cardId: string,
  change: (tx: Prisma.TransactionClient, ownerId: string) => Promise<string | null>
): Promise<ActionResult> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: "Nicht angemeldet" }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  let error: string | null
  try {
    error = await db.$transaction((tx) => change(tx, ownerId))
  } catch {
    return { error: FAILED }
  }
  if (error) return { error }
  revalidatePath("/", "layout")
  return { success: true }
}

/** in den Papierkorb: zählt 30 Tage nirgends mit, danach endgültig gelöscht */
export async function deleteCard(cardId: string): Promise<ActionResult> {
  return run(cardId, async (tx, ownerId) => {
    const card = await ownCard(tx, cardId, ownerId)
    if (!card) return MISSING
    if (card.deletedAt) return "Schon gelöscht."
    // die Bedingung auch im Befehl selbst (§9)
    const { count } = await tx.card.updateMany({
      where: { id: cardId, ownerId, ownerPending: false, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    return count === 1 ? null : MISSING
  })
}

/** aus dem Papierkorb zurück, solange die 30 Tage nicht um sind */
export async function restoreCard(cardId: string): Promise<ActionResult> {
  return run(cardId, async (tx, ownerId) => {
    const card = await ownCard(tx, cardId, ownerId)
    if (!card) return MISSING
    if (!card.deletedAt) return NOT_IN_TRASH
    if (trashEndsAt(card.deletedAt).getTime() <= Date.now())
      return "Die 30 Tage sind um; die Scheibe lässt sich nicht mehr wiederherstellen."
    const { count } = await tx.card.updateMany({
      where: { id: cardId, ownerId, deletedAt: card.deletedAt },
      data: { deletedAt: null },
    })
    return count === 1 ? null : MISSING
  })
}

/** sofort endgültig löschen, mit weicher Sperre; nur aus dem Papierkorb */
export async function purgeCardNow(cardId: string): Promise<ActionResult> {
  return run(cardId, async (tx, ownerId) => {
    const card = await ownCard(tx, cardId, ownerId)
    if (!card) return MISSING
    if (!card.deletedAt) return NOT_IN_TRASH
    await purgeCards(tx, [cardId], { lock: true })
    return null
  })
}
