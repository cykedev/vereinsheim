import { db } from "@/lib/db"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"

/** Alle Einschreibungen eines Wettbewerbs — ACTIVE zuerst, dann WITHDRAWN. */
export async function getCompetitionParticipants(
  competitionId: string
): Promise<CompetitionParticipantListItem[]> {
  const rows = await db.competitionParticipant.findMany({
    where: { competitionId },
    select: {
      id: true,
      competitionId: true,
      status: true,
      startNumber: true,
      withdrawnAt: true,
      isGuest: true,
      disciplineId: true,
      discipline: {
        select: { id: true, name: true, scoringType: true, teilerFaktor: true },
      },
      participant: {
        select: { id: true, firstName: true, lastName: true, contact: true },
      },
      eventTeam: { select: { teamNumber: true } },
      _count: { select: { series: true } },
    },
    orderBy: [
      { status: "asc" },
      { eventTeam: { teamNumber: "asc" } },
      { participant: { lastName: "asc" } },
    ],
  })
  return rows.map((r) => ({
    ...r,
    discipline: r.discipline
      ? { ...r.discipline, teilerFaktor: r.discipline.teilerFaktor.toNumber() }
      : null,
    teamNumber: r.eventTeam?.teamNumber ?? null,
    seriesCount: r._count.series,
  })) as unknown as CompetitionParticipantListItem[]
}
