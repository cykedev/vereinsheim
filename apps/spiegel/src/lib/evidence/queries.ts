// Belege einer Scheibe für den Kasten „Diese Scheibe“ ([[adr-033]]): nur für den Besitzer einer sichtbaren Scheibe, in
// der Folge des Anhängens. Die geteilte Seite liest sie nie.

import type { Db } from "@/lib/db"

import { VISIBLE_CARD } from "../db/visible"

/** ein Beleg, wie die Zeile „Belege“ ihn zeigt */
export interface CardEvidenceInfo {
  id: string
  kind: "photo" | "pdf"
  /** der Name der Datei; null bei Belegen ohne Namen */
  name: string | null
  size: number
  storedAtMs: number
}

/** die Belege einer eigenen, sichtbaren Scheibe; sonst keine */
export async function cardEvidenceList(
  db: Db,
  { cardId, ownerId }: { cardId: string; ownerId: string }
): Promise<CardEvidenceInfo[]> {
  const rows = await db.cardEvidence.findMany({
    where: { cardId, card: { is: { id: cardId, ownerId, ...VISIBLE_CARD } } },
    orderBy: [{ storedAt: "asc" }, { id: "asc" }],
    select: { id: true, contentType: true, fileName: true, size: true, storedAt: true },
  })
  return rows.map((row) => ({
    id: row.id,
    kind: row.contentType === "application/pdf" ? "pdf" : "photo",
    name: row.fileName,
    size: row.size,
    storedAtMs: row.storedAt.getTime(),
  }))
}
