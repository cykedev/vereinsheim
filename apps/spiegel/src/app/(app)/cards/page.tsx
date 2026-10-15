import type { Metadata } from "next"

import { DEFAULT_LIST, routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { ListScreen } from "@/components/list/ListScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { listPageData } from "@/lib/overview"
import { pageContext } from "@/lib/page-context"
import { searchOf } from "@/lib/search"

export const metadata: Metadata = { title: "Scheiben" }

// Scheiben: die eigenen nach Abend. Filter stehen in der Adresse; die Seite liest sie und rechnet die Liste auf dem
// Server aus den Projektionen (ADR-031). An den Browser gehen das Modell und die Lagen der gezeigten Scheiben.
export default async function CardsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const search = searchOf(await searchParams)
  const route = routeFromUrl("/cards", search, "")
  const query = route.page === "cards" ? route.query : DEFAULT_LIST
  const context = await pageContext(session.user.id)
  const { list, families } = await listPageData(db, session.user.id, query, context)
  // was markiert ist (Abend aus dem Anker, Scheibe aus `pick`), liest die Hülle aus der Adresse
  return (
    <ListScreen
      list={list}
      query={query}
      serverSearch={search}
      families={families}
      context={context}
    />
  )
}
