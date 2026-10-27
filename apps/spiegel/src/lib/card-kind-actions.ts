"use server"

import type { CardKind } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { chooseCardKind } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

// Art der Scheibe festlegen und automatisch speichern: Wettkampf oder Training, nur eigene Scheiben, auch für Admins.
// Die Art ändert Filter, Rekorde und ob der Umschalter die Wertung „amtlich“ nennt, bei einer Scheibe nur aus Probe auch,
// ob die Wertung der Disziplin gilt (`officialOf`); danach rechnen die Seiten neu, über `router.refresh()` in `useSavedChoice` (kein `revalidatePath`: nach ihm scrollt Next zum Anker der Adresse).

const isKind = (value: unknown): value is CardKind =>
  value === "training" || value === "competition"

/** die gewählte Art einer eigenen Scheibe speichern, auch einer nur aus Probe */
export async function setCardKind(cardId: string, kind: CardKind): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isKind(kind)) return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: "Diese Scheibe gibt es nicht mehr." }
    const result = await chooseCardKind(db, { cardId, ownerId, kind })
    if (result === "missing") return { error: "Diese Scheibe gibt es nicht mehr." }
    return { success: true }
  } catch {
    return { error: "Die Art ließ sich nicht speichern." }
  }
}
