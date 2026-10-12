import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { contextCardIds, neighbours } from "@vereinsheim/shot-ui/nav/context"
import { routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { CardScreen } from "@/components/card/CardScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { cardWithShots, ownerCards } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { listable, withFamily } from "@/lib/pages"
import { searchOf } from "@/lib/search"
import { targetDisplay } from "@/lib/target-display"

export const metadata: Metadata = { title: "Scheibe" }

// Seite einer Scheibe: nur die eigene; Rückweg und Blättern im Kontext der Herkunft (Liste, Start, Fortschritt)
export default async function CardRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const { id } = await params
  const ownerId = session.user.id
  const card = await cardWithShots(db, { cardId: id, ownerId })
  if (!card?.targetId) notFound()

  const route = routeFromUrl(`/cards/${encodeURIComponent(id)}`, searchOf(await searchParams), "")
  if (route.page !== "card") notFound()
  const context = await pageContext(ownerId)
  // der Kontext zum Blättern aus den Projektionen der eigenen Scheiben (ohne Schüsse), nur mit Herkunft
  const ids =
    route.origin === null
      ? null
      : contextCardIds(route, {
          cards: withFamily(listable(await ownerCards(db, { ownerId }))),
          nowMs: context.nowMs,
          timeZone: context.timeZone,
          named: context.named,
        })
  return (
    <CardScreen
      card={card}
      route={route}
      near={ids ? neighbours(ids, id) : null}
      paging={ids !== null}
      context={context}
      display={await targetDisplay()}
    />
  )
}
