import type { Discipline } from "@/generated/prisma/client"

/**
 * Prisma's Decimal type is not serializable across the Server→Client boundary.
 * Use this type instead of Discipline when passing to Client Components.
 */
export type SerializableDiscipline = Omit<Discipline, "teilerFaktor"> & {
  teilerFaktor: number
}

export type DisciplineUsage = {
  leagueCount: number
  canDelete: boolean
}
