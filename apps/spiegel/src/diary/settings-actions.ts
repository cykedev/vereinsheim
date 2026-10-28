"use server"

import { revalidatePath } from "next/cache"

import { shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { markNoticeSeen, setDiaryEnabled } from "./settings"
import { ERRORS } from "./texts"

// Einstellung des Tagebuchs aus dem Browser: nur das eigene Konto, danach der ganze Rahmen neu (die Leiste ändert sich)

export async function setDiaryEnabledAction(enabled: boolean): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  if (typeof enabled !== "boolean") return { error: ERRORS.failed }
  try {
    await setDiaryEnabled(db, userId, enabled)
  } catch {
    return { error: ERRORS.failed }
  }
  revalidatePath("/", "layout")
  return { success: true }
}

/** der Hinweis beim ersten Öffnen ist gelesen */
export async function markNoticeSeenAction(): Promise<ActionResult> {
  const userId = await shooterId()
  if (!userId) return { error: ERRORS.session }
  try {
    await markNoticeSeen(db, userId)
  } catch {
    return { error: ERRORS.failed }
  }
  revalidatePath("/diary")
  return { success: true }
}
