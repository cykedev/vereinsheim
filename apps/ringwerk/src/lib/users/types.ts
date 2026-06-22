export type UserListItem = {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
  createdAt: Date
}

export type UserSummary = {
  id: string
  name: string | null
  email: string
  role: string
  isActive: boolean
}
