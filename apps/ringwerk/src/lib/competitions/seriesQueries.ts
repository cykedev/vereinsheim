import { db } from "@/lib/db"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { EventSeriesItem, SeasonParticipantEntry, SeasonSeriesItem } from "@/lib/series/types"
import { getCompetitionById } from "./listQueries"

/** Event-Wettbewerb mit allen Serien (inkl. Teilnehmer + Disziplin) — für Rangliste. */
export async function getEventWithSeries(id: string): Promise<{
  competition: CompetitionDetail
  series: EventSeriesItem[]
} | null> {
  const competition = await getCompetitionById(id)
  if (!competition || competition.type !== "EVENT") return null

  const rows = await db.series.findMany({
    where: { competitionId: id },
    select: {
      id: true,
      participantId: true,
      competitionParticipantId: true,
      disciplineId: true,
      discipline: { select: { name: true, teilerFaktor: true, scoringType: true } }, // needed for per-series maxRings in rankEventParticipants
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          competitions: {
            where: { competitionId: id },
            select: { isGuest: true, status: true },
            take: 1,
          },
        },
      },
      // Team-Daten via direkte CP-Relation (neue Serien mit competitionParticipantId)
      competitionParticipant: {
        select: {
          isGuest: true,
          status: true,
          eventTeamId: true,
          eventTeam: { select: { teamNumber: true } },
        },
      },
      rings: true,
      teiler: true,
      ringteiler: true,
      shots: true,
      shotCount: true,
      sessionDate: true,
    },
    orderBy: { createdAt: "asc" },
  })

  // Serien von zurückgezogenen Teilnehmern ausschließen
  const activeRows = rows.filter((s) => {
    const cpStatus = s.competitionParticipant?.status
    if (cpStatus !== undefined) return cpStatus === "ACTIVE"
    return s.participant.competitions[0]?.status === "ACTIVE"
  })

  const series: EventSeriesItem[] = activeRows.map((s) => ({
    id: s.id,
    participantId: s.participantId,
    competitionParticipantId: s.competitionParticipantId,
    disciplineId: s.disciplineId,
    discipline: {
      name: s.discipline.name,
      teilerFaktor: s.discipline.teilerFaktor.toNumber(),
      scoringType: s.discipline.scoringType,
    },
    participant: {
      id: s.participant.id,
      firstName: s.participant.firstName,
      lastName: s.participant.lastName,
    },
    // CP-Relation hat Vorrang (neue Serien); Fallback auf alte Abfrage (bestehende Serien)
    isGuest: s.competitionParticipant?.isGuest ?? s.participant.competitions[0]?.isGuest ?? false,
    teamNumber: s.competitionParticipant?.eventTeam?.teamNumber ?? null,
    rings: s.rings.toNumber(),
    teiler: s.teiler.toNumber(),
    ringteiler: s.ringteiler.toNumber(),
    shots: Array.isArray(s.shots) ? (s.shots as string[]).map(Number) : [],
    shotCount: s.shotCount,
    sessionDate: s.sessionDate,
  }))

  return { competition, series }
}

/** Saison-Wettbewerb mit allen Teilnehmern und deren Serien — für Serien-Verwaltung und Rangliste. */
export async function getSeasonWithSeries(id: string): Promise<{
  competition: CompetitionDetail
  participants: SeasonParticipantEntry[]
} | null> {
  const competition = await getCompetitionById(id)
  if (!competition || competition.type !== "SEASON") return null

  const participants = await db.competitionParticipant.findMany({
    where: { competitionId: id, status: "ACTIVE" },
    select: {
      participantId: true,
      status: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true } },
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
  })

  const seriesRows = await db.series.findMany({
    where: { competitionId: id },
    select: {
      id: true,
      participantId: true,
      disciplineId: true,
      discipline: { select: { name: true, teilerFaktor: true, scoringType: true } },
      rings: true,
      teiler: true,
      ringteiler: true,
      shotCount: true,
      sessionDate: true,
    },
    orderBy: { sessionDate: "asc" },
  })

  // Serien nach Teilnehmer gruppieren
  const seriesByParticipant = new Map<string, SeasonSeriesItem[]>()
  for (const s of seriesRows) {
    const item: SeasonSeriesItem = {
      id: s.id,
      participantId: s.participantId,
      disciplineId: s.disciplineId,
      discipline: {
        name: s.discipline.name,
        teilerFaktor: s.discipline.teilerFaktor.toNumber(),
        scoringType: s.discipline.scoringType,
      },
      rings: s.rings.toNumber(),
      teiler: s.teiler.toNumber(),
      ringteiler: s.ringteiler.toNumber(),
      shotCount: s.shotCount,
      sessionDate: s.sessionDate,
    }
    const existing = seriesByParticipant.get(s.participantId) ?? []
    existing.push(item)
    seriesByParticipant.set(s.participantId, existing)
  }

  const result: SeasonParticipantEntry[] = participants.map((cp) => ({
    participantId: cp.participantId,
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    status: cp.status,
    disciplineId: cp.disciplineId,
    discipline: cp.discipline,
    series: seriesByParticipant.get(cp.participantId) ?? [],
  }))

  return { competition, participants: result }
}
