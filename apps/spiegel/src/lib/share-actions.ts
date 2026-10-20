"use server"

import { randomUUID } from "node:crypto"

import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { lockCard } from "@/lib/db/purge"
import { VISIBLE_CARD } from "@/lib/db/visible"
import type { ActionResult } from "@/lib/types"

// Teilen einer eigenen Scheibe per Link: Prüfung und Änderung in einer Transaktion unter der Sperre der Zeile (§9).
// Kein `revalidatePath`: Danach scrollte Next zum Anker der Adresse; der Abschnitt „Teilen“ hält den Zustand aus dem
// Ergebnis.

const MISSING = "Diese Scheibe gibt es nicht mehr."
const RETRY = "Das geht gerade nicht. Lade die Seite neu."

/** der Link einer geteilten Scheibe und seit wann sie geteilt ist */
export interface Share {
  shareId: string
  sharedAtMs: number
}

/** teilt die eigene sichtbare Scheibe; ist sie schon geteilt, bleibt ihr Link */
export async function shareCard(cardId: string): Promise<ActionResult<Share>> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: RETRY }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  try {
    const share = await db.$transaction(async (tx): Promise<Share | null> => {
      if (!(await lockCard(tx, cardId))) return null
      const card = await tx.card.findFirst({
        where: { id: cardId, ownerId, ...VISIBLE_CARD },
        select: { shareId: true, sharedAt: true },
      })
      if (!card) return null
      if (card.shareId && card.sharedAt)
        return { shareId: card.shareId, sharedAtMs: card.sharedAt.getTime() }
      const next = { shareId: randomUUID(), sharedAt: new Date() }
      // die Bedingung auch im Befehl selbst (§9)
      const { count } = await tx.card.updateMany({
        where: { id: cardId, ownerId, shareId: null, ...VISIBLE_CARD },
        data: next,
      })
      return count === 1 ? { shareId: next.shareId, sharedAtMs: next.sharedAt.getTime() } : null
    })
    return share ? { success: true, data: share } : { error: MISSING }
  } catch {
    return { error: "Der Link ließ sich nicht erstellen." }
  }
}

/** beendet das Teilen der eigenen Scheibe; der Link geht danach nicht mehr, neu teilen gibt einen neuen */
export async function stopSharingCard(cardId: string): Promise<ActionResult> {
  const ownerId = await shooterId()
  if (!ownerId) return { error: RETRY }
  if (!isCardIdInput(cardId)) return { error: MISSING }
  try {
    const { count } = await db.card.updateMany({
      where: { id: cardId, ownerId },
      data: { shareId: null, sharedAt: null },
    })
    return count === 1 ? { success: true } : { error: MISSING }
  } catch {
    return { error: "Das Teilen ließ sich nicht beenden." }
  }
}
