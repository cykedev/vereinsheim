import { db } from "@/lib/db"
import type { EventTeamItem } from "@/lib/eventTeams/types"

/** Alle Teams eines Event-Wettbewerbs mit ihren Mitgliedern — für Einschreibungs-UI. */
export async function getEventTeamsForCompetition(competitionId: string): Promise<EventTeamItem[]> {
  const rows = await db.eventTeam.findMany({
    where: { competitionId },
    select: {
      id: true,
      teamNumber: true,
      members: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          participantId: true,
          isGuest: true,
          participant: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { teamNumber: "asc" },
  })

  return rows.map((t) => ({
    id: t.id,
    teamNumber: t.teamNumber,
    members: t.members.map((m) => ({
      competitionParticipantId: m.id,
      participantId: m.participantId,
      firstName: m.participant.firstName,
      lastName: m.participant.lastName,
      isGuest: m.isGuest,
    })),
  }))
}
