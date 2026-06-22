import type { ScoringMode } from "@/generated/prisma/client"
import type { RankableEntry, RankedEntry } from "./types"
import { SCORE_DIRECTION } from "./types"

/**
 * Sortiert eine Liste von Einträgen nach dem Score des gegebenen Wertungsmodus
 * und weist jedem Eintrag einen Rang zu (1-basiert).
 *
 * TARGET_UNDER/TARGET_OVER: Einträge in der bevorzugten Tier (Score < 1e9) werden durch
 * die Score-Kodierung automatisch vor Einträgen der schlechteren Tier platziert.
 *
 * Die Originalliste wird nicht verändert.
 */
export function rankByScore(entries: RankableEntry[], mode: ScoringMode): RankedEntry[] {
  const direction = SCORE_DIRECTION[mode]
  const sorted = [...entries].sort((a, b) =>
    direction === "asc" ? a.score - b.score : b.score - a.score
  )
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }))
}
