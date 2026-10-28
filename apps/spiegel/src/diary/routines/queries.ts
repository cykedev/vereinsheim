// Was die Seiten der Abläufe lesen: die Abläufe je Disziplin für den Faden, einen Ablauf zum Lesen und Bearbeiten.

import type { Db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

import type { Family } from "../queries"
import type { RoutineStep } from "./steps"
import { routineSteps } from "./validation"

export interface RoutineSummary {
  id: string
  name: string
  familyId: number | null
  steps: number
}

export interface RoutineView {
  id: string
  name: string
  family: Family | null
  steps: RoutineStep[]
}

/** die gespeicherten Schritte; was nicht passt, gilt als keine */
const stepsOf = (raw: unknown): RoutineStep[] => {
  const parsed = routineSteps.safeParse(raw)
  return parsed.success ? parsed.data : []
}

/** alle eigenen Abläufe, die nicht im Papierkorb liegen, nach Name */
export async function routineList(db: Db, userId: string): Promise<RoutineSummary[]> {
  const rows = await db.diaryRoutine.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, familyId: true, steps: true },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    familyId: row.familyId,
    steps: stepsOf(row.steps).length,
  }))
}

/** ein eigener Ablauf, der nicht im Papierkorb liegt; sonst null */
export async function routineView(
  db: Db,
  userId: string,
  routineId: string
): Promise<RoutineView | null> {
  const [row, families] = await Promise.all([
    db.diaryRoutine.findFirst({
      where: { id: routineId, userId, deletedAt: null },
      select: { id: true, name: true, familyId: true, steps: true },
    }),
    resultFamilies(db, userId),
  ])
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    family: row.familyId === null ? null : (families.find((f) => f.id === row.familyId) ?? null),
    steps: stepsOf(row.steps),
  }
}
