import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { contextCardIds, neighbours } from "@vereinsheim/shot-ui/nav/context"
import { routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { CardScreen } from "@/components/card/CardScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { cardWithShots, ownerCardsWithShots } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { listable } from "@/lib/pages"

export const metadata: Metadata = { title: "Scheibe" }

/** die Abfrage der Adresse als Text, wie `routeFromUrl` sie liest */
function searchOf(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value])
      search.append(key, one)
  return search.size ? `?${search.toString()}` : ""
}

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
  // Übergang bis SP-1.8: der Kontext zum Blättern rechnet aus allen eigenen Scheiben
  const all = listable(await ownerCardsWithShots(db, ownerId))
  const ids = contextCardIds(route, {
    cards: all.map((c) => ({ card: c, family: c.family!.slug })),
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
    />
  )
}
