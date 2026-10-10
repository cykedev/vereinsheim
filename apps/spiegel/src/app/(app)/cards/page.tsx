import type { Metadata } from "next"

import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { DEFAULT_LIST, routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { ListScreen } from "@/components/list/ListScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { marksOfCards, ownerCards } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { familiesOf, listable, withFamily } from "@/lib/pages"
import { searchOf } from "@/lib/search"

export const metadata: Metadata = { title: "Scheiben" }

// Scheiben: die eigenen nach Abend. Filter stehen in der Adresse; die Seite liest sie und rechnet die Liste auf dem
// Server aus den Projektionen (ADR-031, SP-1.8). An den Browser gehen das Modell und die Lagen der gezeigten Scheiben.
export default async function CardsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const ownerId = session.user.id
  const route = routeFromUrl("/cards", searchOf(await searchParams), "")
  const query = route.page === "cards" ? route.query : DEFAULT_LIST
  const [cards, context] = await Promise.all([ownerCards(db, { ownerId }), pageContext(ownerId)])
  const shown = listable(cards)
  const families = familiesOf(shown)
  // ohne Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten Scheibe; die Adresse bleibt
  const option = families.find((f) => f.value === query.family) ?? families[0]
  if (!option) return <ListScreen list={null} query={query} families={families} context={context} />

  const model = cardListModel(
    withFamily(shown),
    { ...query, family: option.value },
    {
      timeZone: context.timeZone,
      nowMs: context.nowMs,
      named: context.named,
      scoring: context.scoring,
    }
  )
  const ids = model.evenings.flatMap((evening) => evening.rows.map((row) => row.id))
  const marks = await marksOfCards(db, { ownerId, ids })
  return (
    <ListScreen
      list={{ model, marks, option }}
      query={query}
      families={families}
      context={context}
    />
  )
}
