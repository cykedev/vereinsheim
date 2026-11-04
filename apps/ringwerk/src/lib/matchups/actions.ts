"use server"

import { revalidatePath } from "next/cache"
import { isConflict, serializable } from "@/lib/serializable"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { replaceSchedule } from "./replaceSchedule"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"

/**
 * Generiert den Spielplan für einen aktiven Wettkampf, oder generiert ihn neu, solange kein Ergebnis erfasst ist.
 * Voraussetzungen und Sperre stehen in `replaceSchedule`.
 */
export async function generateCompetitionSchedule(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  // Bricht Postgres die Transaktion wegen einer gleichzeitigen Änderung ab (auch einer Einschreibung oder eines
  // Spielplans in einem anderen Wettbewerb), läuft sie mit dem neuen Stand noch einmal (`serializable`).
  let problem: string | null
  try {
    problem = await serializable((tx) => replaceSchedule(tx, competitionId, session.user.id))
  } catch (error) {
    if (isConflict(error)) {
      return {
        error:
          "Der Spielplan wurde gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.",
      }
    }
    console.error("Spielplan-Generierung fehlgeschlagen:", error)
    return { error: "Spielplan konnte nicht generiert werden. Bitte erneut versuchen." }
  }
  if (problem) return { error: problem }

  revalidatePath(`/competitions/${competitionId}/schedule`)
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePublicPdf(competitionId)

  return { success: true }
}
