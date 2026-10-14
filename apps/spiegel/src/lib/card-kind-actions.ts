"use server"

import { revalidatePath } from "next/cache"

import type { CardKind } from "@/generated/prisma/client"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { chooseCardKind } from "@/lib/db/cards"
import type { ActionResult } from "@/lib/types"

// Art der Scheibe festlegen und automatisch speichern (Plan `plans/2026-10-12-spiegel-art.md`): Wettkampf oder Training,
// nur eigene Scheiben, auch für Admins. Die Art ändert Filter, Rekorde und die Vorgabe der Wertung (Wettkampf in der
// amtlichen); danach rechnen die Seiten neu.

const isKind = (value: unknown): value is CardKind =>
  value === "training" || value === "competition"

/** die gewählte Art einer eigenen Scheibe speichern; eine Scheibe nur aus Probe bleibt Training */
export async function setCardKind(cardId: string, kind: CardKind): Promise<ActionResult> {
  try {
    const ownerId = await shooterId()
    if (!ownerId) return { error: "Das geht gerade nicht. Lade die Seite neu." }
    if (!isKind(kind)) return { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    if (!isCardIdInput(cardId)) return { error: "Diese Scheibe gibt es nicht mehr." }
    const result = await chooseCardKind(db, { cardId, ownerId, kind })
    if (result === "missing") return { error: "Diese Scheibe gibt es nicht mehr." }
    if (result === "probeOnly") return { error: "Eine Scheibe nur aus Probe ist Training." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Die Art ließ sich nicht speichern." }
  }
}
