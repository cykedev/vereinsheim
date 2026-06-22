import {
  bestOfDuelTally,
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
} from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import type { DuelSeries, BestOfStatus } from "@/lib/scoring/bestOf"
import type { MatchResultSummary } from "@/lib/matchups/types"
import type { ScoringMode } from "@/generated/prisma/client"

/** Group series by duelNumber into DuelSeries pairs for client-side resolveBestOf. */
export function deriveMatchStatus(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): BestOfStatus {
  const regularByDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  const tiebreakByDuel = new Map<number, { homeRings?: number; awayRings?: number }>()

  for (const s of series) {
    if (s.duelNumber === null) continue
    if (s.isTiebreak) {
      const existing = tiebreakByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, homeRings: s.rings })
      } else if (s.participantId === awayId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, awayRings: s.rings })
      }
    } else {
      // Factor of 1 used here: both sides share the same factor, so outcomes
      // are comparable even without the per-discipline factor for display.
      const factor = effectiveTeilerFaktor(disciplineId, 1)
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

  const regularOutcomes = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2))

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  return resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })
}

export function countDuelWins(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  status: BestOfStatus
): { homeWins: number; awayWins: number } {
  const byDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  for (const s of series) {
    if (s.duelNumber === null || s.isTiebreak) continue
    const factor = effectiveTeilerFaktor(disciplineId, 1)
    const entry: DuelSeries = {
      rings: s.rings,
      correctedTeiler: s.teiler * factor,
      ringteiler: s.ringteiler,
    }
    const existing = byDuel.get(s.duelNumber) ?? {}
    if (s.participantId === homeId) {
      byDuel.set(s.duelNumber, { ...existing, home: entry })
    } else if (s.participantId === awayId) {
      byDuel.set(s.duelNumber, { ...existing, away: entry })
    }
  }

  // A Stechschuss-decided tie counts for the winner — same logic as the table.
  const regularOutcomes = Array.from(byDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2))

  const { homeWins, awayWins } = bestOfDuelTally(regularOutcomes, status)
  return { homeWins, awayWins }
}

export function completedDuelNumbers(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[]
): number[] {
  const seenHome = new Set<number>()
  const seenAway = new Set<number>()
  for (const s of series) {
    if (s.duelNumber === null || s.isTiebreak) continue
    if (s.participantId === homeId) seenHome.add(s.duelNumber)
    if (s.participantId === awayId) seenAway.add(s.duelNumber)
  }
  const complete: number[] = []
  for (const n of seenHome) {
    if (seenAway.has(n)) complete.push(n)
  }
  return complete.sort((a, b) => a - b)
}

export function completedStechschussNumbers(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[]
): number[] {
  const seenHome = new Set<number>()
  const seenAway = new Set<number>()
  for (const s of series) {
    if (s.duelNumber === null || !s.isTiebreak) continue
    if (s.participantId === homeId) seenHome.add(s.duelNumber)
    if (s.participantId === awayId) seenAway.add(s.duelNumber)
  }
  const complete: number[] = []
  for (const n of seenHome) {
    if (seenAway.has(n)) complete.push(n)
  }
  return complete.sort((a, b) => a - b)
}
