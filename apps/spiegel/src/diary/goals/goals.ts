// Was der Schütze an einem Ziel ändert: anlegen, ändern, Notiz, „Hat es geklappt?“, Papierkorb. Jede Funktion prüft
// das eigene Konto und das Ziel selbst; Prüfen und Schreiben stehen in einer Transaktion (conventions §9). Rückgabe:
// null bei Erfolg, sonst der Grund in Worten (Feldfehler beim Anlegen und Ändern als Liste je Feld).

import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

import { ENTRY_ERRORS } from "../entries"
import { ERRORS } from "../texts"
import { DIARY_TRASH_DAYS } from "../trash"
import { dateOfDay, outcomeInput, textInput } from "../validation"
import { GOAL_ERRORS } from "./texts"
import { parseGoal, type GoalData, type GoalFieldErrors } from "./validation"

type Tx = Prisma.TransactionClient

const DAY_MS = 86_400_000

export const GOAL_TRASH_ERRORS = {
  notInTrash: "Dieses Ziel liegt nicht mehr im Papierkorb.",
  expired: "Die 30 Tage sind um. Das Ziel lässt sich nicht mehr wiederherstellen.",
} as const

export type GoalWrite = { error: string } | { fieldErrors: GoalFieldErrors }

/** das eigene Ziel, nicht im Papierkorb, gesperrt für diese Transaktion */
async function lockGoal(tx: Tx, userId: string, goalId: string): Promise<boolean> {
  const [row] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "DiaryGoal" WHERE id = ${goalId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
  return Boolean(row)
}

async function run(db: Db, change: (tx: Tx) => Promise<string | null>): Promise<string | null> {
  try {
    return await db.$transaction(change, { isolationLevel: "Serializable" })
  } catch {
    return ERRORS.failed
  }
}

/** die Spalten eines geprüften Ziels; ohne Messung alle vier leer */
const columns = (data: GoalData) => ({
  title: data.title,
  kind: data.kind,
  familyId: data.familyId,
  from: dateOfDay(data.from),
  to: dateOfDay(data.to),
  measure: data.measure?.measure ?? null,
  threshold: data.measure?.threshold ?? null,
  scoring: data.measure?.scoring ?? null,
  shots: data.measure?.shots ?? null,
  cards: data.measure?.cards ?? ("all" as const),
})

/** prüft gegen die Disziplinen zur Wahl; die gespeicherte eines Ziels gilt weiter, auch wenn sie nicht mehr angeboten wird */
async function checked(db: Db, userId: string, raw: unknown, stored: number | null = null) {
  const families = new Set((await resultFamilies(db, userId)).map((family) => family.id))
  if (stored !== null) families.add(stored)
  return parseGoal(raw, families)
}

/** ein neues Ziel; die Kennung oder der Grund */
export async function createGoal(
  db: Db,
  userId: string,
  raw: unknown
): Promise<{ id: string } | GoalWrite> {
  const parsed = await checked(db, userId, raw)
  if ("invalid" in parsed) return { error: ERRORS.failed }
  if ("fieldErrors" in parsed) return parsed
  try {
    const goal = await db.diaryGoal.create({
      data: { userId, ...columns(parsed.data) },
      select: { id: true },
    })
    return { id: goal.id }
  } catch {
    return { error: ERRORS.failed }
  }
}

/** Satz, Art, Disziplin, Zeitraum und Messung als Ganzes; Notiz und Antwort bleiben */
export async function updateGoal(
  db: Db,
  userId: string,
  goalId: string,
  raw: unknown
): Promise<null | GoalWrite> {
  const row = await db.diaryGoal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: { familyId: true },
  })
  if (!row) return { error: GOAL_ERRORS.missing }
  const parsed = await checked(db, userId, raw, row.familyId)
  if ("invalid" in parsed) return { error: ERRORS.failed }
  if ("fieldErrors" in parsed) return parsed
  const error = await run(db, async (tx) => {
    if (!(await lockGoal(tx, userId, goalId))) return GOAL_ERRORS.missing
    await tx.diaryGoal.update({ where: { id: goalId }, data: columns(parsed.data) })
    return null
  })
  return error ? { error } : null
}

/** die Notiz; leer heißt keine */
export async function setGoalNote(
  db: Db,
  userId: string,
  goalId: string,
  raw: string
): Promise<string | null> {
  const parsed = textInput.safeParse(typeof raw === "string" ? raw : "")
  if (!parsed.success) return ENTRY_ERRORS.tooLong
  return run(db, async (tx) => {
    if (!(await lockGoal(tx, userId, goalId))) return GOAL_ERRORS.missing
    await tx.diaryGoal.update({ where: { id: goalId }, data: { note: parsed.data } })
    return null
  })
}

/** „Hat es geklappt?“; null nimmt die Antwort zurück */
export async function setGoalOutcome(
  db: Db,
  userId: string,
  goalId: string,
  outcome: unknown
): Promise<string | null> {
  const parsed = outcomeInput.safeParse(outcome)
  if (!parsed.success) return ERRORS.failed
  return run(db, async (tx) => {
    if (!(await lockGoal(tx, userId, goalId))) return GOAL_ERRORS.missing
    await tx.diaryGoal.update({ where: { id: goalId }, data: { outcome: parsed.data } })
    return null
  })
}

/** in den Papierkorb */
export async function deleteGoal(db: Db, userId: string, goalId: string): Promise<string | null> {
  const { count } = await db.diaryGoal.updateMany({
    where: { id: goalId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return count === 1 ? null : GOAL_ERRORS.missing
}

/** aus dem Papierkorb zurück, solange die 30 Tage nicht um sind */
export async function restoreGoal(
  db: Db,
  userId: string,
  goalId: string,
  nowMs = Date.now()
): Promise<string | null> {
  const row = await db.diaryGoal.findFirst({
    where: { id: goalId, userId, deletedAt: { not: null } },
    select: { deletedAt: true },
  })
  if (!row) return GOAL_TRASH_ERRORS.notInTrash
  if (row.deletedAt!.getTime() + DIARY_TRASH_DAYS * DAY_MS <= nowMs)
    return GOAL_TRASH_ERRORS.expired
  const { count } = await db.diaryGoal.updateMany({
    where: { id: goalId, userId, deletedAt: row.deletedAt },
    data: { deletedAt: null },
  })
  return count === 1 ? null : GOAL_TRASH_ERRORS.notInTrash
}

/** sofort endgültig löschen, nur aus dem Papierkorb */
export async function purgeGoalNow(db: Db, userId: string, goalId: string): Promise<string | null> {
  const { count } = await db.diaryGoal.deleteMany({
    where: { id: goalId, userId, deletedAt: { not: null } },
  })
  return count === 1 ? null : GOAL_TRASH_ERRORS.notInTrash
}
