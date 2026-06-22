export type EventTeamItem = {
  id: string
  teamNumber: number
  members: {
    competitionParticipantId: string
    participantId: string
    firstName: string
    lastName: string
    isGuest: boolean
  }[]
}
