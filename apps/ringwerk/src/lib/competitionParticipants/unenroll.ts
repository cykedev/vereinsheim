"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { revalidateCompetitionParticipantPaths } from "./_shared"

export async function unenrollParticipant(competitionParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      isGuest: true,
      eventTeamId: true,
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }

  const matchupCount = await db.matchup.count({
    where: {
      competitionId: cp.competitionId,
      OR: [{ homeParticipantId: cp.participantId }, { awayParticipantId: cp.participantId }],
    },
  })
  if (matchupCount > 0) {
    return {
      error:
        "Teilnehmer kann nicht entfernt werden — es existieren bereits Paarungen. Bitte Rückzug verwenden.",
    }
  }

  if (cp.isGuest) {
    // Gast: Serien + Einschreibung + stiller Participant-Record löschen
    await db.$transaction(async (tx) => {
      await tx.series.deleteMany({
        where: { participantId: cp.participantId, competitionId: cp.competitionId },
      })
      await tx.competitionParticipant.delete({ where: { id: competitionParticipantId } })
      await tx.participant.delete({ where: { id: cp.participantId } })
      // Leeres Team aufräumen
      if (cp.eventTeamId) {
        const remaining = await tx.competitionParticipant.count({
          where: { eventTeamId: cp.eventTeamId },
        })
        if (remaining === 0) {
          await tx.eventTeam.delete({ where: { id: cp.eventTeamId } })
        }
      }
    })
  } else if (cp.eventTeamId) {
    // Team-Mitglied: Löschen + leeres Team aufräumen in einer Transaktion
    await db.$transaction(async (tx) => {
      await tx.competitionParticipant.delete({ where: { id: competitionParticipantId } })
      const remaining = await tx.competitionParticipant.count({
        where: { eventTeamId: cp.eventTeamId },
      })
      if (remaining === 0) {
        await tx.eventTeam.delete({ where: { id: cp.eventTeamId! } })
      }
    })
  } else {
    // Einzel-Einschreibung: direktes Löschen ohne Transaktion
    await db.competitionParticipant.delete({ where: { id: competitionParticipantId } })
  }

  await revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}
