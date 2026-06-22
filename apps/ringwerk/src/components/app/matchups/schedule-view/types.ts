import type { ScoringMode } from "@/generated/prisma/client"
import type { MatchupParticipant } from "@/lib/matchups/types"

// Shared best-of config for BEST_OF_SINGLE layout
export interface BestOfConfig {
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  /** Effective teilerFaktor for live corrected-teiler hint. */
  competitionTeilerFaktor: number
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Offen",
  COMPLETED: "Abgeschlossen",
  BYE: "Freilos",
  WALKOVER: "Kampflos",
}

export function participantName(p: MatchupParticipant): string {
  return `${p.lastName}, ${p.firstName}`
}
