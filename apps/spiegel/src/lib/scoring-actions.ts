"use server"

import { revalidatePath } from "next/cache"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { isCardId } from "@vereinsheim/shot-ui/nav/routes"

import { getAuthSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { chooseCardScoring, saveFamilyScoring } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

// Wertung umschalten und automatisch speichern (Plan `plans/2026-10-12-spiegel-wertung.md`): auf der Seite einer Scheibe
// die der Scheibe, in Liste und Fortschritt die der Familie. Nur eigene Scheiben, auch für Admins. Danach rechnen die
// Seiten neu (`revalidatePath`); Liste und Start zeigen vorn die Wertung der Scheibe.

const isScoring = (value: unknown): value is Scoring => value === "decimal" || value === "rings"

/** die Sitzung eines Schützen, der Daten sehen darf; ohne Sitzung oder mit Passwort vom Admin null */
async function shooter() {
  const session = await getAuthSession()
  return session && !session.user.mustChangePassword ? session.user.id : null
}

/** die gewählte Wertung einer eigenen Scheibe speichern */
export async function setCardScoring(cardId: string, scoring: Scoring): Promise<ActionResult> {
  try {
    const ownerId = await shooter()
    if (!ownerId) return { error: "Nicht angemeldet" }
    if (!isScoring(scoring)) return { error: "Unbekannte Wertung." }
    if (typeof cardId !== "string" || cardId.length > 64 || !isCardId(cardId))
      return { error: "Die Scheibe gibt es nicht." }
    if (!(await chooseCardScoring(db, { cardId, ownerId, scoring })))
      return { error: "Die Scheibe gibt es nicht." }
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
    const ownerId = await shooter()
    if (!ownerId) return { error: "Nicht angemeldet" }
    if (!isScoring(scoring)) return { error: "Unbekannte Wertung." }
    if (typeof familySlug !== "string" || familySlug.length > 64)
      return { error: "Die Familie gibt es nicht." }
    if (!(await saveFamilyScoring(db, { familySlug, ownerId, scoring })))
      return { error: "Die Familie gibt es nicht." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Die Wertung ließ sich nicht speichern." }
  }
}
