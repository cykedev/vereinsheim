import type { GoalType, SessionType } from "@/generated/prisma/client"

export type GoalWithAssignments = {
  id: string
  title: string
  description: string | null
  type: GoalType
  dateFrom: Date
  dateTo: Date
  sessionCount: number
  sessionIds: string[]
}

export type GoalSessionOption = {
  id: string
  date: Date
  type: SessionType
  disciplineName: string | null
  location: string | null
}

export type GoalForSelection = {
  id: string
  title: string
  type: GoalType
  dateFrom: Date
  dateTo: Date
}

// Kanon liegt in @/lib/types — kein eigener Ziel-Ergebnistyp mehr.
export type { ActionResult } from "@/lib/types"
