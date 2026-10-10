"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"

import { TARGETS } from "@vereinsheim/shot-core/targets"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { EveningList } from "@vereinsheim/shot-ui/list/EveningList"
import { ListControls } from "@vereinsheim/shot-ui/list/ListControls"
import { ListHeader } from "@vereinsheim/shot-ui/list/ListHeader"
import { listOnEvening, openCard, progressFromList } from "@vereinsheim/shot-ui/nav/navigate"
import {
  DEFAULT_LIST,
  routeFromUrl,
  urlFromRoute,
  type ListQuery,
  type ListRoute,
} from "@vereinsheim/shot-ui/nav/routes"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import type { PageCard } from "@/lib/db/reads"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"

/**
 * Die Scheiben nach Abend (N2, N7): Filter aus der Adresse (`/cards?family=…&range=…#Abend`), alles Gerechnete aus
 * `cardListModel`, die Bausteine aus `shot-ui/list`. Ein Filter schreibt die Adresse neu (Zurück findet ihn wieder).
 */
export function ListScreen({
  cards,
  families,
  context,
}: {
  cards: PageCard[]
  families: FamilyOption[]
  context: PageContext
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { timeZone, nowMs, named, scoring } = context
  const query: ListQuery = useMemo(() => {
    // nicht `search.size`: fehlt in Safari vor 17 (Review)
    const qs = search.toString()
    const parsed = routeFromUrl(pathname, qs ? `?${qs}` : "", "")
    return parsed.page === "cards" ? parsed.query : DEFAULT_LIST
  }, [pathname, search])
  // ohne Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten Scheibe; die Adresse bleibt, wie sie ist
  const option = families.find((f) => f.value === query.family) ?? families[0]
  const family = option?.value ?? null
  const route: ListRoute = { page: "cards", query, evening: null }

  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const model = useMemo(
    () =>
      cardListModel(
        cards.map((card) => ({ card, family: card.family!.slug })),
        { ...query, family },
        { timeZone, nowMs, named, scoring }
      ),
    [cards, query, family, timeZone, nowMs, named, scoring]
  )
  const onQuery = (next: ListQuery) =>
    router.push(urlFromRoute({ page: "cards", query: next, evening: null }))
  // öffnen in der Wertung, die die Zeile vorn zeigt (die amtliche, sonst die des Geräts)
  const cardRoute = (id: string) => openCard(route, id, byId.get(id)?.official ?? scoring)

  if (!option)
    return (
      <Page>
        <NoCards />
      </Page>
    )

  return (
    <Page>
      <section data-card-list-page className="grid max-w-4xl gap-4">
        <ListHeader
          familyLabel={option.label}
          cards={model.cards}
          controls={
            <ListControls
              query={query}
              family={option.value}
              families={families}
              flags={model.flags}
              rangeLabel={model.range?.label ?? null}
              onQuery={onQuery}
              progress={progressFromList(route, scoring)}
            />
          }
        />
        <EveningList
          model={model}
          cards={byId}
          target={TARGETS[option.targetId]}
          families={families}
          timeZone={timeZone}
          cardRoute={cardRoute}
          otherFamilyRoute={(other, day) => listOnEvening(query, other, day)}
        />
      </section>
    </Page>
  )
}
