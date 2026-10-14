import type { Prisma } from "@/generated/prisma/client"

// Scheiben endgültig entfernen (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D6): „Nicht meine“ bei der
// ersten Scheibe, später der Papierkorb. Entfernt werden die Scheibe samt Ableitungen und ihre Rohdaten; ein Grabstein
// hält Brücke und Einlesen davon ab, sie zurückzubringen ([[spiegel-privacy]]).

type Tx = Prisma.TransactionClient

/**
 * So weit um den Beginn einer Scheibe gehören Stände derselben Quelle und ScheibenID zu ihr: Die ScheibenID ist ein
 * Zähler, der erst nach etwa 49,7 Tagen wiederkehrt (SF-77). Dasselbe Fenster nimmt das Einlesen für Grabsteine und
 * Löschsperren.
 */
export const CYCLE_WINDOW_MS = 30 * 86_400_000

/**
 * In der übergebenen Transaktion, je Scheibe: Grabstein (Quelle, ScheibenID, Zyklus, Beginn), die Scheibe (Kaskade auf
 * Revisionen, Schüsse, Projektion, Ausdrucke), ihre Stände im Fenster um den Beginn und jede Rohzeile dieser Quelle und
 * ScheibenID, auf die kein verbliebener Stand mehr zeigt. Unter demselben Advisory-Lock wie Ablage und Schreiben, damit
 * kein Stand gleichzeitig eine Zeile wiederverwendet, die hier verschwindet. Eine Scheibe ohne Quelle (nur ein PDF) hat
 * nichts davon und wird abgelehnt.
 */
export async function purgeCards(
  tx: Tx,
  cardIds: readonly string[],
  reason: string
): Promise<void> {
  const cards = await tx.card.findMany({
    where: { id: { in: [...cardIds] } },
    select: { id: true, sourceId: true, scheibenId: true, cycle: true, startedAt: true },
  })
  for (const card of cards) {
    if (card.sourceId === null || card.scheibenId === null)
      throw new RangeError(`Scheibe ${card.id} ohne Quelle: nichts zu entfernen`)
    const { sourceId, scheibenId, cycle, startedAt } = card
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    await tx.tombstone.upsert({
      where: { sourceId_scheibenId_cycle: { sourceId, scheibenId, cycle } },
      create: { sourceId, scheibenId, cycle, startedAt, reason },
      update: {},
    })
    await tx.card.delete({ where: { id: card.id } })
    await tx.rawSnapshot.deleteMany({
      where: {
        sourceId,
        scheibenId,
        observedAt: {
          gte: new Date(startedAt.getTime() - CYCLE_WINDOW_MS),
          lte: new Date(startedAt.getTime() + CYCLE_WINDOW_MS),
        },
      },
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
  if (cards.length !== new Set(cardIds).size) throw new RangeError("Unbekannte Scheibe")
}
