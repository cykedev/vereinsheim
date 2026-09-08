import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

// Gebündelte Konfiguration für eine Playoff-Match-Karte (Wertung + Finale-Regeln).
export interface PlayoffCardConfig {
  scoringType: ScoringType
  shotsPerSeries: number
  playoffBestOf: number | null
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}

export const ROUND_LABEL: Record<string, string> = {
  EIGHTH_FINAL: "Achtelfinale",
  QUARTER_FINAL: "Viertelfinale",
  SEMI_FINAL: "Halbfinale",
  FINAL: "Finale",
}

// Gold / Silber / Bronze je nach Runde
export const WINNER_BADGE: Record<string, string> = {
  FINAL: "border-rank-1/60 bg-rank-1/10 text-rank-1",
  SEMI_FINAL: "border-rank-2/60 bg-rank-2/10 text-rank-2",
  QUARTER_FINAL: "border-rank-3/60 bg-rank-3/10 text-rank-3",
  EIGHTH_FINAL: "border-info/60 bg-info/10 text-info",
}

export function finaleHintText(
  primary: ScoringMode,
  tb1: ScoringMode | null,
  tb2: ScoringMode | null
): string {
  const label = (m: ScoringMode) => SCORING_MODE_LABELS[m] ?? m
  const parts = [`Primär: ${label(primary)}`]
  if (tb1) parts.push(`TB: ${label(tb1)}`)
  if (tb2) parts.push(`TB2: ${label(tb2)}`)
  return parts.join(" · ")
}
