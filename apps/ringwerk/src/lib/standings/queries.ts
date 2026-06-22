import { db } from "@/lib/db"
import { calculateStandings } from "./calculateStandings"
import type { StandingRow, StandingsMatchup, StandingsParticipant } from "./calculateStandings"
import { calculateBestOfStandings } from "./calculateBestOfStandings"
import type {
  BestOfStandingRow,
  BestOfStandingsMatchup,
  BestOfStandingsParticipant,
  BestOfStandingsSeries,
} from "./calculateBestOfStandings"

export type { StandingRow, BestOfStandingRow }

/** Berechnet und gibt die aktuelle Tabelle einer Meisterschaft zurück. */
export async function getStandingsForCompetition(competitionId: string): Promise<StandingRow[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { scoringMode: true },
  })
  const scoringMode = competition?.scoringMode ?? "RINGTEILER"

  const [enrollments, rawMatchups] = await Promise.all([
    db.competitionParticipant.findMany({
      where: { competitionId },
      select: {
        status: true,
        participant: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.matchup.findMany({
      where: { competitionId },
      select: {
        id: true,
        status: true,
        homeParticipantId: true,
        awayParticipantId: true,
        series: {
          select: {
            participantId: true,
            rings: true,
            teiler: true,
            ringteiler: true,
          },
        },
      },
    }),
  ])

  const participants: StandingsParticipant[] = enrollments.map((e) => ({
    id: e.participant.id,
    firstName: e.participant.firstName,
    lastName: e.participant.lastName,
    withdrawn: e.status === "WITHDRAWN",
  }))

  // Decimal-Felder in number umwandeln (Prisma 7 gibt Decimal-Objekte zurück)
  const matchups: StandingsMatchup[] = rawMatchups.map((m) => ({
    id: m.id,
    status: m.status,
    homeParticipantId: m.homeParticipantId,
    awayParticipantId: m.awayParticipantId,
    results: m.series.map((r) => ({
      participantId: r.participantId,
      rings: r.rings.toNumber(),
      teiler: r.teiler.toNumber(),
      ringteiler: r.ringteiler.toNumber(),
    })),
  }))

  return calculateStandings(participants, matchups, scoringMode)
}

/**
 * Berechnet und gibt die Best-of-Tabelle für eine BEST_OF_SINGLE-Liga zurück.
 * Lädt Teilnehmer, Paarungen mit Serien und Disziplinfaktor, mappt sie auf
 * die calculateBestOfStandings-Eingabetypen und gibt sortierte Zeilen zurück.
 */
export async function getBestOfStandingsForCompetition(
  competitionId: string
): Promise<BestOfStandingRow[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      scoringMode: true,
      disciplineId: true,
      groupBestOf: true,
      groupPlayAllDuels: true,
      groupTiebreaker1: true,
      groupTiebreaker2: true,
    },
  })
  if (!competition) return []

  const [enrollments, rawMatchups] = await Promise.all([
    db.competitionParticipant.findMany({
      where: { competitionId },
      select: {
        status: true,
        participant: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.matchup.findMany({
      where: { competitionId },
      select: {
        homeParticipantId: true,
        awayParticipantId: true,
        series: {
          select: {
            participantId: true,
            duelNumber: true,
            isTiebreak: true,
            rings: true,
            teiler: true,
            ringteiler: true,
            discipline: { select: { teilerFaktor: true } },
          },
        },
      },
    }),
  ])

  const participants: BestOfStandingsParticipant[] = enrollments.map((e) => ({
    id: e.participant.id,
    firstName: e.participant.firstName,
    lastName: e.participant.lastName,
    withdrawn: e.status === "WITHDRAWN",
  }))

  const matchups: BestOfStandingsMatchup[] = rawMatchups.map((m) => ({
    homeParticipantId: m.homeParticipantId,
    awayParticipantId: m.awayParticipantId,
    series: m.series
      // Only include series with a duelNumber — tiebreak series always have one too
      .filter((s): s is typeof s & { duelNumber: number } => s.duelNumber !== null)
      .map(
        (s): BestOfStandingsSeries => ({
          participantId: s.participantId,
          duelNumber: s.duelNumber,
          isTiebreak: s.isTiebreak,
          // Prisma 7 returns Decimal objects — convert to number for arithmetic
          rings: s.rings.toNumber(),
          teiler: s.teiler.toNumber(),
          ringteiler: s.ringteiler.toNumber(),
          teilerFaktor: s.discipline.teilerFaktor.toNumber(),
        })
      ),
  }))

  return calculateBestOfStandings(participants, matchups, {
    scoringMode: competition.scoringMode,
    bestOf: competition.groupBestOf ?? 3,
    playAll: competition.groupPlayAllDuels,
    tiebreaker1: competition.groupTiebreaker1,
    tiebreaker2: competition.groupTiebreaker2,
    competitionDisciplineId: competition.disciplineId,
  })
}
