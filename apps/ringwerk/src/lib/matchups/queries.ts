import { db } from "@/lib/db"
import type { MatchupListItem, MatchupParticipant, ScheduleStatus } from "./types"

// Rohtyp aus Prisma-Select (inkl. verschachteltem LP-Status und Disziplin)
type RawParticipant = {
  id: string
  firstName: string
  lastName: string
  competitions: Array<{
    status: string
    discipline: {
      scoringType: string
      teilerFaktor: { toNumber: () => number }
    } | null
  }>
}

function mapParticipant(p: RawParticipant): MatchupParticipant {
  const cp = p.competitions[0]
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    withdrawn: cp?.status === "WITHDRAWN",
    scoringType: (cp?.discipline?.scoringType as MatchupParticipant["scoringType"]) ?? null,
    teilerFaktor: cp?.discipline?.teilerFaktor?.toNumber() ?? null,
  }
}

function participantSelect(competitionId: string) {
  return {
    id: true,
    firstName: true,
    lastName: true,
    competitions: {
      where: { competitionId },
      select: {
        status: true,
        discipline: { select: { scoringType: true, teilerFaktor: true } },
      },
    },
  } as const
}

export async function getMatchupsForCompetition(competitionId: string): Promise<MatchupListItem[]> {
  const rows = await db.matchup.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      roundIndex: true,
      status: true,
      dueDate: true,
      homeParticipant: { select: participantSelect(competitionId) },
      awayParticipant: { select: participantSelect(competitionId) },
      series: {
        select: {
          participantId: true,
          rings: true,
          teiler: true,
          ringteiler: true,
          duelNumber: true,
          isTiebreak: true,
        },
      },
    },
    orderBy: [{ round: "asc" }, { roundIndex: "asc" }, { homeParticipant: { lastName: "asc" } }],
  })

  return rows.map((row) => ({
    id: row.id,
    round: row.round,
    roundIndex: row.roundIndex,
    status: row.status,
    dueDate: row.dueDate,
    homeParticipant: mapParticipant(row.homeParticipant),
    awayParticipant: row.awayParticipant ? mapParticipant(row.awayParticipant) : null,
    // Decimal-Felder in number umwandeln (Prisma 7)
    results: row.series.map((r) => ({
      participantId: r.participantId,
      rings: r.rings.toNumber(),
      teiler: r.teiler.toNumber(),
      ringteiler: r.ringteiler.toNumber(),
      duelNumber: r.duelNumber,
      isTiebreak: r.isTiebreak,
    })),
  }))
}

export async function getScheduleStatus(competitionId: string): Promise<ScheduleStatus> {
  const [total, completed] = await Promise.all([
    db.matchup.count({ where: { competitionId } }),
    db.matchup.count({ where: { competitionId, status: "COMPLETED" } }),
  ])

  return {
    hasSchedule: total > 0,
    hasCompletedMatchups: completed > 0,
    totalMatchups: total,
  }
}
