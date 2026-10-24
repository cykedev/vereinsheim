"use server"

import { revalidatePath } from "next/cache"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { formatIsoDate } from "@vereinsheim/lib/format"

import { isRowId, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { parseCardId } from "./id"
import { requestCard, requestSiteId, withdrawRequest } from "./queries"

// Scheibe per ID holen (Profil): Der Schütze nennt die ID vom Ausdruck und den Tag der Scheibe; Spiegel legt einen
// Auftrag an, den die Brücke beim nächsten Durchgang erfüllt. Jede Action prüft selbst und gibt ein ActionResult zurück.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** was nach dem Anfragen geschah, für den Satz unter dem Formular */
export type CardRequestOutcome =
  { kind: "created" } | { kind: "exists"; cardId: string; deleted: boolean } | { kind: "pending" }

/** ein Tag, den es gibt, nicht nach heute (in der Anzeige-Zone) */
function validDay(day: unknown): day is string {
  if (typeof day !== "string" || !ISO_DAY.test(day)) return false
  const at = new Date(`${day}T12:00:00Z`)
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) return false
  return day <= formatIsoDate(new Date(), getDisplayTimeZone())
}

/** einen Auftrag anlegen: ID wie auf dem Ausdruck, Tag der Scheibe */
export async function requestCardAction(
  id: string,
  day: string
): Promise<ActionResult<CardRequestOutcome>> {
  try {
    const userId = await shooterId()
    if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    const parsed = typeof id === "string" ? parseCardId(id) : null
    const errors: Record<string, string[]> = {}
    if (!parsed)
      errors.id = ["Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck."]
    if (!validDay(day)) errors.day = ["Bitte den Tag der Scheibe wählen, nicht nach heute."]
    if (!parsed || Object.keys(errors).length) return { error: errors }
    const siteId = await requestSiteId(db)
    if (siteId === null) return { error: "Spiegel ist noch mit keiner Anlage verbunden." }
    const result = await requestCard(db, { userId, siteId, scheibenId: parsed.scheibenId, day })
    switch (result.kind) {
      case "taken":
        return { error: "Diese Scheibe gehört schon zu einem anderen Konto." }
      case "duplicate":
        return { error: "Diese Scheibe ist schon angefragt." }
      case "blocked":
        return { error: "Diese Scheibe lässt sich nicht holen." }
      case "tooMany":
        return {
          error:
            "Es sind schon zehn Scheiben angefragt. Warte, bis die Anlage sie geholt hat, oder ziehe eine zurück.",
        }
    }
    revalidatePath("/profile")
    return { success: true, data: result }
  } catch {
    return { error: "Die Scheibe ließ sich nicht anfragen." }
  }
}

/** einen eigenen, offenen Auftrag zurückziehen */
export async function withdrawCardRequest(requestId: number): Promise<ActionResult> {
  try {
    const userId = await shooterId()
    if (!userId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isRowId(requestId) || !(await withdrawRequest(db, { userId, requestId })))
      return { error: "Dieser Auftrag wartet nicht mehr. Lade die Seite neu." }
    revalidatePath("/profile")
    return { success: true }
  } catch {
    return { error: "Der Auftrag ließ sich nicht zurückziehen." }
  }
}
