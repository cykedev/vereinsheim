"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

/**
 * Legt das nächste Duell in einem PlayoffMatch an.
 * Wird für VF/HF aufgerufen wenn der Admin ein weiteres Duell starten will.
 */
export async function addPlayoffDuel(
  playoffMatchId: string
): Promise<ActionResult<{ duelId: string }>> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const match = await db.playoffMatch.findUnique({
    where: { id: playoffMatchId },
    select: {
      id: true,
      status: true,
      competitionId: true,
      duels: { orderBy: { duelNumber: "desc" }, take: 1, select: { duelNumber: true } },
    },
  })

  if (!match) return { error: "Playoff-Paarung nicht gefunden." }
  if (match.status === "COMPLETED")
    return { error: "Diese Playoff-Paarung ist bereits abgeschlossen." }

  const nextDuelNumber = (match.duels[0]?.duelNumber ?? 0) + 1

  try {
    const duel = await db.playoffDuel.create({
      data: {
        playoffMatchId,
        duelNumber: nextDuelNumber,
        isSuddenDeath: false,
      },
      select: { id: true },
    })

    // No revalidatePath for the playoffs route here: the client refreshes via
    // router.refresh(). A bundled revalidation re-render competes with that
    // client refresh and leaves the inline card stale until a second action.
    return { success: true, data: { duelId: duel.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Anlegen des Duells:", msg)
    return { error: "Duell konnte nicht angelegt werden." }
  }
}
