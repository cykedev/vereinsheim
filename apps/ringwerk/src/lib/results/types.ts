export interface ResultInput {
  rings: number
  teiler: number
}

export interface SaveMatchResultInput {
  homeResult: ResultInput
  awayResult: ResultInput
}

export interface SeriesSummary {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
}
