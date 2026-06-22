import type { ParticipantStatus, ScoringType } from "@/generated/prisma/client"

export type CompetitionParticipantListItem = {
  id: string
  competitionId: string
  status: ParticipantStatus
  startNumber: number | null
  withdrawnAt: Date | null
  isGuest: boolean
  disciplineId: string | null
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
    teilerFaktor: number
  } | null
  participant: {
    id: string
    firstName: string
    lastName: string
    contact: string | null
  }
  teamNumber: number | null
  seriesCount: number
}
