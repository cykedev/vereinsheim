// Zeilen der Ausdrucke. Ein Ausdruck hängt immer an einer Scheibe (`Printout.cardId`, Kaskade beim Löschen); die Datei
// liegt nach sha256 im Upload-Verzeichnis (`files.ts`) und verschwindet über `removeOrphanPrintoutFiles`, sobald keine
// Zeile mehr auf sie zeigt.

import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"

import { VISIBLE_CARD } from "../db/visible"
import { readPrintoutBytes } from "./files"
import type { StoredPrintout } from "./store"

/** hängt einen gespeicherten Ausdruck an eine Scheibe; derselbe Ausdruck an derselben Scheibe bleibt eine Zeile */
export async function attachPrintout(
  tx: Prisma.TransactionClient | Db,
  file: StoredPrintout,
  cardId: string
): Promise<string> {
  const row = await tx.printout.upsert({
    where: { cardId_sha256: { cardId, sha256: file.sha256 } },
    create: {
      cardId,
      sha256: file.sha256,
      fileName: file.fileName,
      size: file.size,
      footerId: file.hex,
      printedAt: file.printedAt,
    },
    update: {},
    select: { id: true },
  })
  return row.id
}

/**
 * die Datei eines Ausdrucks, nur für den Besitzer der Scheibe und nur, wo die Seite der Scheibe sie zeigt: nicht wartend,
 * nicht im Papierkorb, nicht bei ignorierter Disziplin; sonst null
 */
export async function printoutFile(
  db: Db,
  printoutId: string,
  ownerId: string
): Promise<{ bytes: Buffer; fileName: string; hex: string | null } | null> {
  const row = await db.printout.findFirst({
    where: { id: printoutId, card: { is: { ownerId, ...VISIBLE_CARD } } },
    select: { sha256: true, fileName: true, footerId: true },
  })
  if (!row) return null
  const bytes = await readPrintoutBytes(row.sha256)
  if (!bytes) {
    console.error("Ausdruck ohne Datei")
    return null
  }
  return { bytes, fileName: row.fileName, hex: row.footerId }
}
