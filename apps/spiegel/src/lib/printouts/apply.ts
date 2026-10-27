// Die Werte eines Ausdrucks an seine Scheibe ([[meyton-printout]] „Werte lesen“): Unter den Ausdrucken einer Scheibe vom
// Ausdruck ohne Brücke gibt der zuletzt gedruckte mit gespeicherter Lesung die Angaben (`readingOrder`); passt seine
// Lesung nicht zur Disziplin (Scheibenbild, Schusszahl), ist er `inconsistent`, behält die Lesung, und der nächste kommt
// dran. Geschrieben wird über `writeEnteredCardIn` (Herkunft `pdf`): gleiche Angaben ändern nichts, andere sind eine neue
// Revision. Ändert sich die Disziplin, ruft `recomputeDisciplineCard` dies erneut.

import type { PrintoutReading } from "@vereinsheim/meyton-pdf/reading"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"

import type { Prisma } from "@/generated/prisma/client"

import { writeEnteredCardIn } from "../db/entered"
import { lockCard } from "../db/purge"
import { markPrintoutValues } from "./queries"
import { detailsFromReading, readingOrder } from "./values"

type Tx = Prisma.TransactionClient

/** `taken`: Werte vom Ausdruck geschrieben; `none`: kein Ausdruck gibt Werte; `skipped`: keine Scheibe vom Ausdruck */
export type ApplyOutcome = "taken" | "none" | "skipped"

const targetIdOf = (value: string | null): TargetId | null =>
  value !== null && Object.hasOwn(TARGETS, value) ? (value as TargetId) : null

/**
 * Wendet die Werte der Ausdrucke einer Scheibe an, in der Transaktion des Aufrufers und unter der Sperre ihrer Zeile.
 * Nur an einer eigenen, sichtbaren Scheibe vom Ausdruck ohne Brücke (nicht wartend, nicht im Papierkorb). Gibt keiner
 * Werte, die Scheibe hat aber welche, bekommt sie eine Revision ohne Angaben.
 */
export async function applyPrintoutValues(tx: Tx, cardId: string): Promise<ApplyOutcome> {
  if (!(await lockCard(tx, cardId))) return "skipped"
  const card = await tx.card.findUnique({
    where: { id: cardId },
    select: {
      ownerId: true,
      origin: true,
      sourceId: true,
      deletedAt: true,
      ownerPending: true,
      disciplineId: true,
      startedAt: true,
      kind: true,
      discipline: { select: { targetId: true } },
      currentRevision: {
        select: {
          totalShots: true,
          _count: { select: { shots: true, seriesSums: true } },
        },
      },
      printouts: {
        select: {
          id: true,
          valuesStatus: true,
          reading: true,
          printedAt: true,
          storedAt: true,
        },
      },
    },
  })
  if (
    !card ||
    card.ownerId === null ||
    card.origin !== "pdf" ||
    card.sourceId !== null ||
    card.deletedAt !== null ||
    card.ownerPending
  )
    return "skipped"
  const ownerId = card.ownerId

  const write = (
    details: Parameters<typeof writeEnteredCardIn>[1]["details"],
    stand?: string | null
  ) =>
    writeEnteredCardIn(tx, {
      cardId,
      ownerId,
      origin: "pdf",
      disciplineId: card.disciplineId,
      startedAtMs: card.startedAt.getTime(),
      kind: card.kind,
      details,
      ...(stand === undefined ? {} : { stand }),
      reason: "printout",
    })

  const targetId = targetIdOf(card.discipline.targetId)
  for (const printout of readingOrder(card.printouts)) {
    const result = detailsFromReading(printout.reading as unknown as PrintoutReading, targetId)
    if (!result.ok) {
      if (printout.valuesStatus !== "inconsistent")
        await markPrintoutValues(tx, printout.id, "inconsistent")
      continue
    }
    const saved = await write(result.details, result.stand)
    if (saved.kind === "saved") {
      if (printout.valuesStatus !== "ok") await markPrintoutValues(tx, printout.id, "ok")
      return "taken"
    }
    await markPrintoutValues(tx, printout.id, "inconsistent")
  }

  const revision = card.currentRevision
  const hasValues =
    revision !== null &&
    (revision._count.shots > 0 || revision._count.seriesSums > 0 || revision.totalShots !== null)
  if (hasValues) await write({}, null)
  return "none"
}
