"use server"

import { revalidatePath } from "next/cache"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { diarySettings } from "../settings"
import { ERRORS } from "../texts"
import {
  createRoutine,
  deleteRoutine,
  purgeRoutineNow,
  restoreRoutine,
  setRoutineFamily,
  updateRoutine,
} from "./routines"

// Abläufe aus dem Browser: Sitzung, Tagebuch eingeschaltet, Kennungen der Form nach; die Regeln stehen in `routines.ts`.

async function guard(): Promise<{ userId: string } | { error: string }> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  if (!(await diarySettings(db, userId)).enabled) return { error: ERRORS.off }
  return { userId }
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64 && /^[a-z0-9]+$/i.test(value)

function done(error: string | null): ActionResult {
  if (error) return { error }
  revalidatePath("/diary", "layout")
  revalidatePath("/profile", "layout")
  return { success: true }
}

export async function createRoutineAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard()
  if ("error" in g) return g
  const result = await createRoutine(db, g.userId, input)
  if ("fieldErrors" in result) return { error: result.fieldErrors }
  if ("error" in result) return result
  revalidatePath("/diary", "layout")
  return { success: true, data: { id: result.id } }
}

export async function updateRoutineAction(
  routineId: string,
  input: { name: string; text: string }
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(routineId) || typeof input?.name !== "string" || typeof input?.text !== "string")
    return { error: ERRORS.failed }
  const result = await updateRoutine(db, g.userId, routineId, input)
  if (result && "fieldErrors" in result) return { error: result.fieldErrors }
  return done(result?.error ?? null)
}

export async function setRoutineFamilyAction(
  routineId: string,
  familyId: number | null
): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(routineId) || (familyId !== null && !isRowId(familyId))) return { error: ERRORS.failed }
  return done(await setRoutineFamily(db, g.userId, routineId, familyId))
}

export async function deleteRoutineAction(routineId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(routineId)) return { error: ERRORS.failed }
  return done(await deleteRoutine(db, g.userId, routineId))
}

export async function restoreRoutineAction(routineId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(routineId)) return { error: ERRORS.failed }
  return done(await restoreRoutine(db, g.userId, routineId))
}

export async function purgeRoutineNowAction(routineId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(routineId)) return { error: ERRORS.failed }
  return done(await purgeRoutineNow(db, g.userId, routineId))
}
