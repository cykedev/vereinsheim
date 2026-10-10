import type { Metadata } from "next"

import { periodStateFromRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_PROGRESS, routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"
import { lightPeriodModel, periodModel } from "@vereinsheim/shot-ui/period/model"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import { ProgressScreen } from "@/components/progress/ProgressScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { marksOfCards, ownerCards } from "@/lib/db/reads"
import { pageContext } from "@/lib/page-context"
import { familiesOf, listable } from "@/lib/pages"
import { searchOf } from "@/lib/search"

export const metadata: Metadata = { title: "Fortschritt" }

// Fortschritt: die Seite eines Zeitraums über die eigenen Scheiben einer Familie. Filter stehen in der Adresse; die Seite
// rechnet `periodModel` auf dem Server aus den Projektionen (ADR-031) und gibt dem Browser das leichte Modell und die
// Lagen der Scheibe, die die Ablesung zeigt. Die Wertung ist die des Geräts.
export default async function ProgressRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const ownerId = session.user.id
  const route = routeFromUrl("/progress", searchOf(await searchParams), "")
  const query = route.page === "progress" ? route.query : DEFAULT_PROGRESS
  const [cards, context] = await Promise.all([ownerCards(db, { ownerId }), pageContext(ownerId)])
  const shown = listable(cards)
  const families = familiesOf(shown)
  // ohne Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten Scheibe
  const option = families.find((f) => f.value === query.family) ?? families[0]
  if (!option)
    return (
      <Page>
        <NoCards />
      </Page>
    )

  const state = {
    ...periodStateFromRoute({ page: "progress", query, section: null }, option.value),
    family: option.value,
    scoring: context.scoring,
  }
  const model = lightPeriodModel(
    periodModel({
      cards: shown.filter((card) => card.family?.slug === option.value),
      state,
      nowMs: context.nowMs,
      timeZone: context.timeZone,
      named: context.named,
    })
  )
  const readingId = model.reading?.card.id
  const marks = readingId ? await marksOfCards(db, { ownerId, ids: [readingId] }) : {}
  return (
    <ProgressScreen
      model={model}
      state={state}
      marks={marks}
      families={families}
      context={context}
    />
  )
}
