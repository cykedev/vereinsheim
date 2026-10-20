"use server"

import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { isConflict, serializable } from "@/lib/serializable"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { revalidateCompetitionParticipantPaths } from "./_shared"

export async function unenrollParticipant(competitionParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  // Lesen, Prüfen, Löschen und Protokoll in einer Transaktion. Ein Mitglied mit Paarungen oder Ergebnissen lässt sich
  // nur zurückziehen: Die Einschreibung zu löschen ließe seine Serien ohne Einschreibung zurück. Ein Gast geht mit
  // seinen Ergebnissen.
  let competitionId: string | null = null
  let result: ActionResult
  try {
    result = await serializable(async (tx): Promise<ActionResult> => {
      const cp = await tx.competitionParticipant.findUnique({
        where: { id: competitionParticipantId },
        select: {
          id: true,
          competitionId: true,
          participantId: true,
          isGuest: true,
          eventTeamId: true,
          participant: { select: { firstName: true, lastName: true } },
        },
      })
      if (!cp) return { error: "Einschreibung nicht gefunden." }
      competitionId = cp.competitionId

      const matchupCount = await tx.matchup.count({
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
        await tx.series.deleteMany({
          where: { participantId: cp.participantId, competitionId: cp.competitionId },
        })
        await tx.competitionParticipant.delete({ where: { id: competitionParticipantId } })
        await tx.participant.delete({ where: { id: cp.participantId } })
      } else {
        // Serien dieser Einschreibung und alte ohne Verweis auf eine; in einem Team-Event kann dasselbe Mitglied in
        // mehreren Teams stehen, dessen andere Einschreibungen zählen nicht
        const results = await tx.series.count({
          where: {
            participantId: cp.participantId,
            competitionId: cp.competitionId,
            OR: [{ competitionParticipantId }, { competitionParticipantId: null }],
          },
        })
        if (results > 0) {
          return {
            error:
              "Teilnehmer hat schon Ergebnisse und kann nicht entfernt werden. Bitte zurückziehen.",
          }
        }
        await tx.competitionParticipant.delete({ where: { id: competitionParticipantId } })
      }

      await tx.auditLog.create({
        data: {
          eventType: "PARTICIPANT_UNENROLLED" satisfies AuditEventType,
          entityType: "COMPETITION_PARTICIPANT",
          entityId: competitionParticipantId,
          userId: session.user.id,
          competitionId: cp.competitionId,
          details: {
            participantId: cp.participantId,
            name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
            isGuest: cp.isGuest,
          },
        },
      })

      // Leeres Team aufräumen
      if (cp.eventTeamId) {
        const remaining = await tx.competitionParticipant.count({
          where: { eventTeamId: cp.eventTeamId },
        })
        if (remaining === 0) {
          await tx.eventTeam.delete({ where: { id: cp.eventTeamId } })
        }
      }
      return { success: true }
    })
  } catch (error) {
    if (isConflict(error)) {
      return {
        error:
          "Die Daten wurden gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.",
      }
    }
    console.error("Entfernen aus dem Wettbewerb fehlgeschlagen:", error)
    return { error: "Teilnehmer konnte nicht entfernt werden. Bitte erneut versuchen." }
  }

  if ("success" in result && competitionId) revalidateCompetitionParticipantPaths(competitionId)
  return result
}
