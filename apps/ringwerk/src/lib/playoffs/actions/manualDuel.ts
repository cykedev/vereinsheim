"use server"

import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { addNextDuel, playoffFailureMessage } from "./duelMutations"

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

  try {
    const duelId = await addNextDuel(playoffMatchId)

    // No revalidatePath for the playoffs route here: the client refreshes via
    // router.refresh(). A bundled revalidation re-render competes with that
    // client refresh and leaves the inline card stale until a second action.
    return { success: true, data: { duelId } }
  } catch (error) {
    return { error: playoffFailureMessage(error, "Duell konnte nicht angelegt werden.") }
  }
}
