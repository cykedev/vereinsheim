import type { Prisma } from "@/generated/prisma/client"

import { SAME_CARD_MS, startHintMs } from "./blocks"

// Scheiben endgültig entfernen (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D6): „Nicht meine“ bei der
// ersten Scheibe, später der Papierkorb. Entfernt werden die Scheibe samt Ableitungen und ihre Rohdaten; ein Grabstein
// hält Brücke und Einlesen davon ab, sie zurückzubringen ([[spiegel-privacy]]).

type Tx = Prisma.TransactionClient

/**
 * In der übergebenen Transaktion, je Scheibe (in fester Folge, damit zwei Aufrufe ihre Sperren nicht über Kreuz nehmen):
 * unter demselben Advisory-Lock wie Ablage und Schreiben Grabstein (Quelle, ScheibenID, Zyklus, Beginn), die Scheibe
 * (Kaskade auf Revisionen, Schüsse, Projektion, Ausdrucke), ihre Stände und jede Rohzeile dieser Quelle und ScheibenID,
 * auf die kein verbliebener Stand mehr zeigt.
 *
 * Welche Stände zu ihr gehören, entscheidet ihr **Beginn** aus den Trefferzeiten (`startHintMs`), nicht die Beobachtung:
 * Die Brücke liest auch Wochen später nach, und ein später nachgelesener früherer Zyklus derselben ScheibenID darf nicht
 * mitgehen (Review). Ein Stand, auf den noch die Revision einer anderen Scheibe zeigt, bleibt. Eine schon entfernte
 * Scheibe (ein zweiter Aufruf zugleich) wird übersprungen; eine ohne Quelle (nur ein PDF) hat keine Rohdaten und ist ein
 * Fehler des Aufrufers.
 */
export async function purgeCards(
  tx: Tx,
  cardIds: readonly string[],
  reason: string
): Promise<void> {
  const cards = await tx.card.findMany({
    where: { id: { in: [...cardIds] } },
    orderBy: [{ sourceId: "asc" }, { scheibenId: "asc" }, { cycle: "asc" }],
    select: { id: true, sourceId: true, scheibenId: true, cycle: true, startedAt: true },
  })
  for (const card of cards) {
    if (card.sourceId === null || card.scheibenId === null)
      throw new RangeError(`Scheibe ${card.id} ohne Quelle: nichts zu entfernen`)
    const { sourceId, scheibenId, cycle, startedAt } = card
    const key = { sourceId, scheibenId }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    const { count } = await tx.card.deleteMany({ where: { id: card.id } })
    if (count === 0) continue
    await tx.tombstone.upsert({
      where: { sourceId_scheibenId_cycle: { sourceId, scheibenId, cycle } },
      create: { sourceId, scheibenId, cycle, startedAt, reason },
      update: {},
    })
    await tx.rawSnapshot.deleteMany({
      where: { id: { in: await ownSnapshots(tx, key, startedAt.getTime()) } },
    })
    await tx.$executeRaw`
      DELETE FROM "RawRow" r
      WHERE r."sourceId" = ${sourceId} AND r."scheibenId" = ${scheibenId}
        AND NOT EXISTS (
          SELECT 1 FROM "RawSnapshot" s
          WHERE s."sourceId" = r."sourceId" AND s."scheibenId" = r."scheibenId"
            AND (r.id = ANY(s."scheibenRowIds") OR r.id = ANY(s."serienRowIds") OR r.id = ANY(s."trefferRowIds"))
        )`
  }
}

/**
 * Die Stände dieser Quelle und ScheibenID, deren Beginn bei `startedAtMs` liegt (wie `SAME_CARD_MS` im Einlesen) und auf
 * die keine Revision mehr zeigt (die der entfernten Scheibe sind mit ihr gegangen).
 */
async function ownSnapshots(
  tx: Tx,
  key: { sourceId: number; scheibenId: number },
  startedAtMs: number
): Promise<bigint[]> {
  const snapshots = await tx.rawSnapshot.findMany({
    where: { ...key, revisions: { none: {} } },
    select: { id: true, observedAt: true, trefferRowIds: true },
  })
  const rowIds = [...new Set(snapshots.flatMap((s) => s.trefferRowIds))]
  const rows = rowIds.length
    ? await tx.rawRow.findMany({
        where: { id: { in: rowIds } },
        select: { id: true, values: true },
      })
    : []
  const stampOf = new Map(
    rows.map((row) => [row.id, (row.values as Record<string, string | null>).Zeitstempel])
  )
  return snapshots
    .filter((snapshot) => {
      const at = startHintMs(
        snapshot.trefferRowIds.map((id) => stampOf.get(id)),
        snapshot.observedAt.getTime()
      )
      return Math.abs(at - startedAtMs) <= SAME_CARD_MS
    })
    .map((snapshot) => snapshot.id)
}
