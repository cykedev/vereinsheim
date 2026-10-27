"use server"

import { revalidatePath } from "next/cache"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { dismissRequest } from "./queries"

// Aufträge per ID: Der Schütze beendet einen ungefüllten Auftrag. Jede Action prüft selbst und gibt ein ActionResult
// zurück.

/** einen eigenen, ungefüllten Auftrag zurückziehen; Scheibe und Ausdruck bleiben */
export async function removeCardRequest(requestId: number): Promise<ActionResult> {
  try {
    const userId = await shooterId()
    if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isRowId(requestId) || !(await dismissRequest(db, { userId, requestId })))
      return { error: "Dieser Auftrag lässt sich nicht entfernen. Lade die Seite neu." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Der Auftrag ließ sich nicht entfernen." }
  }
}
