// Zeilen der Ausdrucke. Ein Ausdruck hängt immer an einer Scheibe (`Printout.cardId`, Kaskade beim Löschen); die Datei
// liegt nach sha256 im Upload-Verzeichnis (`files.ts`) und verschwindet über `removeOrphanPrintoutFiles`, sobald keine
// Zeile mehr auf sie zeigt.

import { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"

import { VISIBLE_CARD } from "../db/visible"
import { readPrintoutBytes } from "./files"
import type { PrintoutValuesRead, PrintoutValuesStatus, StoredPrintout } from "./store"

/** die Werte, wie der Leser sie fand, als Spalten der Zeile; die Lesung nur bei `ok` */
export function valuesColumns(values: PrintoutValuesRead) {
  return {
    readerVersion: values.readerVersion,
    layout: values.layout,
    reading:
      values.status === "ok" && values.reading !== null
        ? (values.reading as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    valuesStatus: values.status,
  }
}

/**
 * hängt einen gespeicherten Ausdruck an eine Scheibe; derselbe Ausdruck an derselben Scheibe bleibt eine Zeile, deren
 * Werte der Leser dabei neu schreibt
 */
export async function attachPrintout(
  tx: Prisma.TransactionClient | Db,
  file: StoredPrintout,
  cardId: string
): Promise<string> {
  const values = valuesColumns(file.values)
  const row = await tx.printout.upsert({
    where: { cardId_sha256: { cardId, sha256: file.sha256 } },
    create: {
      cardId,
      sha256: file.sha256,
      fileName: file.fileName,
      size: file.size,
      footerId: file.hex,
      printedAt: file.printedAt,
      ...values,
    },
    update: values,
    select: { id: true },
  })
  return row.id
}

/** den Status der Werte eines Ausdrucks setzen, etwa `inconsistent` bei einem Widerspruch zum Scheibenbild */
export async function markPrintoutValues(
  tx: Prisma.TransactionClient | Db,
  printoutId: string,
  status: PrintoutValuesStatus
): Promise<void> {
  await tx.printout.update({
    where: { id: printoutId },
    data: {
      valuesStatus: status,
      ...(status === "ok" ? {} : { reading: Prisma.DbNull }),
    },
  })
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
