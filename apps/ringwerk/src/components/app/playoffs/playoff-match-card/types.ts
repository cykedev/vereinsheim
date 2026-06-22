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
  FINAL: "border-yellow-400/60 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400",
  SEMI_FINAL: "border-slate-400/60 bg-slate-400/10 text-slate-500 dark:text-slate-300",
  QUARTER_FINAL: "border-orange-500/60 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  EIGHTH_FINAL: "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400",
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
