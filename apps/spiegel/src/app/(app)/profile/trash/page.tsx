import type { Metadata } from "next"

import { TrashScreen } from "@/components/profile/TrashScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { blockedCards, trashCards } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { blockedItems, trashItems } from "@/lib/trash-view"

export const metadata: Metadata = { title: "Papierkorb" }

// Papierkorb: eigene gelöschte Scheiben und was nicht von selbst wiederkommt; gerechnet auf dem Server
export default async function TrashRoute() {
  const session = await requireSession()
  const [{ timeZone, nowMs }, trash, blocked] = await Promise.all([
    pageContext(session.user.id),
    trashCards(db, session.user.id),
    blockedCards(db, session.user.id),
  ])
  return (
    <TrashScreen
      items={trashItems(trash, timeZone, nowMs)}
      blocked={blockedItems(blocked, timeZone)}
    />
  )
}
