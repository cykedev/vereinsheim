import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import type { BestOfStandingsSeries, DirectResult, HeadToHead } from "./bestOfStandingsTypes"

interface DuelPair {
  home: BestOfStandingsSeries
  away: BestOfStandingsSeries
}

/** Build a corrected DuelSeries from a raw standings series entry. */
export function toDuelSeries(s: BestOfStandingsSeries, competitionDisciplineId: string | null) {
  const factor = effectiveTeilerFaktor(competitionDisciplineId, s.teilerFaktor)
  return {
    rings: s.rings,
    correctedTeiler: s.teiler * factor,
    ringteiler: s.ringteiler,
  }
}

/**
 * Group series entries by duelNumber and pair home vs away.
 * Assumes each duelNumber has exactly one home and one away entry.
 */
export function groupByDuelNumber(
  series: BestOfStandingsSeries[],
  homeId: string,
  awayId: string
): Map<number, DuelPair> {
  const map = new Map<number, DuelPair>()
  for (const s of series) {
    let pair = map.get(s.duelNumber)
    if (!pair) {
      pair = {} as DuelPair
      map.set(s.duelNumber, pair)
    }
    if (s.participantId === homeId) {
      pair.home = s
    } else if (s.participantId === awayId) {
      pair.away = s
    }
  }
  // Only return complete pairs (both home and away present).
  for (const [dn, pair] of map) {
    if (!pair.home || !pair.away) map.delete(dn)
  }
  return map
}

/** Return duel numbers sorted ascending. */
export function sortedDuelNumbers(map: Map<number, DuelPair>): number[] {
  return [...map.keys()].sort((a, b) => a - b)
}

/** Record one participant's direct result vs an opponent into the head-to-head map (Kriterium 4). */
export function setH2H(
  h2h: HeadToHead,
  participantId: string,
  opponentId: string,
  result: DirectResult
): void {
  let inner = h2h.get(participantId)
  if (!inner) {
    inner = new Map()
    h2h.set(participantId, inner)
  }
  inner.set(opponentId, result)
}
