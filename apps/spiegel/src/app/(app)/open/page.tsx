import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { OpenScreen } from "@/components/open/OpenScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { marksOfCards, pendingFirstCards } from "@/lib/db/reads"
import { pendingItems } from "@/lib/open"

export const metadata: Metadata = { title: "Offen" }

// Offen: je SportpassID die älteste wartende Scheibe zum Bestätigen; gerechnet auf dem Server
export default async function OpenRoute() {
  const session = await requireSession()
  const pending = await pendingFirstCards(db, session.user.id)
  const marks = await marksOfCards(db, {
    ownerId: session.user.id,
    ids: pending.map((p) => p.card.id),
    pending: true,
  })
  return <OpenScreen items={pendingItems(pending, getDisplayTimeZone())} marks={marks} />
}
