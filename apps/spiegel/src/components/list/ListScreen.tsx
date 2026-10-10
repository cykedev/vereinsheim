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
    const parsed = routeFromUrl(pathname, search.size ? `?${search.toString()}` : "", "")
    return parsed.page === "cards" ? parsed.query : DEFAULT_LIST
  }, [pathname, search])
  // ohne Familie in der Adresse die der neuesten Scheibe; die Adresse bleibt ohne
  const family = query.family ?? families[0]?.value ?? null
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
  const option = families.find((f) => f.value === family)
  const onQuery = (next: ListQuery) =>
    router.push(urlFromRoute({ page: "cards", query: next, evening: null }))
  // öffnen in der Wertung, die die Zeile vorn zeigt (die amtliche, sonst die des Geräts)
  const cardRoute = (id: string) => openCard(route, id, byId.get(id)?.official ?? scoring)

  if (!option)
    return (
      <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h1 className="font-display text-xl font-bold tracking-tight">Noch keine Scheiben</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sobald die Brücke deine Scheiben bringt oder du einen Ausdruck scannst, stehen sie hier.
          </p>
        </section>
      </div>
    )

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
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
    </div>
  )
}
