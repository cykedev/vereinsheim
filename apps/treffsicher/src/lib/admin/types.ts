import type { ScoringType, UserRole } from "@/generated/prisma/client"

// Eigene Admin-Typen entkoppeln UI von Prisma-Selektdetails.
export type AdminActionResult = {
  error?: string
  success?: boolean
}

export type AdminUserSummary = {
  id: string
  name: string | null
  email: string
  role: UserRole
  isActive: boolean
  createdAt: Date
}

export type AdminUserListItem = AdminUserSummary & {
  sessionsCount: number
  goalsCount: number
  shotRoutinesCount: number
  lastSessionEditAt: Date | null
}

export type AdminSystemDisciplineSummary = {
  id: string
  name: string
  seriesCount: number
  shotsPerSeries: number
  practiceSeries: number
  scoringType: ScoringType
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

// Die Ansichtstypen der Rate-Limit-Verwaltung sind zwischen den Apps geteilt
// (die Oberfläche liegt in @vereinsheim/ui/admin/*).
export type {
  AdminLoginRateLimitBucket,
  AdminLoginRateLimitInsights,
} from "@vereinsheim/lib/auth/rate-limit/adminTypes"
