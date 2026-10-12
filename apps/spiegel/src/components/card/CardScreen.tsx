"use client"

import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react"

import type { MetricShot, Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import {
  AnalysisPanel,
  ANALYSIS_TABS,
  type AnalysisTab,
} from "@vereinsheim/shot-ui/analysis/AnalysisPanel"
import { analysisInput } from "@vereinsheim/shot-ui/analysis/input"
import { keyObservations, observations } from "@vereinsheim/shot-ui/analysis/observations"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"
import { HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { CardPage } from "@vereinsheim/shot-ui/layout/CardPage"
import { NoShots } from "@vereinsheim/shot-ui/layout/NoShots"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { hashFor, parseHash } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { CardContextBar } from "@vereinsheim/shot-ui/nav/CardContextBar"
import { backLabel, backRoute, siblingRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { urlFromRoute, type CardRoute } from "@vereinsheim/shot-ui/nav/routes"
import { cardMeta } from "@vereinsheim/shot-ui/readout/cardMeta"
import { CardHeader } from "@vereinsheim/shot-ui/readout/CardHeader"
import { CardResult } from "@vereinsheim/shot-ui/readout/CardResult"
import { ShotLine } from "@vereinsheim/shot-ui/readout/ShotLine"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { asOnPrintout, shotLabels } from "@vereinsheim/shot-ui/shots"
import { ShotTable } from "@vereinsheim/shot-ui/table/ShotTable"
import { TargetControls, type Others } from "@vereinsheim/shot-ui/target/TargetControls"
import type { TargetDisplay } from "@vereinsheim/shot-ui/target/display"
import { TargetView } from "@vereinsheim/shot-ui/target/TargetView"
import type { SeriesKey } from "@vereinsheim/shot-ui/types"
import {
  initialViewState,
  viewReducer,
  type Layer,
  type ViewState,
} from "@vereinsheim/shot-ui/view-state"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"

import { Page } from "@/components/shell/Page"
import { useHelp } from "@/components/shell/HelpContext"
import { nextCardAddress } from "@/lib/card-address"
import type { PageCard } from "@/lib/db/reads"
import { rememberScoring } from "@/lib/device-client"
import { rememberTargetDisplay } from "@/lib/target-display-client"
import type { PageContext } from "@/lib/page-context"

/** einen Abschnitt ins Bild holen (nach dem Laden mit Anker und nach einem Reiter-Anker) */
function showSection(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }))
}

/** der Anker der Adresse, mit Wechseln (`hashchange`); auf dem Server und beim Hydrieren leer */
const subscribeHash = (listener: () => void) => {
  window.addEventListener("hashchange", listener)
  return () => window.removeEventListener("hashchange", listener)
}
const useHash = () =>
  useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => ""
  )

/**
 * der Zustand der Ansicht aus der Adresse (Wertung, Serie, gewählter Schuss als Nummer wie `shotLabels`) und den Ebenen
 * der gemerkten Darstellung
 */
function stateFromRoute(
  route: CardRoute,
  shots: readonly MetricShot[],
  display: TargetDisplay
): ViewState {
  let state = initialViewState({ scoring: route.scoring, layers: display.layers })
  if (route.selection !== null)
    state = viewReducer(state, { type: "select", series: route.selection })
  const index = route.shot ? shotLabels(shots).indexOf(route.shot) : -1
  if (index >= 0)
    state = viewReducer(state, { type: "choose", shot: index, series: route.selection })
  return state
}

/**
 * Die Seite einer Scheibe (N7): wie im Labor (`CardView`), mit der Scheibe aus der Datenbank. Wertung, Serie und
 * Schuss stehen in der Adresse (Reload und Zurück finden sie wieder), der Reiter der Analyse im Anker; Rückweg und
 * Blättern im Kontext der Herkunft rechnet der Server (`near`).
 */
export function CardScreen({
  card,
  route: initialRoute,
  near,
  paging,
  context: pageContext,
  display,
}: {
  card: PageCard
  route: CardRoute
  near: { prev: string | null; next: string | null } | null
  paging: boolean
  context: PageContext
  /** die gemerkte Darstellung der Scheibe (Cookie), Anfang der Ebenen und von „übrige blass/aus“ */
  display: TargetDisplay
}) {
  const onHelp = useHelp()
  const target = TARGETS[card.targetId ?? "lp-10m"]
  // wie am Ausdruck (U4): mit Wertung nur die Wertung, nur Probe zeigt sich wie Wertung
  const shots = useMemo(() => asOnPrintout(card.shots), [card.shots])
  // die ganze Karte als Kontext für Abstände: eine Probe zwischen Wertung reißt keine Lücke (SF-04)
  const context = card.shots

  const [state, dispatch] = useReducer(viewReducer, undefined, () =>
    stateFromRoute(initialRoute, shots, display)
  )
  const [others, setOthers] = useState<Others>(display.others)
  // jede Änderung der Darstellung ist die neue Voreinstellung (User, 12. Oktober 2026)
  useEffect(() => {
    rememberTargetDisplay({ layers: state.layers, others })
  }, [state.layers, others])
  const [explain, setExplain] = useState(false)
  const hash = useHash()
  // der Reiter: gewählt, sonst aus dem Anker beim Laden, sonst der erste (eine Scheibe beginnt mit ihm)
  const [chosenTab, setChosenTab] = useState<AnalysisTab | null>(null)
  // der zuletzt im Anker gesehene Reiter bleibt, wenn die Sprungleiste „#shots“ schreibt (Review)
  const hashTab = parseHash(hash)?.tab ?? null
  const [seenTab, setSeenTab] = useState<AnalysisTab | null>(null)
  if (hashTab && hashTab !== seenTab) setSeenTab(hashTab)
  const tab: AnalysisTab = chosenTab ?? hashTab ?? seenTab ?? ANALYSIS_TABS[0].value
  const active = useActiveSection()
  const { pill, jumpTo, back, close } = useReturnJump()

  // im Kopf die wichtigsten Beobachtungen der Analyse, die Lage zuerst (U1)
  const headObservations = useMemo(
    () => keyObservations(observations(analysisInput(shots, state.scoring, target, context))),
    [shots, state.scoring, target, context]
  )

  // Anker beim Laden: zum Abschnitt
  useEffect(() => {
    const anchor = parseHash(window.location.hash)
    if (anchor) showSection(anchor.section)
  }, [])

  // die Adresse, wie sie den Zustand beschreibt; ohne Neuladen nachgeführt, damit Reload und Zurück ihn finden
  const route: CardRoute = {
    ...initialRoute,
    selection: state.selection === "all" ? null : state.selection,
    shot: state.chosen ? (shotLabels(shots)[state.chosen.index] ?? null) : null,
    scoring: state.scoring,
    anchor: chosenTab ? { section: "analysis", tab: chosenTab } : null,
  }
  const address = urlFromRoute(route)
  const anchorChosen = route.anchor !== null
  useEffect(() => {
    const next = nextCardAddress(window.location, address, anchorChosen)
    if (next) window.history.replaceState(null, "", next)
  }, [address, anchorChosen])

  const toggle = useCallback((layer: Layer) => dispatch({ type: "toggle", layer }), [])
  const choose = useCallback(
    (index: number, series: SeriesKey | null) => dispatch({ type: "choose", shot: index, series }),
    []
  )
  // was außerhalb der Scheibe die Scheibe ändert, holt sie ins Bild, mit dem Weg zurück
  const toggleFromAnalysis = useCallback(
    (layer: Layer) => {
      toggle(layer)
      jumpTo(document.querySelector('[data-section="target"]'), "Lage")
    },
    [toggle, jumpTo]
  )
  const chooseFromAnalysis = useCallback(
    (index: number, series: SeriesKey | null) => {
      dispatch({ type: "show", shot: index, series })
      jumpTo(
        document.querySelector('[data-section="target"]'),
        ANALYSIS_TABS.find((t) => t.value === tab)?.label ?? "Analyse"
      )
    },
    [jumpTo, tab]
  )
  const chooseFromTable = useCallback(
    (index: number, series: SeriesKey | null) => {
      choose(index, series)
      jumpTo(document.querySelector('[data-section="target"]'), "Schüsse")
    },
    [choose, jumpTo]
  )
  const changeTab = useCallback((next: AnalysisTab) => {
    setChosenTab(next)
    window.history.replaceState(null, "", hashFor("analysis", next))
  }, [])
  const changeScoring = (scoring: Scoring) => {
    rememberScoring(scoring)
    dispatch({ type: "setScoring", scoring })
  }

  const empty = shots.length === 0
  const scoringSwitch = (
    <ScoringSwitch scoring={state.scoring} official={card.official} onChange={changeScoring} />
  )
  // auf dem Telefon im Kopf, ab 768 px als Box über der Ablesung
  const result = <CardResult shots={shots} state={state} scoring={scoringSwitch} />

  return (
    <Page>
      <CardContextBar
        back={backRoute(route)}
        backText={backLabel(route, { named: pageContext.named, timeZone: pageContext.timeZone })}
        prev={near?.prev ? siblingRoute(route, near.prev) : null}
        next={near?.next ? siblingRoute(route, near.next) : null}
        paging={paging}
      />

      <CardPage
        header={
          <CardHeader
            title={target.label}
            meta={cardMeta(card, pageContext.timeZone)}
            result={empty ? null : result}
            observations={headObservations}
            onMore={() => {
              // „Alle Beobachtungen“: der Überblick der Analyse, an der Karte „Beobachtungen“
              changeTab("overview")
              setTimeout(() => {
                document
                  .querySelector('[data-card="beobachtungen"]')
                  ?.scrollIntoView({ block: "start" })
                document
                  .querySelector<HTMLElement>(
                    'section[aria-label="Analyse"] [role="radio"][aria-checked="true"]'
                  )
                  ?.focus({ preventScroll: true })
              })
            }}
          />
        }
        nav={<SectionNav active={active} />}
        result={result}
        empty={empty ? <NoShots /> : undefined}
        target={
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-3.5">
            <div
              id="target-box"
              data-target-box
              className="relative mx-auto aspect-square w-full max-w-[var(--target-max,calc(100svh-6.5rem))] overflow-hidden rounded-xl bg-surface-2"
            >
              <TargetView
                className="block size-full"
                target={target}
                shots={shots}
                state={state}
                others={others}
                popIndex={null}
                viewKey={card.id}
                onChoose={choose}
              />
              <TargetControls
                state={state}
                others={others}
                onToggle={toggle}
                onView={(view) => dispatch({ type: "setView", view })}
                onOthers={setOthers}
                onHelp={() => onHelp("trefferbild")}
              />
            </div>
            <ShotLine className="md:hidden" shots={shots} state={state} />
          </div>
        }
        under={
          <div id="series" className="grid gap-4 rounded-2xl border border-border bg-card p-3.5">
            <SeriesStrip
              target={target}
              shots={shots}
              state={state}
              onSelect={(series) => dispatch({ type: "select", series })}
              onSelectWhole={(whole) => dispatch({ type: "selectWhole", whole })}
            />
          </div>
        }
        aside={
          <div id="readout" className="rounded-2xl border border-border bg-card p-4 max-md:hidden">
            <ShotReadout shots={shots} state={state} />
          </div>
        }
        beside={[
          {
            id: "shots",
            node: (
              <div
                id="shot-table"
                className="rounded-2xl border border-border bg-card p-2 md:flex md:max-h-full md:flex-col"
              >
                <ShotTable
                  className="md:min-h-0"
                  shots={shots}
                  context={context}
                  state={state}
                  onChoose={chooseFromTable}
                />
              </div>
            ),
          },
        ]}
        below={[
          {
            id: "analysis",
            node: (
              <AnalysisPanel
                shots={shots}
                context={context}
                state={state}
                target={target}
                tab={tab}
                onTab={changeTab}
                explain={explain}
                onToggleLayer={toggleFromAnalysis}
                onHelp={onHelp}
                onChoose={chooseFromAnalysis}
                action={
                  <ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={setExplain}>
                    Erklärungen
                  </ToggleChip>
                }
              />
            ),
          },
        ]}
      />
      <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
    </Page>
  )
}
