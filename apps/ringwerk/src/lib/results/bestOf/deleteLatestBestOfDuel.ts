"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import { loadMatchup } from "./shared"

/**
 * Removes the highest-duelNumber series pair from a BEST_OF_SINGLE matchup and
 * resets its status to PENDING.
 *
 * This covers both regular duels and Stechschuss rounds; the distinction is
 * captured in the AuditLog details. There are no downstream playoff rounds
 * branching from group-phase matchups, so no cascade check is needed.
 */
export async function deleteLatestBestOfDuel(matchupId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }

  if (matchup.series.length === 0) {
    return { error: "Keine Serien vorhanden." }
  }

  const maxDuelNumber = matchup.series.reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  if (maxDuelNumber === 0) {
    return { error: "Keine Serien mit Duell-Nummer vorhanden." }
  }

  const latestSeries = matchup.series.filter((s) => s.duelNumber === maxDuelNumber)
  const isTiebreakDeletion = latestSeries.some((s) => s.isTiebreak)

  try {
    await db.$transaction(async (tx) => {
      await tx.series.deleteMany({
        where: { matchupId, duelNumber: maxDuelNumber },
      })

      // Always reset to PENDING so the UI prompts for re-entry.
      await tx.matchup.update({
        where: { id: matchupId },
        data: { status: "PENDING" },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Löschen des Best-of-Duells:", msg)
    return { error: "Duell konnte nicht gelöscht werden." }
  }

  await db.auditLog.create({
    data: {
      // RESULT_CORRECTED is the closest existing event for a destructive correction.
      eventType: "RESULT_CORRECTED",
      entityType: "MATCHUP",
      entityId: matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        deletedDuelNumber: maxDuelNumber,
        isTiebreak: isTiebreakDeletion,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        awayName: `${matchup.awayParticipant?.firstName} ${matchup.awayParticipant?.lastName}`,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}
