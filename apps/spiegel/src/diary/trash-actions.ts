"use server"

import { revalidatePath } from "next/cache"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { diarySettings } from "./settings"
import { ERRORS } from "./texts"
import { deleteEntry, purgeEntryNow, restoreEntry } from "./trash"

// Papierkorb der Einträge aus dem Browser: nur eigene, Tagebuch eingeschaltet; danach Tagebuch, Start, Scheiben neu

async function run(
  change: (userId: string, timeZone: string) => Promise<string | null>
): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  if (!(await diarySettings(db, userId)).enabled) return { error: ERRORS.off }
  let error: string | null
  try {
    error = await change(userId, getDisplayTimeZone())
  } catch {
    return { error: ERRORS.failed }
  }
  if (error) return { error }
  revalidatePath("/", "layout")
  return { success: true }
}

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 64

export async function deleteEntryAction(entryId: string): Promise<ActionResult> {
  if (!isId(entryId)) return { error: ERRORS.missing }
  return run((userId) => deleteEntry(db, userId, entryId))
}

export async function restoreEntryAction(entryId: string): Promise<ActionResult> {
  if (!isId(entryId)) return { error: ERRORS.missing }
  return run((userId, timeZone) => restoreEntry(db, userId, entryId, timeZone))
}

export async function purgeEntryNowAction(entryId: string): Promise<ActionResult> {
  if (!isId(entryId)) return { error: ERRORS.missing }
  return run((userId) => purgeEntryNow(db, userId, entryId))
}
