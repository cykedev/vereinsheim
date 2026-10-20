import type { ScoringMode } from "@/generated/prisma/client"
import { determineOutcome, type MatchOutcome } from "@/lib/results/calculateResult"
import type { DuelSeries } from "@/lib/scoring/bestOf"
import type { MatchResultSummary } from "./types"

/**
 * Ausgang einer Paarung im Spielplan (Bildschirm und PDF): dieselbe Regel wie in der Tabelle, beim Teiler der
 * korrigierte.
 */
export function pairingOutcome(
  home: Pick<MatchResultSummary, "rings" | "correctedTeiler" | "ringteiler">,
  away: Pick<MatchResultSummary, "rings" | "correctedTeiler" | "ringteiler">,
  scoringMode: ScoringMode
): MatchOutcome {
  const side = (r: typeof home) => ({
    rings: r.rings,
    teiler: r.correctedTeiler,
    ringteiler: r.ringteiler,
  })
  return determineOutcome(side(home), side(away), scoringMode)
}

/** Eine Seite eines Best-of-Duells für `duelOutcome` (Anzeige wie Wertung): beim Teiler der korrigierte */
export function bestOfDuelSide(
  s: Pick<MatchResultSummary, "rings" | "correctedTeiler" | "ringteiler">
): DuelSeries {
  return { rings: s.rings, correctedTeiler: s.correctedTeiler, ringteiler: s.ringteiler }
}
