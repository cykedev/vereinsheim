// Ausdruck und Scheibe aus Treffsicher ([[spiegel-account-transfer]] „Später geholter Ausdruck“): Passt ein
// Meyton-Ausdruck zu einer übernommenen Scheibe, werden seine Werte eine neue Revision über den Zahlen aus Treffsicher,
// sonst hängt er ohne Werte an. Dieselbe Regel gilt in der Übernahme (Ausdruck an der Einheit) und für einen Ausdruck,
// den der Schütze später holt (`fetchCard`, `importPrintoutIn`): Dann sucht Spiegel die passende Scheibe des Abends,
// statt eine zweite anzulegen.

import { zonedDayStartMs } from "@vereinsheim/lib/format"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { Prisma } from "@/generated/prisma/client"

import { writeEnteredCardIn, type EnteredResult } from "../db/entered"
import { lockCard } from "../db/purge"
import { attachPrintout, markPrintoutValues } from "../printouts/queries"
import type { PrintoutValuesRead, StoredPrintout } from "../printouts/store"
import { scoringReading } from "../printouts/values"
import { newCardValues } from "./queries"

type Tx = Prisma.TransactionClient

/** eine Scheibe aus Treffsicher, wie `printoutFits` sie vergleicht */
export interface TransferredUnit {
  day: string
  scoring: "WHOLE" | "TENTH"
  shots: number
  total: { rings?: number | null; decimalTenths?: number | null } | null
}

/**
 * Die Lesung ist `ok`, der Abend des Drucks ist der Abend der Einheit, die Zahl der Schüsse ist gleich und das
 * Gesamtergebnis gleich in der Wertung von Treffsicher (`WHOLE`: ganze Ringe, `TENTH`: Zehntel). Ein Ausdruck im Modus
 * Probe zählt als Wertung, sein Ergebnis ist die Summe seiner Schüsse (`scoringReading`). Ohne Gesamtergebnis in
 * Treffsicher passt kein Ausdruck. Seriensummen vergleicht die Regel nicht.
 */
export function printoutFits(
  printout: { printedAt: Date; values: Pick<PrintoutValuesRead, "status" | "reading"> },
  unit: TransferredUnit,
  timeZone: string
): boolean {
  const read = printout.values.reading
  if (printout.values.status !== "ok" || read === null) return false
  const reading = scoringReading(read)
  if (!reading.total) return false
  if (eveningDay(printout.printedAt.getTime(), timeZone) !== unit.day) return false
  if (reading.shots.length !== unit.shots) return false
  const wanted = unit.scoring === "WHOLE" ? unit.total?.rings : unit.total?.decimalTenths
  const printed = unit.scoring === "WHOLE" ? reading.total.rings : reading.total.decimalTenths
  return wanted !== undefined && wanted !== null && wanted === printed
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

const TRANSFERRED = { origin: "treffsicher", deletedAt: null, sourceId: null } as const

/** keine, genau eine oder mehrere Scheiben aus Treffsicher passen; bei mehreren rät Spiegel nicht */
export type TransferredFit =
  { kind: "none" } | { kind: "one"; cardId: string } | { kind: "several" }

/**
 * Die Scheiben aus Treffsicher des Kontos an diesem Abend (nicht im Papierkorb, ohne Brücke), zu denen der Ausdruck passt
 * (`printoutFits`). Wertung und Schusszahl kommen aus der aktuellen Revision: Zehntel, wenn sie ein Gesamtergebnis in
 * Zehnteln hat, sonst ganze Ringe; ohne Schusszahl passt keine.
 */
export async function transferredCardsFitting(
  tx: Tx,
  input: { userId: string; day: string; timeZone: string; file: StoredPrintout }
): Promise<TransferredFit> {
  const { userId, day, timeZone, file } = input
  // der Abend beginnt um 4 Uhr und endet am nächsten Morgen: zwei Tage ab Mitternacht fassen ihn, `eveningDay` grenzt
  const from = zonedDayStartMs(day, timeZone)
  const rows = await tx.card.findMany({
    where: {
      ownerId: userId,
      ...TRANSFERRED,
      startedAt: { gte: new Date(from), lt: new Date(from + 2 * 86_400_000) },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      startedAt: true,
      currentRevision: {
        select: { totalShots: true, totalRings: true, totalDecimalTenths: true },
      },
    },
  })
  const fitting = rows.filter((card) => {
    const revision = card.currentRevision
    if (eveningDay(card.startedAt.getTime(), timeZone) !== day) return false
    if (!revision || revision.totalShots === null) return false
    return printoutFits(
      file,
      {
        day,
        scoring: revision.totalDecimalTenths === null ? "WHOLE" : "TENTH",
        shots: revision.totalShots,
        total: { rings: revision.totalRings, decimalTenths: revision.totalDecimalTenths },
      },
      timeZone
    )
  })
  if (fitting.length === 0) return { kind: "none" }
  return fitting.length === 1 ? { kind: "one", cardId: fitting[0].id } : { kind: "several" }
}

/**
 * Den Ausdruck an die passende Scheibe aus Treffsicher hängen und seine Werte übernehmen (`adoptPrintoutValues`), unter
 * der Sperre der Scheibe. Die Scheibe behält ihre ID. `values`: Seine Werte gelten jetzt; sonst hängt er ohne an.
 */
export async function adoptIntoTransferred(
  tx: Tx,
  input: { cardId: string; ownerId: string; file: StoredPrintout }
): Promise<{ values: boolean }> {
  const { cardId, ownerId, file } = input
  // Löschen ändert die Scheibe unter ihrer Sperre: erst danach prüfen, ob sie noch eine aus Treffsicher ist
  const card = (await lockCard(tx, cardId))
    ? await tx.card.findFirst({
        where: { id: cardId, ownerId, ...TRANSFERRED },
        select: { id: true },
      })
    : null
  if (!card) throw new Error("Scheibe aus Treffsicher während des Holens geändert")
  const printoutId = await attachPrintout(tx, file, cardId)
  const adopted = await adoptPrintoutValues(tx, { cardId, ownerId, file, printoutId })
  return { values: adopted === "adopted" }
}
