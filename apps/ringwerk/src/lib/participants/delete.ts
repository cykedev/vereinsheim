"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { revalidateParticipantPaths } from "./_shared"

export async function deleteParticipant(id: string, force: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }
  if (force && !isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }
  if (participant.isActive) return { error: "Nur inaktive Teilnehmer können gelöscht werden." }

  const competitionCount = await db.competitionParticipant.count({
    where: { participantId: id },
  })

  if (!force) {
    if (competitionCount > 0) {
      return {
        error: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich.",
      }
    }

    await db.participant.delete({ where: { id } })
    await db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_DELETED" satisfies AuditEventType,
        entityType: "PARTICIPANT",
        entityId: id,
        userId: session.user.id,
        details: { firstName: participant.firstName, lastName: participant.lastName },
      },
    })
    revalidateParticipantPaths()
    return { success: true }
  }

  // Force delete — cascade in transaction
  try {
    await db.$transaction(async (tx) => {
      // 1. Playoff-Struktur für diesen Teilnehmer
      const playoffMatches = await tx.playoffMatch.findMany({
        where: { OR: [{ participantAId: id }, { participantBId: id }] },
        select: { id: true },
      })
      const playoffMatchIds = playoffMatches.map((m) => m.id)

      if (playoffMatchIds.length > 0) {
        const playoffDuels = await tx.playoffDuel.findMany({
          where: { playoffMatchId: { in: playoffMatchIds } },
          select: { id: true },
        })
        const playoffDuelIds = playoffDuels.map((d) => d.id)

        if (playoffDuelIds.length > 0) {
          await tx.playoffDuelResult.deleteMany({ where: { duelId: { in: playoffDuelIds } } })
          await tx.playoffDuel.deleteMany({ where: { id: { in: playoffDuelIds } } })
        }
        await tx.playoffMatch.deleteMany({ where: { id: { in: playoffMatchIds } } })
      }

      // 2. Matchups + Serien beider Teilnehmer in diesen Paarungen
      const matchups = await tx.matchup.findMany({
        where: { OR: [{ homeParticipantId: id }, { awayParticipantId: id }] },
        select: { id: true },
      })
      const matchupIds = matchups.map((m) => m.id)

      if (matchupIds.length > 0) {
        await tx.series.deleteMany({ where: { matchupId: { in: matchupIds } } })
        await tx.matchup.deleteMany({ where: { id: { in: matchupIds } } })
      }

      // 3. Restliche Serien (Event/Saison — ohne matchupId)
      await tx.series.deleteMany({ where: { participantId: id } })

      // 4. Wettbewerbs-Einschreibungen
      await tx.competitionParticipant.deleteMany({ where: { participantId: id } })

      // 5. Teilnehmer + Audit-Eintrag
      await tx.participant.delete({ where: { id } })
      await tx.auditLog.create({
        data: {
          eventType: "PARTICIPANT_FORCE_DELETED" satisfies AuditEventType,
          entityType: "PARTICIPANT",
          entityId: id,
          userId: session.user.id,
          details: {
            firstName: participant.firstName,
            lastName: participant.lastName,
            competitions: competitionCount,
          },
        },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim endgültigen Löschen des Teilnehmers:", msg)
    return { error: "Teilnehmer konnte nicht gelöscht werden." }
  }

  revalidateParticipantPaths()
  return { success: true }
}
