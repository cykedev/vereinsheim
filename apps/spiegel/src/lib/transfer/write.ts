// Scheiben, Ausdrucke und Belege der Übernahme aus Treffsicher schreiben ([[spiegel-account-transfer]]), in der
// Transaktion des Aufrufers. Den Schlüssel einer Scheibe gibt der Aufrufer; der Ergebnisteil kennt die Übernahme nicht.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { CardKind, Prisma } from "@/generated/prisma/client"

import { writeEnteredCardIn, type EnteredResult } from "../db/entered"
import type { DetailsInput } from "../entered/details"
import { attachEvidenceIn, type Attached } from "../evidence/attach"
import type { EvidenceType } from "../evidence/files"
import { importPrintoutIn, type ImportResult } from "../fetch-card/import"
import { ownCardOfEvening } from "../fetch-card/queries"
import {
  adoptPrintoutValues,
  printoutFits,
  type AdoptOutcome,
  type TransferredUnit,
} from "../fetch-card/transferred"
import { attachPrintout } from "../printouts/queries"
import type { StoredPrintout } from "../printouts/store"

type Tx = Prisma.TransactionClient

/**
 * Eine Scheibe „aus Treffsicher“ über ihren Schlüssel anlegen oder ersetzen. Eine von Hand oder vom Ausdruck geänderte
 * (`notEditable`) oder eine im Papierkorb (`missing`) bleibt; der Aufrufer zählt sie als „geändert, bleibt“. Die Art
 * aus Treffsicher steht auch als Wahl (`kindChoice`), damit sie bleibt, wenn die Brücke die Scheibe füllt; ein späterer
 * Lauf setzt beide neu. Der Aufrufer ruft nur für unveränderte oder nie platzierte Scheiben (Hauptbuch), eine eigene
 * Wahl des Schützen bleibt also.
 */
export async function writeTransferCard(
  tx: Tx,
  input: {
    ownerId: string
    disciplineId: number
    startedAtMs: number
    kind: CardKind
    place: string | null
    importKey: string
    details: DetailsInput
  }
): Promise<EnteredResult> {
  const written = await writeEnteredCardIn(tx, {
    ownerId: input.ownerId,
    origin: "treffsicher",
    disciplineId: input.disciplineId,
    startedAtMs: input.startedAtMs,
    kind: input.kind,
    kindChoice: input.kind,
    place: input.place,
    importKey: input.importKey,
    details: input.details,
    reason: "treffsicher",
  })
  if (written.kind === "saved" && written.change !== "created") {
    const card = await tx.card.findUniqueOrThrow({
      where: { id: written.cardId },
      select: { kind: true, kindChoice: true },
    })
    if (card.kind !== input.kind || card.kindChoice !== input.kind)
      await tx.card.update({
        where: { id: written.cardId },
        data: { kind: input.kind, kindChoice: input.kind },
      })
  }
  return written
}

/** ein Anhang aus Treffsicher, gelesen und geprüft vor der Transaktion */
export type PreparedAttachment =
  | {
      kind: "printout"
      file: StoredPrintout
      /** die Disziplin der Einheit, falls der Ausdruck eine eigene Scheibe braucht und sein Kopf keine bekannte nennt */
      disciplineId?: number | null
    }
  | {
      kind: "evidence"
      sha256: string
      type: EvidenceType
      size: number
      fileName: string | null
    }

export type PlacedAttachment =
  /** Ausdruck an der eigenen Scheibe mit seiner ID am Abend (Brücke, Ausdruck, Import) */
  | { kind: "printoutOwnCard"; cardId: string; result: ImportResult }
  /** Ausdruck an der Scheibe der Einheit; `adopted`: seine Werte sind jetzt die der Scheibe */
  | {
      kind: "printoutUnitCard"
      cardId: string
      fits: boolean
      /** ohne Werte, weil die Scheibe nicht „aus Treffsicher“ ist oder der Ausdruck nicht passt */
      adopted: AdoptOutcome | "notTreffsicher" | "notFitting"
    }
  /** Ausdruck ohne Scheibe der Einheit: wie ein alter Ausdruck eingelesen (neue Scheibe vom Ausdruck oder Grund) */
  | { kind: "printoutImported"; result: ImportResult }
  | { kind: "evidence"; cardId: string; result: Attached }
  /** Foto oder PDF ohne eine Scheibe der Einheit: bleibt in der Sicherung von Treffsicher */
  | { kind: "evidenceNoCard" }

/**
 * Wohin ein Anhang einer Einheit geht. Ein Meyton-Ausdruck: an die eigene Scheibe mit seiner ID an seinem Abend; sonst
 * an `card` (die Scheibe der Einheit), mit seinen Werten, wenn sie „aus Treffsicher“ ist und er passt
 * (`printoutFits`); ohne `card` wie ein alter Ausdruck (`importPrintoutIn`), aber ohne Suche nach einer anderen Scheibe
 * aus Treffsicher. Ein Foto oder gewöhnliches PDF wird Beleg an `card`.
 */
export async function placeAttachment(
  tx: Tx,
  input: {
    ownerId: string
    siteId: number
    timeZone: string
    /** die Scheibe der Einheit (neu, unsicher oder die erste passende); null ohne */
    card: { id: string } | null
    unit: TransferredUnit | null
    attachment: PreparedAttachment
  }
): Promise<PlacedAttachment> {
  const { ownerId, siteId, timeZone, card, attachment } = input
  if (attachment.kind === "evidence") {
    if (!card) return { kind: "evidenceNoCard" }
    const result = await attachEvidenceIn(tx, {
      cardId: card.id,
      ownerId,
      sha256: attachment.sha256,
      type: attachment.type,
      size: attachment.size,
      fileName: attachment.fileName,
    })
    return { kind: "evidence", cardId: card.id, result }
  }

  const { file } = attachment
  const { own } = await ownCardOfEvening(tx, {
    userId: ownerId,
    siteId,
    scheibenId: file.scheibenId,
    day: eveningDay(file.printedAt.getTime(), timeZone),
    timeZone,
  })
  // die eigene Scheibe mit dieser ID ist die der Einheit, wenn ein früherer Lauf den Ausdruck dort angehängt hat: dann
  // wie beim ersten Lauf über die Scheibe der Einheit, damit ein passender Ausdruck seine Werte gibt
  if (own && own.id !== card?.id) {
    const result = await importPrintoutIn(tx, {
      userId: ownerId,
      siteId,
      file,
      fallbackDisciplineId: attachment.disciplineId,
      matchTransferred: false,
    })
    return { kind: "printoutOwnCard", cardId: own.id, result }
  }
  if (!card)
    return {
      kind: "printoutImported",
      result: await importPrintoutIn(tx, {
        userId: ownerId,
        siteId,
        file,
        fallbackDisciplineId: attachment.disciplineId,
        matchTransferred: false,
      }),
    }

  const printoutId = await attachPrintout(tx, file, card.id)
  const row = await tx.card.findUniqueOrThrow({ where: { id: card.id }, select: { origin: true } })
  const fits = input.unit !== null && printoutFits(file, input.unit, timeZone)
  const adopted =
    row.origin !== "treffsicher"
      ? "notTreffsicher"
      : !fits
        ? "notFitting"
        : await adoptPrintoutValues(tx, { cardId: card.id, ownerId, file, printoutId })
  return { kind: "printoutUnitCard", cardId: card.id, fits, adopted }
}
