"use server"

import { revalidatePath } from "next/cache"

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { chooseCardScoring, saveFamilyScoring } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

// Wertung umschalten und automatisch speichern (Plan `plans/2026-10-12-spiegel-wertung.md`): auf der Seite einer Scheibe
// die der Scheibe, in Liste und Fortschritt die der Familie. Nur eigene Scheiben, auch für Admins. Danach rechnen die
// Seiten neu (`revalidatePath`); Liste und Start zeigen vorn die Wertung der Scheibe.

const isScoring = (value: unknown): value is Scoring => value === "decimal" || value === "rings"

/** die gewählte Wertung einer eigenen Scheibe speichern */
export async function setCardScoring(cardId: string, scoring: Scoring): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isScoring(scoring))
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: "Diese Scheibe gibt es nicht mehr." }
    if (!(await chooseCardScoring(db, { cardId, ownerId, scoring })))
      return { error: "Diese Scheibe gibt es nicht mehr." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Die Wertung ließ sich nicht speichern." }
  }
}

/** die Wertung einer Familie für die Schnitte speichern, nur einer mit eigenen Scheiben */
export async function setFamilyScoring(
  familySlug: string,
  scoring: Scoring
): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isScoring(scoring))
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    if (typeof familySlug !== "string" || familySlug.length > 64)
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    if (!(await saveFamilyScoring(db, { familySlug, ownerId, scoring })))
      return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Die Wertung ließ sich nicht speichern." }
  }
}
