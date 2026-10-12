"use server"

import { revalidatePath } from "next/cache"

import { isCardId } from "@vereinsheim/shot-ui/nav/routes"

import type { CardKind } from "@/generated/prisma/client"
import { getAuthSession } from "@/lib/auth-helpers"
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
    const session = await getAuthSession()
    if (!session || session.user.mustChangePassword) return { error: "Nicht angemeldet" }
    if (!isKind(kind)) return { error: "Unbekannte Art." }
    if (typeof cardId !== "string" || cardId.length > 64 || !isCardId(cardId))
      return { error: "Die Scheibe gibt es nicht." }
    const result = await chooseCardKind(db, { cardId, ownerId: session.user.id, kind })
    if (result === "missing") return { error: "Die Scheibe gibt es nicht." }
    if (result === "probeOnly") return { error: "Eine Scheibe nur aus Probe ist Training." }
    revalidatePath("/", "layout")
    return { success: true }
  } catch {
    return { error: "Die Art ließ sich nicht speichern." }
  }
}
