import type { Prisma } from "@/generated/prisma/client"

import { SAME_CARD_MS, startHintMs } from "./blocks"

// Scheiben endgültig entfernen: „Nicht meine“ bei der ersten Scheibe und der Papierkorb. Entfernt werden die Scheibe
// samt Ableitungen und ihre Rohdaten; ein Grabstein oder eine weiche Sperre hält Brücke und Einlesen davon ab, sie
// zurückzubringen ([[spiegel-privacy]]).

type Tx = Prisma.TransactionClient

/**
 * Was zurückbleibt: ein Grabstein (fremde Daten, „Nicht meine“; mit Grund, Besitzer und SportpassID der Scheibe) oder
 * die weiche Sperre des Besitzers (eigene, endgültig gelöschte; ein ausdrückliches Holen hebt sie später auf).
 */
export type PurgeBlock = { tombstone: TombstoneReason } | { lock: true }

/** warum ein Grabstein steht; eine Stelle für Entfernen, Papierkorb und Admin */
export const NOT_MINE = "nicht-meine"
export type TombstoneReason = typeof NOT_MINE

/**
 * Sperrt eine Scheibe in der Folge des Schreibens (`writeRevision`, `storeSnapshot`): erst das Advisory-Lock ihrer Quelle
 * und ScheibenID, dann ihre Zeile (`FOR UPDATE`). Wer eine Scheibe prüft und danach entfernt oder ändert, ruft das zuerst;
 * die umgekehrte Folge könnte mit dem Einlesen derselben Scheibe über Kreuz warten. Der Schlüssel einer
 * Scheibe ändert sich nicht (außer eine aus dem PDF bekommt ihre Rohdaten). false, wenn es sie nicht gibt.
 */
export async function lockCard(tx: Tx, cardId: string): Promise<boolean> {
  const [key] = await tx.$queryRaw<{ sourceId: number | null; scheibenId: number | null }[]>`
    SELECT "sourceId", "scheibenId" FROM "Card" WHERE id = ${cardId}`
  if (!key) return false
  if (key.sourceId !== null && key.scheibenId !== null)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key.sourceId}::int, ${key.scheibenId}::int)`
  await tx.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`
  return true
}

/**
 * In der übergebenen Transaktion, je Scheibe (in fester Folge, damit zwei Aufrufe ihre Sperren nicht über Kreuz nehmen):
 * unter demselben Advisory-Lock wie Ablage und Schreiben Grabstein (Quelle, ScheibenID, Zyklus, Beginn), die Scheibe
 * (Kaskade auf Revisionen, Schüsse, Projektion, Ausdrucke), ihre Stände und jede Rohzeile dieser Quelle und ScheibenID,
 * auf die kein verbliebener Stand mehr zeigt.
 *
 * Welche Stände zu ihr gehören, entscheidet ihr **Beginn** aus den Trefferzeiten (`startHintMs`), nicht die Beobachtung:
 * Die Brücke liest auch Wochen später nach, und ein später nachgelesener früherer Zyklus derselben ScheibenID darf nicht
 * mitgehen. Ein Stand, auf den noch die Revision einer anderen Scheibe zeigt, bleibt. Eine schon entfernte
 * Scheibe (ein zweiter Aufruf zugleich) wird übersprungen; eine ohne Quelle (nur ein PDF) hat keine Rohdaten und ist ein
 * Fehler des Aufrufers.
 *
 * Mit `lock` gilt die Sperre dem Besitzer (eine Scheibe ohne Besitzer ist ein Fehler des Aufrufers); eine Scheibe ohne
 * Quelle (nur ein PDF) hat weder Rohdaten noch Sperre und wird nur gelöscht. Mit `tombstone` bleibt sie ein Fehler.
 */
export async function purgeCards(
  tx: Tx,
  cardIds: readonly string[],
  block: PurgeBlock
): Promise<void> {
  const cards = await tx.card.findMany({
    where: { id: { in: [...cardIds] } },
    orderBy: [{ sourceId: "asc" }, { scheibenId: "asc" }, { cycle: "asc" }],
    select: {
      id: true,
      sourceId: true,
      scheibenId: true,
      cycle: true,
      startedAt: true,
      ownerId: true,
      sportpassId: true,
    },
  })
  for (const card of cards) {
    if ("lock" in block && card.ownerId === null)
      throw new RangeError(`Scheibe ${card.id} ohne Besitzer: keine Sperre möglich`)
    if (card.sourceId === null || card.scheibenId === null) {
      if ("tombstone" in block)
        throw new RangeError(`Scheibe ${card.id} ohne Quelle: nichts zu entfernen`)
      await tx.card.deleteMany({ where: { id: card.id } })
      continue
    }
    const { sourceId, scheibenId, cycle, startedAt } = card
    const key = { sourceId, scheibenId }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    const { count } = await tx.card.deleteMany({ where: { id: card.id } })
    if (count === 0) continue
    if ("tombstone" in block)
      await tx.tombstone.upsert({
        where: { sourceId_scheibenId_cycle: { sourceId, scheibenId, cycle } },
        create: {
          sourceId,
          scheibenId,
          cycle,
          startedAt,
          reason: block.tombstone,
          userId: card.ownerId,
          sportpassId: card.sportpassId,
        },
        update: {},
      })
    else
      await tx.deleteLock.upsert({
        where: {
          userId_sourceId_scheibenId_cycle: { userId: card.ownerId!, sourceId, scheibenId, cycle },
        },
        create: { userId: card.ownerId!, sourceId, scheibenId, cycle, startedAt },
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
