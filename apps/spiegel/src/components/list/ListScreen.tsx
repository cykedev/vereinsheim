"use client"

import { useRouter } from "next/navigation"
import { useMemo } from "react"

import type { CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { CardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { EveningList } from "@vereinsheim/shot-ui/list/EveningList"
import { ListControls } from "@vereinsheim/shot-ui/list/ListControls"
import { ListHeader } from "@vereinsheim/shot-ui/list/ListHeader"
import { listOnEvening, openCard, progressFromList } from "@vereinsheim/shot-ui/nav/navigate"
import { urlFromRoute, type ListQuery, type ListRoute } from "@vereinsheim/shot-ui/nav/routes"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"

/**
 * Die Scheiben nach Abend (N2, N7): Filter aus der Adresse (`/cards?family=…&range=…#Abend`), das Modell hat die Seite
 * auf dem Server gerechnet (`cardListModel` aus den Projektionen), die Bausteine aus `shot-ui/list`. Ein Filter schreibt
 * die Adresse neu (Zurück findet ihn wieder), und die Seite rechnet neu.
 */
export function ListScreen({
  list,
  query,
  families,
  context,
}: {
  /** null ohne Scheiben */
  list: { model: CardListModel; marks: Record<string, CardMark[]>; option: FamilyOption } | null
  query: ListQuery
  families: FamilyOption[]
  context: PageContext
}) {
  const router = useRouter()
  const { timeZone, scoring } = context
  const route: ListRoute = { page: "cards", query, evening: null }
  const marks = useMemo(() => marksById(list?.marks ?? {}), [list?.marks])
  // öffnen in der Wertung, die die Zeile vorn zeigt (die amtliche, sonst die des Geräts)
  const resultScoring = useMemo(
    () =>
      new Map<string, Scoring>(
        (list?.model.evenings ?? []).flatMap((e) => e.rows.map((r) => [r.id, r.resultScoring]))
      ),
    [list?.model]
  )
  if (!list)
    return (
      <Page>
        <NoCards />
      </Page>
    )

  const { model, option } = list
  const onQuery = (next: ListQuery) =>
    router.push(urlFromRoute({ page: "cards", query: next, evening: null }))
  const cardRoute = (id: string) => openCard(route, id, resultScoring.get(id) ?? scoring)

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
          marks={marks}
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
