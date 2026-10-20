import { db } from "@/lib/db"
import {
  getBestOfStandingsForCompetition,
  getStandingsForCompetition,
} from "@/lib/standings/queries"
import { getNextRound } from "./calculatePlayoffs"
import { storedDuelOutcome, type DuelFactors } from "./actions/duelOutcome"
import { involvesWithdrawn } from "@/lib/standings/withdrawn"
import type { SeedingRow } from "./bracketSeeding"
import type { ScoringMode } from "@/generated/prisma/client"
import type { PlayoffBracketData, PlayoffDuelItem, PlayoffMatchItem, PlayoffRound } from "./types"

/** Regeln des Finales, nach denen ein Duell zählt */
interface FinaleRules {
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}

function mapDuelItem(
  duel: {
    id: string
    duelNumber: number
    isSuddenDeath: boolean
    isCompleted: boolean
    results: {
      participantId: string
      totalRings: { toNumber: () => number }
      teiler: { toNumber: () => number } | null
      ringteiler: { toNumber: () => number } | null
    }[]
  },
  participantAId: string,
  participantBId: string,
  round: PlayoffRound,
  rules: FinaleRules,
  factors: DuelFactors
): PlayoffDuelItem {
  const rawA = duel.results.find((r) => r.participantId === participantAId)
  const rawB = duel.results.find((r) => r.participantId === participantBId)

  const resultA = rawA
    ? {
        totalRings: rawA.totalRings.toNumber(),
        teiler: rawA.teiler?.toNumber() ?? null,
        ringteiler: rawA.ringteiler?.toNumber() ?? null,
      }
    : null

  const resultB = rawB
    ? {
        totalRings: rawB.totalRings.toNumber(),
        teiler: rawB.teiler?.toNumber() ?? null,
        ringteiler: rawB.ringteiler?.toNumber() ?? null,
      }
    : null

  // derselbe Ausgang, mit dem Ringwerk die Siege zählt (`countWins`)
  let winnerId: string | null = null
  if (rawA && rawB) {
    const outcome = storedDuelOutcome(
      rawA,
      rawB,
      round === "FINAL",
      rules.finalePrimary,
      rules.finaleTiebreaker1,
      rules.finaleTiebreaker2,
      factors
    )
    if (outcome === "A") winnerId = participantAId
    else if (outcome === "B") winnerId = participantBId
  }

  return {
    id: duel.id,
    duelNumber: duel.duelNumber,
    isSuddenDeath: duel.isSuddenDeath,
    isCompleted: duel.isCompleted,
    resultA,
    resultB,
    winnerId,
  }
}

function mapMatchItem(
  raw: {
    id: string
    round: PlayoffRound
    status: "PENDING" | "COMPLETED" | "BYE" | "WALKOVER"
    winsA: number
    winsB: number
    participantA: { id: string; firstName: string; lastName: string }
    participantB: { id: string; firstName: string; lastName: string }
    duels: {
      id: string
      duelNumber: number
      isSuddenDeath: boolean
      isCompleted: boolean
      results: {
        participantId: string
        totalRings: { toNumber: () => number }
        teiler: { toNumber: () => number } | null
        ringteiler: { toNumber: () => number } | null
      }[]
    }[]
  },
  rules: FinaleRules,
  factorOf: (participantId: string) => number
): PlayoffMatchItem {
  return {
    id: raw.id,
    round: raw.round,
    status: raw.status,
    winsA: raw.winsA,
    winsB: raw.winsB,
    participantA: raw.participantA,
    participantB: raw.participantB,
    duels: raw.duels.map((d) =>
      mapDuelItem(d, raw.participantA.id, raw.participantB.id, raw.round, rules, {
        a: factorOf(raw.participantA.id),
        b: factorOf(raw.participantB.id),
      })
    ),
    canCorrect: false, // wird in getPlayoffBracket korrekt gesetzt
  }
}

/** Lädt alle Playoff-Paarungen einer Meisterschaft, gruppiert nach Runde. */
export async function getPlayoffBracket(competitionId: string): Promise<PlayoffBracketData> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      finalePrimary: true,
      finaleTiebreaker1: true,
      finaleTiebreaker2: true,
      disciplineId: true,
    },
  })
  const rules: FinaleRules = {
    finalePrimary: competition?.finalePrimary ?? "RINGS",
    finaleTiebreaker1: competition?.finaleTiebreaker1 ?? null,
    finaleTiebreaker2: competition?.finaleTiebreaker2 ?? null,
  }
  // Teiler-Faktor je Teilnehmer wie in `duelFactors`: im gemischten Wettbewerb der der Einschreibung, sonst 1
  const factors = new Map<string, number>()
  if (competition && competition.disciplineId === null) {
    const enrolled = await db.competitionParticipant.findMany({
      where: { competitionId },
      select: { participantId: true, discipline: { select: { teilerFaktor: true } } },
    })
    for (const e of enrolled)
      factors.set(e.participantId, e.discipline?.teilerFaktor.toNumber() ?? 1)
  }
  const factorOf = (participantId: string) => factors.get(participantId) ?? 1
  const matches = await db.playoffMatch.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      status: true,
      winsA: true,
      winsB: true,
      participantA: { select: { id: true, firstName: true, lastName: true } },
      participantB: { select: { id: true, firstName: true, lastName: true } },
      duels: {
        orderBy: { duelNumber: "asc" },
        select: {
          id: true,
          duelNumber: true,
          isSuddenDeath: true,
          isCompleted: true,
          results: {
            select: {
              participantId: true,
              totalRings: true,
              teiler: true,
              ringteiler: true,
            },
          },
        },
      },
    },
    // Eine Runde entsteht in einem `createMany` mit derselben Zeit; die `id` (cuid: Zeitstempel, dann Zähler) hält die
    // Reihenfolge, in der Ringwerk sie gesetzt hat
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })

  const base = matches.map((m) => mapMatchItem(m, rules, factorOf))

  // canCorrect: FINAL immer; jede andere Runde, solange in der ganzen Folge-Runde kein Duell angelegt ist (sie entsteht
  // aus allen Siegern neu nach Rang, eine Korrektur kann jede ihrer Paarungen ändern)
  const roundHasDuels = (round: PlayoffRound) =>
    base.some((m) => m.round === round && m.duels.length > 0)
  const mapped = base.map((m) => ({
    ...m,
    canCorrect: m.round === "FINAL" ? true : !roundHasDuels(getNextRound(m.round)!),
  }))

  return {
    competitionId,
    eighthFinals: mapped.filter((m) => m.round === "EIGHTH_FINAL"),
    quarterFinals: mapped.filter((m) => m.round === "QUARTER_FINAL"),
    semiFinals: mapped.filter((m) => m.round === "SEMI_FINAL"),
    final: mapped.find((m) => m.round === "FINAL") ?? null,
  }
}

export async function hasPlayoffsStarted(competitionId: string): Promise<boolean> {
  const count = await db.playoffMatch.count({ where: { competitionId } })
  return count > 0
}

/**
 * Offene Paarungen der Gruppenphase, die den Playoff-Start sperren. Paarungen mit einem
 * zurückgezogenen Teilnehmer zählen nicht: Sie werden nicht gewertet und haben keine Ergebniseingabe.
 */
export async function countOpenGroupMatchups(competitionId: string): Promise<number> {
  const [pending, withdrawn] = await Promise.all([
    db.matchup.findMany({
      where: { competitionId, status: "PENDING" },
      select: { homeParticipantId: true, awayParticipantId: true },
    }),
    db.competitionParticipant.findMany({
      where: { competitionId, status: "WITHDRAWN" },
      select: { participantId: true },
    }),
  ])
  const withdrawnIds = new Set(withdrawn.map((e) => e.participantId))
  return pending.filter((m) => !involvesWithdrawn(m, withdrawnIds)).length
}

/**
 * Die Gruppentabelle in Setzreihenfolge — je nach Liga-Format die Rundenturnier- oder die
 * Best-of-Tabelle, also genau die Tabelle, die Spielplan-Seite und PDF zeigen. Setzplatz ist die
 * Position in der Liste, nicht `rank` (der ist bei Gleichstand geteilt).
 */
export async function getSeedingStandings(competitionId: string): Promise<SeedingRow[]> {
  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { leagueFormat: true },
  })
  return competition?.leagueFormat === "BEST_OF_SINGLE"
    ? getBestOfStandingsForCompetition(competitionId)
    : getStandingsForCompetition(competitionId)
}
