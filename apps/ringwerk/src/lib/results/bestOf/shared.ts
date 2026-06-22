import { db } from "@/lib/db"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { duelOutcome, resolveBestOf, stechschussOutcome } from "@/lib/scoring/bestOf"
import type { DuelSeries, BestOfStatus } from "@/lib/scoring/bestOf"
import type { ScoringMode } from "@/generated/prisma/client"
import type { PlainSeries } from "./types"

// ─── Shared DB loader ─────────────────────────────────────────────────────────

export async function loadMatchup(matchupId: string) {
  return db.matchup.findUnique({
    where: { id: matchupId },
    select: {
      id: true,
      status: true,
      round: true,
      dueDate: true,
      homeParticipantId: true,
      homeParticipant: { select: { firstName: true, lastName: true } },
      awayParticipantId: true,
      awayParticipant: { select: { firstName: true, lastName: true } },
      competitionId: true,
      competition: {
        select: {
          shotsPerSeries: true,
          disciplineId: true,
          discipline: {
            select: { id: true, scoringType: true, teilerFaktor: true },
          },
          scoringMode: true,
          groupBestOf: true,
          groupPlayAllDuels: true,
          groupTiebreaker1: true,
          groupTiebreaker2: true,
        },
      },
      series: {
        select: {
          participantId: true,
          rings: true,
          teiler: true,
          ringteiler: true,
          duelNumber: true,
          isTiebreak: true,
          discipline: { select: { teilerFaktor: true } },
        },
      },
    },
  })
}

export type LoadedMatchup = NonNullable<Awaited<ReturnType<typeof loadMatchup>>>

// ─── Discipline resolution ────────────────────────────────────────────────────

/**
 * Resolves the discipline for home and away participants.
 * Mirrors saveMatchResult exactly: competition-level discipline takes priority;
 * for mixed competitions (disciplineId === null) we fall back to per-participant.
 */
export async function resolveDisciplines(matchup: LoadedMatchup) {
  let homeDiscipline = matchup.competition.discipline
  let awayDiscipline = matchup.competition.discipline

  if (!homeDiscipline) {
    const [homeCp, awayCp] = await Promise.all([
      db.competitionParticipant.findFirst({
        where: {
          participantId: matchup.homeParticipantId,
          competitionId: matchup.competitionId,
        },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
      db.competitionParticipant.findFirst({
        where: {
          participantId: matchup.awayParticipantId!,
          competitionId: matchup.competitionId,
        },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
    ])
    homeDiscipline = homeCp?.discipline ?? null
    awayDiscipline = awayCp?.discipline ?? null
  }

  return { homeDiscipline, awayDiscipline }
}

// ─── Match-state evaluator ────────────────────────────────────────────────────

/**
 * Evaluates the best-of match state from a plain list of series.
 *
 * Uses plain numbers throughout so callers can mix DB-loaded and in-flight
 * series without fighting Prisma's Decimal type.
 *
 * Home participant = A, away participant = B.
 *
 * - Regular duels: evaluated with duelOutcome (uses correctedTeiler = teiler * effectiveTeilerFaktor).
 * - Tiebreak (Stechschuss) rounds: evaluated with stechschussOutcome (shot value in rings, higher wins),
 *   independent of scoringMode.
 */
export function evaluateMatchState(
  homeId: string,
  awayId: string,
  series: PlainSeries[],
  competitionDisciplineId: string | null,
  scoringMode: ScoringMode,
  groupTiebreaker1: ScoringMode | null,
  groupTiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): BestOfStatus {
  const regularByDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  const tiebreakByDuel = new Map<number, { homeRings?: number; awayRings?: number }>()

  for (const s of series) {
    if (s.duelNumber === null) continue

    if (s.isTiebreak) {
      // Stechschuss: only the shot value (rings) matters.
      const existing = tiebreakByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, homeRings: s.rings })
      } else if (s.participantId === awayId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, awayRings: s.rings })
      }
    } else {
      const factor = effectiveTeilerFaktor(competitionDisciplineId, s.teilerFaktor)
      const entry: DuelSeries = {
        rings: s.rings,
        correctedTeiler: s.teiler * factor,
        ringteiler: s.ringteiler,
      }
      const existing = regularByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        regularByDuel.set(s.duelNumber, { ...existing, home: entry })
      } else if (s.participantId === awayId) {
        regularByDuel.set(s.duelNumber, { ...existing, away: entry })
      }
    }
  }

  // Only evaluate complete pairs.
  const regularOutcomes = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) =>
      duelOutcome(pair.home!, pair.away!, scoringMode, groupTiebreaker1, groupTiebreaker2)
    )

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  return resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })
}

/**
 * Converts DB-loaded Decimal fields to plain numbers for evaluation.
 */
export function toPlain(series: LoadedMatchup["series"]): PlainSeries[] {
  return series.map((s) => ({
    participantId: s.participantId,
    rings: s.rings.toNumber(),
    teiler: s.teiler.toNumber(),
    ringteiler: s.ringteiler.toNumber(),
    teilerFaktor: s.discipline?.teilerFaktor.toNumber() ?? 1,
    duelNumber: s.duelNumber,
    isTiebreak: s.isTiebreak,
  }))
}
