import type { ScoringMode } from "@/generated/prisma/client"
import type { BestOfStandingRow } from "./bestOfStandingsTypes"

/**
 * Sorts active rows purely by column-visible criteria (no head-to-head), so the
 * table order is explicable from the displayed columns:
 *   1. wins desc (Match-Siege)
 *   2. duelDiff desc (Satzdifferenz)
 *   3. duelsWon desc (mehr gewonnene Sätze)
 *   4. best single result (mode-aware): RINGS/RINGS_DECIMAL → bestRings desc; else → bestRingteiler asc (null last)
 *   5. lastName localeCompare "de" (deterministic fallback)
 */
export function sortStandings(
  rows: BestOfStandingRow[],
  scoringMode: ScoringMode
): BestOfStandingRow[] {
  return [...rows].sort((a, b) => {
    // 1. Match wins
    if (a.wins !== b.wins) return b.wins - a.wins

    // 2. Satzdifferenz
    if (a.duelDiff !== b.duelDiff) return b.duelDiff - a.duelDiff

    // 3. Mehr gewonnene Sätze
    if (a.duelsWon !== b.duelsWon) return b.duelsWon - a.duelsWon

    // 4. Best single result (mode-aware)
    if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") {
      const ra = a.bestRings ?? -Infinity
      const rb = b.bestRings ?? -Infinity
      if (ra !== rb) return rb - ra
    } else {
      const rta = a.bestRingteiler ?? Infinity
      const rtb = b.bestRingteiler ?? Infinity
      if (rta !== rtb) return rta - rtb
    }

    // 5. lastName alphabetical (deterministic fallback)
    return a.lastName.localeCompare(b.lastName, "de")
  })
}
