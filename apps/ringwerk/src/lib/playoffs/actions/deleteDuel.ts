"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"
import { duelFactors } from "./duelOutcome"
import { playoffFailureMessage, removeLastDuel } from "./duelMutations"

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
      playoffMatch: {
        select: {
          id: true,
          round: true,
          competitionId: true,
          competition: {
            select: {
              disciplineId: true,
              discipline: { select: { scoringType: true, teilerFaktor: true } },
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
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const match = { ...duel.playoffMatch, factors: await duelFactors(duel.playoffMatch) }

  // Prüfungen (letztes Duell, Folge-Runde ohne Duelle), Siegstand und Folge-Runde in der Transaktion
  try {
    await removeLastDuel({
      duelId: duel.id,
      match,
      rules: {
        playoffBestOf: match.competition.playoffBestOf,
        finalePrimary: match.competition.finalePrimary,
        finaleTiebreaker1: match.competition.finaleTiebreaker1 ?? null,
        finaleTiebreaker2: match.competition.finaleTiebreaker2 ?? null,
      },
      audit: (deleted) => {
        const resultA = deleted.results.find((r) => r.participantId === match.participantAId)
        const resultB = deleted.results.find((r) => r.participantId === match.participantBId)
        return {
          eventType: "PLAYOFF_DUEL_DELETED",
          entityType: "PLAYOFF_DUEL",
          entityId: duel.id,
          userId: session.user.id,
          competitionId: match.competitionId,
          details: {
            duelId: duel.id,
            matchId: match.id,
            round: match.round,
            duelNumber: deleted.duelNumber,
            nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
            nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
            wasCompleted: deleted.isCompleted,
            totalRingsA: resultA?.totalRings.toNumber() ?? null,
            teilerA: resultA?.teiler?.toNumber() ?? null,
            totalRingsB: resultB?.totalRings.toNumber() ?? null,
            teilerB: resultB?.teiler?.toNumber() ?? null,
          },
        }
      },
    })
  } catch (error) {
    return { error: playoffFailureMessage(error, "Duell konnte nicht gelöscht werden.") }
  }

  // The playoffs route is refreshed client-side via router.refresh(); only the
  // public slug is revalidated here (a separate route, no refresh conflict).
  revalidatePublicPdf(match.competitionId)
  return { success: true }
}
