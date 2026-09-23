import type { ScoringMode } from "@/generated/prisma/client"
import type { RankableEntry, RankedEntry } from "./types"
import { SCORE_DIRECTION } from "./types"
import { assignSharedRanks, sameScore } from "./sharedRanks"

/**
 * Sortiert eine Liste von Einträgen nach dem Score des gegebenen Wertungsmodus
 * und weist jedem Eintrag einen Rang zu (1-basiert). Gleicher Score teilt den Platz ("1, 1, 3").
 *
 * TARGET_UNDER/TARGET_OVER: Einträge in der bevorzugten Tier (Score < 1e9) werden durch
 * die Score-Kodierung automatisch vor Einträgen der schlechteren Tier platziert.
 *
 * Die Originalliste wird nicht verändert.
 */
export function rankByScore(entries: RankableEntry[], mode: ScoringMode): RankedEntry[] {
  const direction = SCORE_DIRECTION[mode]
  const sorted = [...entries].sort((a, b) => {
    if (sameScore(a.score, b.score)) return 0
    return direction === "asc" ? a.score - b.score : b.score - a.score
  })
  // Bei gleichem Score bleibt die eingehende Ordnung stehen (Array#sort ist stabil) — der
  // Aufrufer sortiert vorher nach Namen bzw. Teamnummer.
  const ranks = assignSharedRanks(sorted, (a, b) => sameScore(a.score, b.score))
  return sorted.map((entry, index) => ({ ...entry, rank: ranks[index] }))
}
