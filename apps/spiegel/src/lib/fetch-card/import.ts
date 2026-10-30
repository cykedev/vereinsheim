// Alte Ausdrucke einlesen ([[meyton-printout]] „Alte Ausdrucke einlesen“): derselbe Weg wie ein hochgeladenes PDF, nur
// ohne Auftrag an die Brücke (alte Abende) und ohne Frage im Blatt. Die eigene Scheibe des Abends bekommt den Ausdruck
// (und an einer Scheibe vom Ausdruck seine Werte); sonst entsteht eine Scheibe vom Ausdruck mit der Disziplin aus dem
// Kopf, wenn genau eine wählbare so heißt. Eine Transaktion je Ausdruck unter der Sperre der Kontozeile wie `fetchCard`.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import type { Prisma } from "@/generated/prisma/client"

import type { Db } from "../db"
import { writeEnteredCardIn } from "../db/entered"
import { lockCard } from "../db/purge"
import { applyPrintoutValues } from "../printouts/apply"
import { attachPrintout, markPrintoutValues } from "../printouts/queries"
import type { StoredPrintout } from "../printouts/store"
import { headerDisciplineId, newCardValues, ownCardOfEvening } from "./queries"

export type ImportResult =
  /** an die eigene Scheibe des Abends gehängt; `values`: sie hat danach Werte (Rohdaten oder Ausdruck) */
  | { kind: "attached"; cardId: string; values: boolean }
  /** neue Scheibe vom Ausdruck; `values`: mit seinen Werten */
  | { kind: "created"; cardId: string; values: boolean }
  /** die eigene Scheibe liegt im Papierkorb: nichts geändert */
  | { kind: "trashed" }
  /** die Scheibe des Abends gehört einem anderen Konto */
  | { kind: "taken" }
  /** ein Grabstein oder eine Löschsperre (auch die eigene) an diesem Abend */
  | { kind: "blocked" }
  /** keine wählbare Disziplin heißt wie der Kopf des Ausdrucks */
  | { kind: "noDiscipline" }

/** bricht einen Probelauf ab: Die Transaktion rollt zurück, das Ergebnis bleibt */
class DryRun extends Error {
  constructor(readonly result: ImportResult) {
    super("Probelauf")
    this.name = "DryRun"
  }
}

export async function importPrintout(
  db: Db,
  input: { userId: string; siteId: number; file: StoredPrintout; dryRun?: boolean }
): Promise<ImportResult> {
  try {
    return await db.$transaction(async (tx) => {
      const result = await importPrintoutIn(tx, input)
      if (input.dryRun) throw new DryRun(result)
      return result
    })
  } catch (error) {
    if (error instanceof DryRun) return error.result
    throw error
  }
}

/**
 * Einen Ausdruck in der Transaktion des Aufrufers einlesen (auch für die Übernahme aus Treffsicher), unter der Sperre der
 * Kontozeile
 */
export async function importPrintoutIn(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    siteId: number
    file: StoredPrintout
    /** die Disziplin, wenn der Kopf des Ausdrucks keine bekannte nennt (die Übernahme kennt sie aus Treffsicher) */
    fallbackDisciplineId?: number | null
  }
): Promise<ImportResult> {
  const { userId, siteId, file } = input
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR NO KEY UPDATE`
  const { timeZone } = await tx.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { timeZone: true },
  })
  const day = eveningDay(file.printedAt.getTime(), timeZone)
  const sameEvening = (at: Date) => eveningDay(at.getTime(), timeZone) === day
  const { own, bridgeCards } = await ownCardOfEvening(tx, {
    userId,
    siteId,
    scheibenId: file.scheibenId,
    day,
    timeZone,
  })

  if (own) {
    const card = (await lockCard(tx, own.id))
      ? await tx.card.findFirst({
          where: { id: own.id, ownerId: userId },
          select: { id: true, origin: true, sourceId: true, deletedAt: true },
        })
      : null
    if (!card) throw new Error("Scheibe während des Einlesens entfernt")
    if (card.deletedAt) return { kind: "trashed" }
    await attachPrintout(tx, file, card.id)
    if (card.origin === "pdf" && card.sourceId === null) {
      const applied = await applyPrintoutValues(tx, card.id)
      return { kind: "attached", cardId: card.id, values: applied === "taken" }
    }
    return { kind: "attached", cardId: card.id, values: true }
  }

  if (bridgeCards.length) return { kind: "taken" }
  const blockedWhere = { source: { siteId }, scheibenId: file.scheibenId }
  // nacheinander: eine interaktive Transaktion hat eine Verbindung
  const tombstones = await tx.tombstone.findMany({
    where: blockedWhere,
    select: { startedAt: true },
  })
  const locks = await tx.deleteLock.findMany({
    where: blockedWhere,
    select: { startedAt: true },
  })
  if ([...tombstones, ...locks].some((row) => sameEvening(row.startedAt)))
    return { kind: "blocked" }

  const disciplineId =
    (await headerDisciplineId(tx, {
      siteId,
      name: file.values.discipline,
    })) ??
    input.fallbackDisciplineId ??
    null
  if (disciplineId === null) return { kind: "noDiscipline" }
  const discipline = await tx.discipline.findUniqueOrThrow({
    where: { id: disciplineId },
    select: { targetId: true },
  })
  const values = newCardValues(file, discipline.targetId)
  const write = (withValues: boolean) =>
    writeEnteredCardIn(tx, {
      ownerId: userId,
      origin: "pdf",
      disciplineId,
      startedAtMs: file.printedAt.getTime(),
      kind: "training",
      kindChoice: "training",
      details: withValues ? values.details : {},
      ...(withValues && values.stand !== undefined ? { stand: values.stand } : {}),
      reason: "printout",
    })
  const tried = Object.keys(values.details).length > 0
  let saved = await write(tried)
  const refused = tried && saved.kind === "invalid"
  if (refused) saved = await write(false)
  if (saved.kind !== "saved") throw new Error(`Scheibe vom Ausdruck: ${saved.kind}`)
  const printoutId = await attachPrintout(tx, file, saved.cardId)
  if (values.inconsistent || refused) await markPrintoutValues(tx, printoutId, "inconsistent")
  return { kind: "created", cardId: saved.cardId, values: tried && !refused }
}
