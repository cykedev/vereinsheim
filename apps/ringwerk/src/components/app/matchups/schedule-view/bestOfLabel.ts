import {
  bestOfDuelTally,
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
} from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import type { DuelSeries } from "@/lib/scoring/bestOf"
import type { ScoringMode } from "@/generated/prisma/client"
import type { MatchResultSummary } from "@/lib/matchups/types"

/**
 * Derives the compact display label for a best-of matchup's current state.
 *
 * - complete + decided by Stechschuss → "1:1 n. St."
 * - complete → "2:1" (Satz-Ergebnis)
 * - in_progress with some duels → "1:0 (2 offen)"
 * - not started → "offen"
 * - needs_tiebreak → "Stechschuss"
 */
export function deriveBestOfLabel(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): { label: string; isComplete: boolean; winner: "home" | "away" | null } {
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

  const completePairs = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)

  const regularOutcomes = completePairs.map(([, pair]) =>
    duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2)
  )

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  const status = resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })

  const { homeWins, awayWins, decidedByStechschuss } = bestOfDuelTally(regularOutcomes, status)

  if (status.kind === "complete") {
    const scoreLabel = `${homeWins}:${awayWins}`
    return {
      label: decidedByStechschuss ? `${scoreLabel} n. St.` : scoreLabel,
      isComplete: true,
      winner: status.winner === "A" ? "home" : "away",
    }
  }

  if (status.kind === "needs_tiebreak") {
    return { label: "Stechschuss", isComplete: false, winner: null }
  }

  // in_progress
  const completedCount = completePairs.length
  const remaining = bestOf - completedCount
  if (completedCount === 0) {
    return { label: "offen", isComplete: false, winner: null }
  }
  return {
    label: `${homeWins}:${awayWins} (${remaining} ${remaining === 1 ? "Duell" : "Duelle"} offen)`,
    isComplete: false,
    winner: null,
  }
}
