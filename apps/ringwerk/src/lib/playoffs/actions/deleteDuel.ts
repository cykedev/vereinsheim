"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import {
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  getNextRound,
} from "../calculatePlayoffs"
import { hasNextRoundDuels } from "./duelMutations"

/**
 * Löscht das letzte Duell einer Playoff-Paarung (inkl. Ergebnisse).
 * Nur möglich solange keine Folge-Runde angesetzt wurde.
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
          competitionId: true,
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

  // Löschen nur erlaubt wenn Folge-Runde noch keine Duelle hat
  if (!isFinal && (await hasNextRoundDuels(match))) {
    return {
      error: "Löschen nicht möglich — in der nächsten Runde wurden bereits Duelle gespielt.",
    }
  }

  // Siege-Korrektur wenn Duell bereits abgeschlossen war
  let deltaWinsA = 0
  let deltaWinsB = 0
  if (duel.isCompleted) {
    const oldResultA = duel.results.find((r) => r.participantId === match.participantAId)
    const oldResultB = duel.results.find((r) => r.participantId === match.participantBId)
    if (oldResultA && oldResultB) {
      let oldOutcome: "A" | "B" | "DRAW"
      if (isFinal) {
        oldOutcome = determineFinaleRoundWinner(
          oldResultA.totalRings.toNumber(),
          oldResultB.totalRings.toNumber()
        )
      } else {
        oldOutcome = determinePlayoffDuelWinner(
          oldResultA.ringteiler?.toNumber() ?? 0,
          oldResultA.totalRings.toNumber(),
          oldResultA.teiler?.toNumber() ?? 0,
          oldResultB.ringteiler?.toNumber() ?? 0,
          oldResultB.totalRings.toNumber(),
          oldResultB.teiler?.toNumber() ?? 0
        )
      }
      if (oldOutcome === "A") deltaWinsA = -1
      else if (oldOutcome === "B") deltaWinsB = -1
    }
  }
  // Note: deleteLastPlayoffDuel loads no competition ruleset — finale scoring mode fallback is fine

  await db.$transaction(async (tx) => {
    await tx.playoffDuelResult.deleteMany({ where: { duelId: duel.id } })
    await tx.playoffDuel.delete({ where: { id: duel.id } })
    await tx.playoffMatch.update({
      where: { id: match.id },
      data: {
        winsA: match.winsA + deltaWinsA,
        winsB: match.winsB + deltaWinsB,
        status: "PENDING",
      },
    })

    // Leere Folge-Runden-Matches kaskadenweise löschen
    if (!isFinal) {
      const nextRound = getNextRound(match.round)!
      const emptyNextMatches = await tx.playoffMatch.findMany({
        where: {
          competitionId: match.competitionId,
          round: nextRound,
          duels: { none: {} },
          OR: [
            { participantAId: match.participantAId },
            { participantAId: match.participantBId },
            { participantBId: match.participantAId },
            { participantBId: match.participantBId },
          ],
        },
        select: { id: true },
      })
      for (const m of emptyNextMatches) {
        await tx.playoffMatch.delete({ where: { id: m.id } })
      }
    }
  })

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
  await revalidatePublicSlugForCompetition(match.competitionId)
  return { success: true }
}
