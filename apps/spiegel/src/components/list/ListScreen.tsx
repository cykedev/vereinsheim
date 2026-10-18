"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useReducer, useSyncExternalStore } from "react"

import type { CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import type { CardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { EveningList } from "@vereinsheim/shot-ui/list/EveningList"
import { ScoringChip } from "@vereinsheim/shot-ui/controls/ScoringChip"
import { ListControls } from "@vereinsheim/shot-ui/list/ListControls"
import { ListHeader } from "@vereinsheim/shot-ui/list/ListHeader"
import { listOnEvening, openCard, progressFromList } from "@vereinsheim/shot-ui/nav/navigate"
import {
  isCardId,
  routeFromUrl,
  urlFromRoute,
  type ListQuery,
  type ListRoute,
} from "@vereinsheim/shot-ui/nav/routes"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@vereinsheim/ui/design2/page"
import { useSavedChoice } from "@/components/shell/useSavedChoice"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"
import { setFamilyScoring } from "@/lib/scoring-actions"

/**
 * auf Änderungen der Adresse hören: der Anker (`hashchange`), Zurück und Vor (`popstate`) und, wo es sie gibt, jede
 * Navigation über die Navigation API (auch `pushState` mit nur neuem Anker)
 */
function subscribeLocation(onChange: () => void) {
  // die Navigation API meldet synchron, auch aus dem `useInsertionEffect`, in dem Next die Adresse schreibt; dort darf
  // React nicht neu zeichnen, deshalb erst danach
  const later = () => queueMicrotask(onChange)
  window.addEventListener("hashchange", onChange)
  window.addEventListener("popstate", onChange)
  const navigation = (window as { navigation?: EventTarget }).navigation
  navigation?.addEventListener("currententrychange", later)
  return () => {
    window.removeEventListener("hashchange", onChange)
    window.removeEventListener("popstate", onChange)
    navigation?.removeEventListener("currententrychange", later)
  }
}

/** solange die Liste noch steht, die Adresse aber schon die nächste Seite trägt, gilt sie nicht */
const onList = () => window.location.pathname === "/cards"

/**
 * Die Scheiben nach Abend: Filter aus der Adresse (`/cards?family=…&range=…#Abend`), das Modell hat die Seite
 * auf dem Server gerechnet (`cardListModel` aus den Projektionen), die Bausteine aus `shot-ui/list`. Ein Filter schreibt
 * die Adresse neu (Zurück findet ihn wieder), und die Seite rechnet neu. Vorn steht die Wertung jeder Scheibe; Ø und
 * Abstand rechnen in der Wertung der Familie, der Schalter speichert sie (`setFamilyScoring`), danach rechnet die Seite
 * neu (`router.refresh()` in `useSavedChoice`, ohne zu scrollen).
 */
export function ListScreen({
  list,
  query,
  serverSearch,
  families,
  context,
}: {
  /** null ohne Scheiben */
  list: { model: CardListModel; marks: Record<string, CardMark[]>; option: FamilyOption } | null
  query: ListQuery
  /** die Abfrage der Adresse, wie der Server sie sah (für das erste Bild) */
  serverSearch: string
  families: FamilyOption[]
  context: PageContext
}) {
  const router = useRouter()
  const { timeZone } = context
  const route: ListRoute = { page: "cards", query, evening: null }
  // die Wertung der Familie (Ø und Abstand) als Kreis neben dem Titel; die fette Spalte gehört der Scheibe
  const family = list?.option.value ?? ""
  const familyScoring = useSavedChoice({
    value: list?.model.scoring ?? "decimal",
    scope: family,
    save: (scoring) => setFamilyScoring(family, scoring),
    notSaved: "Die Wertung ließ sich nicht speichern.",
  })
  const marks = useMemo(() => marksById(list?.marks ?? {}), [list?.marks])
  // wohin man kam, aus der Adresse im Browser (sie ist maßgeblich, auch nach Zurück): der Abend aus dem Anker (den sieht
  // der Server nicht) und die Scheibe aus `pick`
  // nach jeder neuen Seite vom Server die Adresse noch einmal lesen: Beim Zeichnen der neuen Seite steht sie noch nicht,
  // und ohne Navigation API meldet das kein Ereignis
  const [, reread] = useReducer((n: number) => n + 1, 0)
  useEffect(() => reread(), [list?.model, serverSearch])
  const hash = useSyncExternalStore(
    subscribeLocation,
    () => (onList() ? window.location.hash : ""),
    () => ""
  )
  const evening = useMemo(() => {
    const route = routeFromUrl("/cards", "", hash)
    return route.page === "cards" ? route.evening : null
  }, [hash])
  // `pick` aus `location`, nicht aus `useSearchParams`: Nach Zurück im Browser stellt Next die gespeicherte Seite mit
  // ihrer alten Abfrage her, die Adresse trägt aber die Scheibe, von der man kam. Beim Hydrieren gilt die Abfrage vom
  // Server, damit das HTML passt
  const search = useSyncExternalStore(
    subscribeLocation,
    () => (onList() ? window.location.search : serverSearch),
    () => serverSearch
  )
  const pick = useMemo(() => {
    const picked = new URLSearchParams(search).get("pick")
    return picked && isCardId(picked) ? picked : null
  }, [search])
  // die Scheibe, von der man kam, ins Bild, wenn sie es nicht schon ist (sonst bleibt die Stelle des Browsers)
  useEffect(() => {
    if (!pick) return
    const row = document.querySelector(`[data-card-row="${CSS.escape(pick)}"]`)
    const rect = row?.getBoundingClientRect()
    if (row && rect && (rect.top < 0 || rect.bottom > window.innerHeight))
      row.scrollIntoView({ block: "center" })
  }, [pick])

  if (!list)
    return (
      <Page>
        <NoCards />
      </Page>
    )

  const { model, option } = list
  const onQuery = (next: ListQuery) =>
    router.push(urlFromRoute({ page: "cards", query: next, evening: null }))
  // eine Scheibe öffnet in ihrer Wertung
  const cardRoute = (id: string) => openCard(route, id)

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
              lists={model.lists}
              rangeLabel={model.range?.label ?? null}
              onQuery={onQuery}
              progress={progressFromList(route)}
              // die Wertung der Familie als Wechsel-Chip neben dem Filter: Sie gilt für Ø und Abstand, nicht für die
              // Ergebnisse
              actions={
                <ScoringChip
                  scoring={familyScoring.shown}
                  texts={{ rings: "Ø in ganzen Ringen", decimal: "Ø in Zehnteln" }}
                  label="Wertung für Ø und Abstand"
                  onChange={familyScoring.change}
                />
              }
            />
          }
        />
        {familyScoring.error && (
          <p role="alert" className="text-sm text-destructive">
            {familyScoring.error}
          </p>
        )}
        <EveningList
          model={model}
          marks={marks}
          target={TARGETS[option.targetId]}
          families={families}
          timeZone={timeZone}
          cardRoute={cardRoute}
          otherFamilyRoute={(other, day) => listOnEvening(query, other, day)}
          evening={evening}
          pick={pick}
          onOpen={(id) =>
            // vor dem Öffnen die Scheibe in die Adresse der Liste: Zurück im Browser markiert dann sie
            window.history.replaceState(null, "", urlFromRoute({ ...route, pick: id }))
          }
        />
      </section>
    </Page>
  )
}
