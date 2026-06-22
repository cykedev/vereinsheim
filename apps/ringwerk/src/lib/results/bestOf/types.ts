// ─── Input Types ──────────────────────────────────────────────────────────────

export interface BestOfShooterInput {
  rings: number
  teiler: number
  shots?: string[]
}

export interface SaveBestOfDuelInput {
  matchupId: string
  duelNumber: number
  homeResult: BestOfShooterInput
  awayResult: BestOfShooterInput
}

export interface SaveStechschussInput {
  matchupId: string
  /** Single decimal shot value for the home participant. */
  homeShot: number
  /** Single decimal shot value for the away participant. */
  awayShot: number
}

// ─── Plain-number series entry (for evaluation without Decimal types) ─────────

export interface PlainSeries {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
  /** The discipline's configured factor (used with competitionDisciplineId to compute correctedTeiler). */
  teilerFaktor: number
  duelNumber: number | null
  isTiebreak: boolean
}
