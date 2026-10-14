import type { Db } from "@/lib/db"

import { purgeCards } from "./purge"

// Papierkorb (P2b, Plan `plans/2026-10-14-spiegel-papierkorb.md`, D4; [[spiegel-navigation]] Entscheidung 15): Eine
// gelöschte Scheibe liegt 30 Tage dort und zählt nirgends mit. Danach wird sie endgültig gelöscht, und die weiche Sperre
// ihres Besitzers hält die Brücke davon ab, sie zurückzubringen.

export const TRASH_DAYS = 30
const TRASH_MS = TRASH_DAYS * 86_400_000

/** bis wann eine gelöschte Scheibe wiederherstellbar ist */
export function trashEndsAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_MS)
}

/**
 * Entfernt jede Scheibe, die seit mehr als 30 Tagen im Papierkorb liegt, über `purgeCards` mit weicher Sperre; je
 * Scheibe eine eigene Transaktion, damit eine fehlerhafte die übrigen nicht aufhält. Eine Scheibe ohne Besitzer (Konto
 * entfernt) bleibt liegen: Für sie gibt es niemanden, dem die Sperre gilt. `sourceId` begrenzt den Lauf (Tests).
 */
export async function purgeExpiredTrash(
  db: Db,
  { nowMs, sourceId }: { nowMs: number; sourceId?: number }
): Promise<{ purged: number; failed: number }> {
  const expired = await db.card.findMany({
    where: {
      deletedAt: { lt: new Date(nowMs - TRASH_MS) },
      // ohne Besitzer bliebe sie sonst stündlich als Fehler liegen
      ownerId: { not: null },
      ...(sourceId === undefined ? {} : { sourceId }),
    },
    select: { id: true },
  })
  let purged = 0
  let failed = 0
  const cutoff = new Date(nowMs - TRASH_MS)
  for (const card of expired) {
    try {
      // unter der Sperre der Zeile noch einmal abgelaufen? (ein Wiederherstellen sperrt dieselbe Zeile, §9)
      const done = await db.$transaction(async (tx) => {
        const still = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Card" WHERE id = ${card.id} AND "deletedAt" < ${cutoff} FOR UPDATE`
        if (!still.length) return false
        await purgeCards(tx, [card.id], { lock: true })
        return true
      })
      if (done) purged++
    } catch {
      failed++
    }
  }
  return { purged, failed }
}
