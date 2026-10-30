// Scheiben, Ausdrucke und Belege der Übernahme aus Treffsicher schreiben ([[spiegel-account-transfer]]), in der
// Transaktion des Aufrufers. Den Schlüssel einer Scheibe gibt der Aufrufer; der Ergebnisteil kennt die Übernahme nicht.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { CardKind, Prisma } from "@/generated/prisma/client"

import { writeEnteredCardIn, type EnteredResult } from "../db/entered"
import type { DetailsInput } from "../entered/details"
import { attachEvidenceIn, type Attached } from "../evidence/attach"
import type { EvidenceType } from "../evidence/files"
import { importPrintoutIn, type ImportResult } from "../fetch-card/import"
import { newCardValues, ownCardOfEvening } from "../fetch-card/queries"
import { attachPrintout, markPrintoutValues } from "../printouts/queries"
import type { StoredPrintout } from "../printouts/store"
import { scoringReading } from "../printouts/values"
import { printoutFits } from "./printout-fit"

type Tx = Prisma.TransactionClient

/**
 * Eine Scheibe „aus Treffsicher“ über ihren Schlüssel anlegen oder ersetzen. Eine von Hand oder vom Ausdruck geänderte
 * (`notEditable`) oder eine im Papierkorb (`missing`) bleibt; der Aufrufer zählt sie als „geändert, bleibt“.
 */
export function writeTransferCard(
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
  return writeEnteredCardIn(tx, {
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
}

/**
 * Die Werte eines passenden Ausdrucks als neue Revision über den Zahlen aus Treffsicher: Die Scheibe wird „vom Ausdruck“
 * (`detailsWriter` erlaubt `treffsicher` → `pdf`), Revision 1 bleibt. Beginn und Art bleiben wie bei
 * `applyPrintoutValues`. Ein Ausdruck im Modus Probe gibt seine Schüsse als Wertung (`scoringReading`, wie in
 * `printoutFits`). Ohne Werte, die das Scheibenbild annimmt, nichts (`noValues`, der Ausdruck `inconsistent`).
 */
export type AdoptOutcome = "adopted" | "noValues" | Exclude<EnteredResult["kind"], "saved">

export async function adoptPrintoutValues(
  tx: Tx,
  input: { cardId: string; ownerId: string; file: StoredPrintout; printoutId: string }
): Promise<AdoptOutcome> {
  const card = await tx.card.findUniqueOrThrow({
    where: { id: input.cardId },
    select: {
      disciplineId: true,
      startedAt: true,
      kind: true,
      discipline: { select: { targetId: true } },
    },
  })
  const reading = input.file.values.reading
  const file =
    reading === null
      ? input.file
      : { ...input.file, values: { ...input.file.values, reading: scoringReading(reading) } }
  const values = newCardValues(file, card.discipline.targetId)
  if (!Object.keys(values.details).length) {
    if (values.inconsistent) await markPrintoutValues(tx, input.printoutId, "inconsistent")
    return "noValues"
  }
  const saved = await writeEnteredCardIn(tx, {
    cardId: input.cardId,
    ownerId: input.ownerId,
    origin: "pdf",
    disciplineId: card.disciplineId,
    startedAtMs: card.startedAt.getTime(),
    kind: card.kind,
    details: values.details,
    ...(values.stand === undefined ? {} : { stand: values.stand }),
    reason: "printout",
  })
  if (saved.kind === "invalid") await markPrintoutValues(tx, input.printoutId, "inconsistent")
  return saved.kind === "saved" ? "adopted" : saved.kind
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
 * (`printoutFits`); ohne `card` wie ein alter Ausdruck (`importPrintoutIn`). Ein Foto oder gewöhnliches PDF wird Beleg
 * an `card`.
 */
export async function placeAttachment(
  tx: Tx,
  input: {
    ownerId: string
    siteId: number
    timeZone: string
    /** die Scheibe der Einheit (neu, unsicher oder die erste passende); null ohne */
    card: { id: string } | null
    unit: {
      day: string
      scoring: "WHOLE" | "TENTH"
      shots: number
      total: { rings?: number | null; decimalTenths?: number | null } | null
    } | null
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
