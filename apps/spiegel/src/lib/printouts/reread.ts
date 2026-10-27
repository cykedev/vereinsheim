// Gespeicherte Ausdrucke neu lesen, wenn der Leser der Werte eine neue Version hat ([[meyton-printout]] „Werte lesen“):
// nur an Scheiben vom Ausdruck ohne Brücke, sichtbar für ihren Besitzer (nicht wartend, nicht im Papierkorb), die
// ältesten zuerst, höchstens `limit` je Lauf. Je Ausdruck liest der Kindprozess die Datei, die Zeile bekommt die neuen
// Werte, und die Scheibe nimmt sie in derselben Transaktion an (`applyPrintoutValues`).

import { READER_VERSION } from "@vereinsheim/meyton-pdf/reading"

import type { Db } from "../db"
import { applyPrintoutValues } from "./apply"
import { readPrintoutBytes } from "./files"
import { writePrintoutValues } from "./queries"
import { readPrintoutIsolated } from "./reader"
import { valuesReadOf } from "./store"

export interface RereadResult {
  /** neu gelesen */
  read: number
  /** danach mit Werten vom Ausdruck */
  taken: number
  /** Lesen scheiterte (nicht `busy`); bei zu altem Node endet der Lauf, die Zeilen bleiben für einen späteren */
  failed: number
  /** die Datei fehlt */
  missing: number
}

export async function rereadOutdatedPrintouts(
  db: Db,
  {
    limit = 50,
    read = readPrintoutIsolated,
    siteId,
  }: {
    limit?: number
    read?: typeof readPrintoutIsolated
    /** nur Scheiben mit Disziplinen dieser Anlage (Tests gegen die Dev-Datenbank) */
    siteId?: number
  } = {}
): Promise<RereadResult> {
  const result: RereadResult = { read: 0, taken: 0, failed: 0, missing: 0 }
  const rows = await db.printout.findMany({
    where: {
      OR: [{ readerVersion: null }, { readerVersion: { not: READER_VERSION } }],
      card: {
        is: {
          origin: "pdf",
          sourceId: null,
          deletedAt: null,
          ownerPending: false,
          ...(siteId === undefined ? {} : { discipline: { siteId } }),
        },
      },
    },
    orderBy: [{ storedAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, cardId: true, sha256: true },
  })
  for (const row of rows) {
    const bytes = await readPrintoutBytes(row.sha256)
    if (!bytes) {
      result.missing++
      continue
    }
    const isolated = await read(new Uint8Array(bytes))
    // der Leser ist belegt: der nächste Lauf macht weiter
    if (isolated.kind === "failed" && isolated.reason === "busy") break
    // zu altes Node: Jeder weitere scheiterte genauso, die Zeilen bleiben für einen Lauf mit passendem Node
    if (isolated.kind === "failed" && isolated.reason === "nodeVersion") {
      result.failed++
      break
    }
    // jeder andere Fehler (Zeit, Speicher, Absturz) ist `unreadable` mit dieser Version; eine stimmige Lesung einer
    // älteren Version bleibt dabei stehen (`writePrintoutValues`)
    const values = valuesReadOf(
      isolated.kind === "read" ? isolated.values : { kind: "failed", code: "unreadable" }
    )
    if (values.status === "unreadable") result.failed++
    const outcome = await db.$transaction(async (tx) => {
      await writePrintoutValues(tx, row.id, values)
      return applyPrintoutValues(tx, row.cardId)
    })
    result.read++
    if (outcome === "taken") result.taken++
  }
  return result
}
