// Was der Schütze an einem Ablauf ändert: anlegen, Schritte und Name, Disziplin, Papierkorb. Jede Funktion prüft das
// eigene Konto und den Ablauf selbst; Prüfen und Schreiben stehen in einer Transaktion (conventions §9).

import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

import { ERRORS } from "../texts"
import { DIARY_TRASH_DAYS } from "../trash"
import { ROUTINE_ERRORS } from "./texts"
import { parseRoutine, type RoutineData, type RoutineFieldErrors } from "./validation"

type Tx = Prisma.TransactionClient

const DAY_MS = 86_400_000

export const ROUTINE_TRASH_ERRORS = {
  notInTrash: "Dieser Ablauf liegt nicht mehr im Papierkorb.",
  expired: "Die 30 Tage sind um. Der Ablauf lässt sich nicht mehr wiederherstellen.",
} as const

export type RoutineWrite = { error: string } | { fieldErrors: RoutineFieldErrors }

async function lockRoutine(tx: Tx, userId: string, routineId: string): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "DiaryRoutine" WHERE id = ${routineId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
  return Boolean(row)
}

async function run(db: Db, change: (tx: Tx) => Promise<string | null>): Promise<string | null> {
  try {
    return await db.$transaction(change, { isolationLevel: "Serializable" })
  } catch {
    return ERRORS.failed
  }
}

const familiesOf = async (db: Db, userId: string) =>
  new Set((await resultFamilies(db, userId)).map((family) => family.id))

const columns = (data: RoutineData) => ({
  name: data.name,
  familyId: data.familyId,
  steps: data.steps as unknown as Prisma.InputJsonArray,
})

/** ein neuer Ablauf; die Kennung oder der Grund */
export async function createRoutine(
  db: Db,
  userId: string,
  raw: unknown
): Promise<{ id: string } | RoutineWrite> {
  const parsed = parseRoutine(raw, await familiesOf(db, userId))
  if ("invalid" in parsed) return { error: ERRORS.failed }
  if ("fieldErrors" in parsed) return parsed
  try {
    const routine = await db.diaryRoutine.create({
      data: { userId, ...columns(parsed.data) },
      select: { id: true },
    })
    return { id: routine.id }
  } catch {
    return { error: ERRORS.failed }
  }
}

/** Name und Schritte; die Disziplin bleibt, wie sie ist */
export async function updateRoutine(
  db: Db,
  userId: string,
  routineId: string,
  raw: { name: string; text: string }
): Promise<null | RoutineWrite> {
  const row = await db.diaryRoutine.findFirst({
    where: { id: routineId, userId, deletedAt: null },
    select: { familyId: true },
  })
  if (!row) return { error: ROUTINE_ERRORS.missing }
  // die gespeicherte Disziplin gilt weiter, auch wenn sie nicht mehr angeboten wird
  const families = await familiesOf(db, userId)
  if (row.familyId !== null) families.add(row.familyId)
  const parsed = parseRoutine({ ...raw, familyId: row.familyId }, families)
  if ("invalid" in parsed) return { error: ERRORS.failed }
  if ("fieldErrors" in parsed) return parsed
  const error = await run(db, async (tx) => {
    if (!(await lockRoutine(tx, userId, routineId))) return ROUTINE_ERRORS.missing
    const { name, steps } = columns(parsed.data)
    await tx.diaryRoutine.update({ where: { id: routineId }, data: { name, steps } })
    return null
  })
  return error ? { error } : null
}

/** die Disziplin festlegen oder ändern; null nimmt sie weg */
export async function setRoutineFamily(
  db: Db,
  userId: string,
  routineId: string,
  familyId: number | null
): Promise<string | null> {
  if (familyId !== null && !(await familiesOf(db, userId)).has(familyId)) return ERRORS.failed
  return run(db, async (tx) => {
    if (!(await lockRoutine(tx, userId, routineId))) return ROUTINE_ERRORS.missing
    await tx.diaryRoutine.update({ where: { id: routineId }, data: { familyId } })
    return null
  })
}

/** in den Papierkorb */
export async function deleteRoutine(
  db: Db,
  userId: string,
  routineId: string
): Promise<string | null> {
  const { count } = await db.diaryRoutine.updateMany({
    where: { id: routineId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return count === 1 ? null : ROUTINE_ERRORS.missing
}

/** aus dem Papierkorb zurück, solange die 30 Tage nicht um sind */
export async function restoreRoutine(
  db: Db,
  userId: string,
  routineId: string,
  nowMs = Date.now()
): Promise<string | null> {
  const row = await db.diaryRoutine.findFirst({
    where: { id: routineId, userId, deletedAt: { not: null } },
    select: { deletedAt: true },
  })
  if (!row) return ROUTINE_TRASH_ERRORS.notInTrash
  if (row.deletedAt!.getTime() + DIARY_TRASH_DAYS * DAY_MS <= nowMs)
    return ROUTINE_TRASH_ERRORS.expired
  const { count } = await db.diaryRoutine.updateMany({
    where: { id: routineId, userId, deletedAt: row.deletedAt },
    data: { deletedAt: null },
  })
  return count === 1 ? null : ROUTINE_TRASH_ERRORS.notInTrash
}

/** sofort endgültig löschen, nur aus dem Papierkorb */
export async function purgeRoutineNow(
  db: Db,
  userId: string,
  routineId: string
): Promise<string | null> {
  const { count } = await db.diaryRoutine.deleteMany({
    where: { id: routineId, userId, deletedAt: { not: null } },
  })
  return count === 1 ? null : ROUTINE_TRASH_ERRORS.notInTrash
}
