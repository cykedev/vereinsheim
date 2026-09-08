// Kanon liegt in @/lib/types — hier nur re-exportiert, damit bestehende
// Importpfade der Disziplin-Module unverändert bleiben.
export type { ActionResult } from "@/lib/types"

export type DisciplineUsage = {
  sessionCount: number
  shotRoutineCount: number
  canDelete: boolean
}
