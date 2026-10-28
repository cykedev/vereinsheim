"use server"

import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import type { ActionResult } from "@/lib/types"

import { VISIBLE_CARD } from "./db/visible"
import { normalizePlace } from "./entered/details"
import { TEXTS } from "./entered/form"

// Ort einer Scheibe ohne Brücke ändern ([[adr-033]]): nur eigene, sichtbare Scheiben vom Ausdruck oder eingetragene;
// eine Scheibe der Anlage hat ihren Ort über die Anlage. Danach rechnet die Seite über `router.refresh()` neu.

/** den Ort als Freitext speichern; leer heißt keiner */
export async function setCardPlace(cardId: string, place: string): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: "Diese Scheibe gibt es nicht mehr." }
    const normalized = normalizePlace(typeof place === "string" ? place : "")
    if (!normalized.ok) return { error: { place: [TEXTS.place] } }
    const { count } = await db.card.updateMany({
      where: {
        id: cardId,
        ownerId,
        ...VISIBLE_CARD,
        origin: { in: ["pdf", "manual", "treffsicher"] },
      },
      data: { place: normalized.place ?? null },
    })
    if (count === 0) return { error: "Diese Scheibe gibt es nicht mehr." }
    return { success: true }
  } catch {
    return { error: "Der Ort ließ sich nicht speichern." }
  }
}
