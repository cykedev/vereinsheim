export type ParticipantListItem = {
  id: string
  firstName: string
  lastName: string
  contact: string | null
  isActive: boolean
  isGuestRecord: boolean
  createdAt: Date
  _count: { competitions: number }
}

export type ParticipantDetail = {
  id: string
  firstName: string
  lastName: string
  contact: string | null
  isActive: boolean
  isGuestRecord: boolean
  createdAt: Date
}

export type ParticipantOption = {
  id: string
  firstName: string
  lastName: string
  contact: string | null
}
