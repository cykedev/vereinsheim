"use server"

import { revalidatePath } from "next/cache"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { diarySettings } from "../settings"
import { ERRORS } from "../texts"
import { dayInput } from "../validation"
import {
  createGoal,
  deleteGoal,
  purgeGoalNow,
  restoreGoal,
  setGoalNote,
  setGoalOutcome,
  updateGoal,
} from "./goals"
import { goalPreview } from "./queries"
import { previewLine } from "./stand-text"
import { parseThreshold, SHOTS_MAX } from "./validation"

// Ziele aus dem Browser: Sitzung, Tagebuch eingeschaltet, Kennungen der Form nach; die Regeln stehen in `goals.ts`.
// Danach alles neu, auch Start (die Zeile zum Ziel).

async function guard(): Promise<{ userId: string; timeZone: string } | { error: string }> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  if (!(await diarySettings(db, userId)).enabled) return { error: ERRORS.off }
  return { userId, timeZone: getDisplayTimeZone() }
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64 && /^[a-z0-9]+$/i.test(value)

function done(error: string | null): ActionResult {
  if (error) return { error }
  revalidatePath("/", "layout")
  return { success: true }
}

export async function createGoalAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard()
  if ("error" in g) return g
  const result = await createGoal(db, g.userId, input)
  if ("fieldErrors" in result) return { error: result.fieldErrors }
  if ("error" in result) return result
  revalidatePath("/", "layout")
  return { success: true, data: { id: result.id } }
}

export async function updateGoalAction(goalId: string, input: unknown): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  const result = await updateGoal(db, g.userId, goalId, input)
  if (result && "fieldErrors" in result) return { error: result.fieldErrors }
  return done(result?.error ?? null)
}

export async function saveGoalNote(goalId: string, text: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  return done(await setGoalNote(db, g.userId, goalId, text))
}

export async function saveGoalOutcome(goalId: string, outcome: unknown): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  return done(await setGoalOutcome(db, g.userId, goalId, outcome))
}

export async function deleteGoalAction(goalId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  return done(await deleteGoal(db, g.userId, goalId))
}

export async function restoreGoalAction(goalId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  return done(await restoreGoal(db, g.userId, goalId))
}

export async function purgeGoalNowAction(goalId: string): Promise<ActionResult> {
  const g = await guard()
  if ("error" in g) return g
  if (!isId(goalId)) return { error: ERRORS.failed }
  return done(await purgeGoalNow(db, g.userId, goalId))
}

/** der Satz unter dem Formular; bei unvollständiger Eingabe kein Satz (`text` null), ohne zu speichern */
export async function previewGoalAction(input: {
  familyId: number
  from: string
  to: string
  measure: "card" | "series" | "average"
  threshold: string
  scoring: "rings" | "decimal"
  shots: number
  cards: "all" | "training" | "competition"
}): Promise<ActionResult<{ text: string | null }>> {
  const g = await guard()
  if ("error" in g) return g
  const threshold =
    typeof input?.threshold === "string" ? parseThreshold(input.threshold, input.scoring) : null
  const valid =
    isRowId(input?.familyId) &&
    dayInput.safeParse(input.from).success &&
    dayInput.safeParse(input.to).success &&
    input.from <= input.to &&
    ["card", "series", "average"].includes(input.measure) &&
    ["rings", "decimal"].includes(input.scoring) &&
    ["all", "training", "competition"].includes(input.cards) &&
    Number.isInteger(input.shots) &&
    input.shots >= 1 &&
    input.shots <= SHOTS_MAX &&
    threshold !== null
  if (!valid) return { success: true, data: { text: null } }
  const rule = {
    measure: input.measure,
    threshold: threshold as number,
    scoring: input.scoring,
    shots: input.shots,
    cards: input.cards,
    from: input.from,
    to: input.to,
  }
  try {
    const stand = await goalPreview(db, g.userId, input.familyId, rule, g.timeZone)
    return { success: true, data: { text: previewLine(rule, stand) } }
  } catch {
    return { success: true, data: { text: null } }
  }
}
