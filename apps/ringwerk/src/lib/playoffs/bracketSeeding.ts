import type { PlayoffRound } from "@/generated/prisma/client"
import type { StandingRow } from "@/lib/standings/calculateStandings"
import type { PlayoffRuleset } from "./playoffRuleset"

/**
 * Erstellt die Paarungen der ersten Playoff-Runde anhand der Gruppenphase-Standings.
 * Nur aktive (nicht zurückgezogene) Teilnehmer qualifizieren sich.
 *
 * playoffHasAchtelfinale → EIGHTH_FINAL: Top 16, 1v16, 2v15, …
 * playoffHasViertelfinale → QUARTER_FINAL: Top 8, 1v8, 2v7, …
 * sonst → SEMI_FINAL: Top 4, 1v4, 2v3
 */
export function createFirstRoundMatchups(
  standings: StandingRow[],
  ruleset?: Pick<PlayoffRuleset, "playoffHasViertelfinale" | "playoffHasAchtelfinale"> | null
): { participantAId: string; participantBId: string; round: PlayoffRound }[] {
  const hasAF = ruleset?.playoffHasAchtelfinale ?? false
  const hasVF = hasAF || (ruleset?.playoffHasViertelfinale ?? true)

  const active = standings.filter((r) => !r.withdrawn)

  if (hasAF) {
    const top = active.slice(0, 16)
    return Array.from({ length: 8 }, (_, i) => ({
      participantAId: top[i].participantId,
      participantBId: top[15 - i].participantId,
      round: "EIGHTH_FINAL" as PlayoffRound,
    }))
  }

  if (hasVF) {
    const top = active.slice(0, 8)
    return Array.from({ length: 4 }, (_, i) => ({
      participantAId: top[i].participantId,
      participantBId: top[7 - i].participantId,
      round: "QUARTER_FINAL" as PlayoffRound,
    }))
  }

  // HF (default)
  const top = active.slice(0, 4)
  return Array.from({ length: 2 }, (_, i) => ({
    participantAId: top[i].participantId,
    participantBId: top[3 - i].participantId,
    round: "SEMI_FINAL" as PlayoffRound,
  }))
}

/**
 * Erstellt die Paarungen der nächsten Runde nach Re-Seeding.
 * Re-Seeding: Gewinner nach Original-Gruppenrang sortieren,
 * dann bester vs. schlechtester.
 *
 * Ergibt N/2 Paarungen aus N Gewinnern.
 */
export function createNextRoundMatchups(
  winners: string[],
  rankMap: Map<string, number>
): { participantAId: string; participantBId: string }[] {
  const sorted = [...winners].sort((a, b) => {
    const rankA = rankMap.get(a) ?? Infinity
    const rankB = rankMap.get(b) ?? Infinity
    return rankA - rankB
  })

  const n = sorted.length
  return Array.from({ length: n / 2 }, (_, i) => ({
    participantAId: sorted[i],
    participantBId: sorted[n - 1 - i],
  }))
}
