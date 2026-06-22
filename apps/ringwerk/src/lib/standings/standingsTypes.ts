export interface StandingsParticipant {
  id: string
  firstName: string
  lastName: string
  /** true = in dieser Liga zurückgezogen (LeagueParticipant.status === WITHDRAWN) */
  withdrawn: boolean
}

export interface StandingsMatchupResult {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
}

export interface StandingsMatchup {
  id: string
  status: "PENDING" | "COMPLETED" | "BYE" | "WALKOVER"
  homeParticipantId: string
  awayParticipantId: string | null
  results: StandingsMatchupResult[]
}

export interface StandingRow {
  participantId: string
  firstName: string
  lastName: string
  withdrawn: boolean
  played: number
  wins: number
  draws: number
  losses: number
  byes: number
  points: number
  /** Niedrigster Ringteiler aus allen gewerteten Duellen. null wenn noch keine. */
  bestRingteiler: number | null
  /** Höchste Seriensumme aus allen gewerteten Duellen. null wenn noch keine. */
  bestRings: number | null
  rank: number
}

export interface ParticipantStats {
  wins: number
  draws: number
  losses: number
  byes: number
  played: number
  ringteilers: number[]
  ringsValues: number[]
}
