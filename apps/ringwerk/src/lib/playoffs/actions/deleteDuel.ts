"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"
import { isPlayoffMatchComplete, requiredWinsFromBestOf } from "../calculatePlayoffs"
import { storedDuelOutcome } from "./duelOutcome"
import {
  deleteNextRound,
  hasNextRoundDuels,
  matchWinner,
  NEXT_ROUND_LOCKED,
  NextRoundLockedError,
} from "./duelMutations"

/**
 * Löscht das letzte Duell einer Playoff-Paarung (inkl. Ergebnisse).
 * Nur möglich, solange in der nächsten Runde kein Duell angelegt ist.
 */
export async function deleteLastPlayoffDuel(duelId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const duel = await db.playoffDuel.findUnique({
    where: { id: duelId },
    select: {
      id: true,
      duelNumber: true,
      isCompleted: true,
      playoffMatch: {
        select: {
          id: true,
          round: true,
          winsA: true,
          winsB: true,
          status: true,
          competitionId: true,
          competition: {
            select: {
              playoffBestOf: true,
              finalePrimary: true,
              finaleTiebreaker1: true,
              finaleTiebreaker2: true,
            },
          },
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
        },
      },
      results: {
        select: {
          participantId: true,
          totalRings: true,
          teiler: true,
          ringteiler: true,
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"

  // Muss das letzte Duell sein
  const maxDuelNumber = await db.playoffDuel.aggregate({
    where: { playoffMatchId: match.id },
    _max: { duelNumber: true },
  })
  if (duel.duelNumber !== maxDuelNumber._max.duelNumber) {
    return { error: "Nur das letzte Duell kann gelöscht werden." }
  }

  // Siege-Korrektur wenn Duell bereits abgeschlossen war: derselbe Ausgang, mit dem es gezählt wurde (im Finale samt
  // Stichkriterien)
  let deltaWinsA = 0
  let deltaWinsB = 0
  if (duel.isCompleted) {
    const oldResultA = duel.results.find((r) => r.participantId === match.participantAId)
    const oldResultB = duel.results.find((r) => r.participantId === match.participantBId)
    if (oldResultA && oldResultB) {
      const { finalePrimary, finaleTiebreaker1, finaleTiebreaker2 } = match.competition
      const oldOutcome = storedDuelOutcome(
        oldResultA,
        oldResultB,
        isFinal,
        finalePrimary,
        finaleTiebreaker1 ?? null,
        finaleTiebreaker2 ?? null
      )
      if (oldOutcome === "A") deltaWinsA = -1
      else if (oldOutcome === "B") deltaWinsB = -1
    }
  }

  // Ohne das Duell entscheiden die übrigen Siege; ändert sich der Ausgang, gilt die Folge-Runde nicht mehr
  const newWinsA = match.winsA + deltaWinsA
  const newWinsB = match.winsB + deltaWinsB
  const requiredWins = requiredWinsFromBestOf(match.competition.playoffBestOf)
  const complete = isPlayoffMatchComplete(newWinsA, newWinsB, match.round, requiredWins)
  const outcomeChanged =
    matchWinner(match, match.winsA, match.winsB, match.status === "COMPLETED") !==
    matchWinner(match, newWinsA, newWinsB, complete)

  try {
    await db.$transaction(
      async (tx) => {
        // Löschen nur erlaubt, solange die Folge-Runde keine Duelle hat (in derselben Transaktion wie das Entfernen)
        if (!isFinal && (await hasNextRoundDuels(match, tx))) throw new NextRoundLockedError()
        await tx.playoffDuelResult.deleteMany({ where: { duelId: duel.id } })
        await tx.playoffDuel.delete({ where: { id: duel.id } })
        await tx.playoffMatch.update({
          where: { id: match.id },
          data: { winsA: newWinsA, winsB: newWinsB, status: complete ? "COMPLETED" : "PENDING" },
        })
        if (!isFinal && outcomeChanged) await deleteNextRound(match, tx)
      },
      { isolationLevel: "Serializable" }
    )
  } catch (error) {
    if (error instanceof NextRoundLockedError) return { error: `Löschen ${NEXT_ROUND_LOCKED}` }
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Löschen des Playoff-Duells:", msg)
    return { error: "Duell konnte nicht gelöscht werden." }
  }

  const deletedResultA = duel.results.find((r) => r.participantId === match.participantAId)
  const deletedResultB = duel.results.find((r) => r.participantId === match.participantBId)

  await db.auditLog.create({
    data: {
      eventType: "PLAYOFF_DUEL_DELETED",
      entityType: "PLAYOFF_DUEL",
      entityId: duel.id,
      userId: session.user.id,
      competitionId: match.competitionId,
      details: {
        duelId: duel.id,
        matchId: match.id,
        round: match.round,
        duelNumber: duel.duelNumber,
        nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
        nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
        wasCompleted: duel.isCompleted,
        totalRingsA: deletedResultA?.totalRings.toNumber() ?? null,
        teilerA: deletedResultA?.teiler?.toNumber() ?? null,
        totalRingsB: deletedResultB?.totalRings.toNumber() ?? null,
        teilerB: deletedResultB?.teiler?.toNumber() ?? null,
      },
    },
  })

  // The playoffs route is refreshed client-side via router.refresh(); only the
  // public slug is revalidated here (a separate route, no refresh conflict).
  revalidatePublicPdf(match.competitionId)
  return { success: true }
}
