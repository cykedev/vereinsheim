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
import { KindToggle } from "@vereinsheim/shot-ui/controls/KindToggle"
import { ScoringToggle } from "@vereinsheim/shot-ui/controls/ScoringToggle"
import { probeOnlyShots } from "@vereinsheim/shot-ui/period/model"
import { cardMeta } from "@vereinsheim/shot-ui/readout/cardMeta"
import { CardHeader } from "@vereinsheim/shot-ui/readout/CardHeader"
import { CardResult } from "@vereinsheim/shot-ui/readout/CardResult"
import { ShotLine } from "@vereinsheim/shot-ui/readout/ShotLine"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { asOnPrintout, shotLabels } from "@vereinsheim/shot-ui/shots"
import { ShotTable } from "@vereinsheim/shot-ui/table/ShotTable"
import { TargetControls, type Others } from "@vereinsheim/shot-ui/target/TargetControls"
import {
  parseTargetDisplay,
  serializeTargetDisplay,
  type TargetDisplay,
} from "@vereinsheim/shot-ui/target/display"
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
import { useSavedChoice } from "@/components/shell/useSavedChoice"
import { useHelp } from "@/components/shell/HelpContext"
import { addressScoring, nextCardAddress } from "@/lib/card-address"
import type { PageCard } from "@/lib/db/reads"
import { setCardKind } from "@/lib/card-kind-actions"
import { setCardScoring } from "@/lib/scoring-actions"
import { rememberTargetDisplay, savedTargetDisplay } from "@/lib/target-display-client"

/** der Cookie meldet keine Änderung; gelesen wird bei jedem Zeichnen */
const noSubscribe = () => () => {}
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
 * der gemerkten Darstellung; ohne Wertung in der Adresse die der Scheibe
 */
function stateFromRoute(
  route: CardRoute,
  shots: readonly MetricShot[],
  display: TargetDisplay,
  scoring: Scoring
): ViewState {
  let state = initialViewState({
    scoring: route.scoring ?? scoring,
    layers: display.layers,
    view: display.view,
  })
  if (route.selection !== null)
    state = viewReducer(state, { type: "select", series: route.selection })
  const index = route.shot ? shotLabels(shots).indexOf(route.shot) : -1
  if (index >= 0)
    state = viewReducer(state, { type: "choose", shot: index, series: route.selection })
  return state
}

/**
 * Die Seite einer Scheibe (N7): wie im Labor (`CardView`), mit der Scheibe aus der Datenbank. Serie und Schuss stehen in
 * der Adresse (Reload und Zurück finden sie wieder), der Reiter der Analyse im Anker; Rückweg und Blättern im Kontext der
 * Herkunft rechnet der Server (`near`). Die Seite öffnet in der Wertung der Adresse, sonst der der Scheibe; Umschalten
 * speichert sie an der Scheibe (`setCardScoring`), die Adresse trägt sie nur, solange sie nicht die der Scheibe ist.
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
  /** die gemerkte Darstellung der Scheibe (Cookie), Anfang der Ebenen, von „übrige blass/aus“ und des Ausschnitts */
  display: TargetDisplay
}) {
  const onHelp = useHelp()
  const target = TARGETS[card.targetId ?? "lp-10m"]
  // wie am Ausdruck (U4): mit Wertung nur die Wertung, nur Probe zeigt sich wie Wertung
  const shots = useMemo(() => asOnPrintout(card.shots), [card.shots])
  // die ganze Karte als Kontext für Abstände: eine Probe zwischen Wertung reißt keine Lücke (SF-04)
  const context = card.shots

  const [state, dispatch] = useReducer(viewReducer, undefined, () =>
    stateFromRoute(initialRoute, shots, display, card.scoring)
  )
  // Die Seite folgt der Wertung der Scheibe, wenn sie sich auf dem Server ändert: Die Art verschiebt die Vorgabe
  // (Training → Wettkampf: von „wie am Stand“ auf amtlich). Eine selbst gewählte ist gespeichert und damit dieselbe
  const [seenScoring, setSeenScoring] = useState(card.scoring)
  if (card.scoring !== seenScoring) {
    setSeenScoring(card.scoring)
    dispatch({ type: "setScoring", scoring: card.scoring })
  }
  const [others, setOthers] = useState<Others>(display.others)
  // Nach Zurück und Vor bringt Next die Seite mit der Darstellung ihres ersten Besuchs (aus dem Cache, ohne Server).
  // Es gilt die gemerkte aus dem Cookie im Browser; beim Hydrieren die vom Server, damit das HTML passt (Review)
  const saved = useSyncExternalStore(noSubscribe, savedTargetDisplay, () =>
    serializeTargetDisplay(display)
  )
  // verglichen mit der Darstellung, mit der die Seite kam: beim Hydrieren gleich, nach Zurück womöglich nicht
  const [seen, setSeen] = useState(() => serializeTargetDisplay(display))
  if (saved !== seen) {
    setSeen(saved)
    const next = parseTargetDisplay(saved)
    dispatch({ type: "setLayers", layers: next.layers })
    dispatch({ type: "setView", view: next.view })
    setOthers(next.others)
  }
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
    scoring: addressScoring(state.scoring, card.scoring),
    anchor: chosenTab ? { section: "analysis", tab: chosenTab } : null,
  }
  const address = urlFromRoute(route)
  const anchorChosen = route.anchor !== null
  useEffect(() => {
    const next = nextCardAddress(window.location, address, anchorChosen)
    if (next) window.history.replaceState(null, "", next)
  }, [address, anchorChosen])

  // jede Änderung der Darstellung ist die neue Voreinstellung (User, 12. Oktober 2026); gemerkt nur beim Umschalten,
  // nie beim Öffnen: sonst überschriebe eine Seite aus dem Cache die zuletzt gewählte (Review)
  const toggle = useCallback(
    (layer: Layer) => {
      const layers = { ...state.layers, [layer]: !state.layers[layer] }
      rememberTargetDisplay({ layers, others, view: state.view })
      dispatch({ type: "toggle", layer })
    },
    [state.layers, state.view, others]
  )
  const changeOthers = useCallback(
    (next: Others) => {
      rememberTargetDisplay({ layers: state.layers, others: next, view: state.view })
      setOthers(next)
    },
    [state.layers, state.view]
  )
  const changeView = useCallback(
    (view: ViewState["view"]) => {
      rememberTargetDisplay({ layers: state.layers, others, view })
      dispatch({ type: "setView", view })
    },
    [state.layers, others]
  )
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
  // Wertung und Art: je eine Wahl für die ganze Seite, Kopf am Telefon und Box teilen sie
  const scoringChoice = useSavedChoice({
    value: state.scoring,
    scope: card.id,
    save: (scoring) => setCardScoring(card.id, scoring),
    notSaved: "Die Wertung ließ sich nicht speichern.",
    onShow: (scoring) => dispatch({ type: "setScoring", scoring }),
  })
  const kindChoice = useSavedChoice({
    value: card.kind,
    scope: card.id,
    save: (kind) => setCardKind(card.id, kind),
    notSaved: "Die Art ließ sich nicht speichern.",
  })
  const empty = shots.length === 0
  // Art und Wertung als Kreise neben der Zahl (Plan `plans/2026-10-13-spiegel-symbole.md`): gezeigt sofort, gespeichert
  // an der Scheibe. Eine Scheibe nur aus Probe ist Training und hat keinen Kreis der Art
  const actions = (
    <>
      {!probeOnlyShots(card.shots) && (
        <KindToggle kind={kindChoice.shown} onChange={kindChoice.change} />
      )}
      <ScoringToggle
        scoring={state.scoring}
        official={card.official}
        onChange={scoringChoice.change}
      />
    </>
  )
  const saveError = kindChoice.error ?? scoringChoice.error
  // auf dem Telefon im Kopf, ab 768 px als Box über der Ablesung; beide zeigen dieselbe Wahl (Review)
  const result = (
    <CardResult
      shots={shots}
      state={state}
      actions={actions}
      notice={
        saveError && (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )
      }
    />
  )

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
                onView={changeView}
                onOthers={changeOthers}
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
