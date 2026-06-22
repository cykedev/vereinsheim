import type { ScoringMode } from "@/generated/prisma/client"

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BestOfStandingsParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
}

export interface BestOfStandingsSeries {
  participantId: string
  duelNumber: number
  isTiebreak: boolean
  rings: number
  teiler: number
  /** stored (already effective-factor-corrected at save time). */
  ringteiler: number
  /** the discipline's configured factor. */
  teilerFaktor: number
}

export interface BestOfStandingsMatchup {
  homeParticipantId: string
  awayParticipantId: string | null // null = BYE
  series: BestOfStandingsSeries[]
}

export interface BestOfStandingsConfig {
  scoringMode: ScoringMode
  bestOf: number
  playAll: boolean
  tiebreaker1: ScoringMode | null
  tiebreaker2: ScoringMode | null
  /** Competition.disciplineId — null = mixed (factor active), else fixed (factor 1). */
  competitionDisciplineId: string | null
}

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface BestOfStandingRow {
  participantId: string
  firstName: string
  lastName: string
  withdrawn: boolean
  played: number
  wins: number
  losses: number
  duelsWon: number
  duelsLost: number
  duelDiff: number
  bestRingteiler: number | null
  bestRings: number | null
  rank: number
}

// ---------------------------------------------------------------------------
// Internal stat accumulator
// ---------------------------------------------------------------------------

export interface ParticipantStats {
  wins: number
  losses: number
  played: number
  duelsWon: number
  duelsLost: number
  ringteilers: number[]
  ringsValues: number[]
}
