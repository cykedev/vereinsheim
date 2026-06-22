import type { ScoringType } from "@/generated/prisma/client"

export type EventSeriesItem = {
  id: string
  participantId: string
  competitionParticipantId: string | null
  disciplineId: string
  discipline: {
    name: string
    teilerFaktor: number
    scoringType: ScoringType
  }
  participant: {
    id: string
    firstName: string
    lastName: string
  }
  isGuest: boolean
  // teamNumber: gesetzt wenn Team-Event (eventTeamId auf CompetitionParticipant)
  teamNumber: number | null
  rings: number
  teiler: number
  ringteiler: number
  shots: number[]
  shotCount: number
  sessionDate: Date
}

export type SaveEventSeriesInput = {
  competitionId: string
  participantId: string
  disciplineId: string
  rings: number
  teiler: number
  shotCount: number
}

export type SeasonSeriesItem = {
  id: string
  participantId: string
  disciplineId: string
  discipline: {
    name: string
    teilerFaktor: number
    scoringType: ScoringType
  }
  rings: number
  teiler: number
  ringteiler: number
  shotCount: number
  sessionDate: Date
}

export type SeasonParticipantEntry = {
  participantId: string
  firstName: string
  lastName: string
  status: string
  disciplineId: string | null
  discipline: { id: string; name: string } | null
  series: SeasonSeriesItem[]
}
