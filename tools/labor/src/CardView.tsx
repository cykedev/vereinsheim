import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import {
  AnalysisPanel,
  ANALYSIS_TABS,
  type AnalysisTab,
} from "@vereinsheim/shot-ui/analysis/AnalysisPanel"
import { analysisInput } from "@vereinsheim/shot-ui/analysis/input"
import { observations } from "@vereinsheim/shot-ui/analysis/observations"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"
import { HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { CardPage } from "@vereinsheim/shot-ui/layout/CardPage"
import { NoShots } from "@vereinsheim/shot-ui/layout/NoShots"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { hashFor, parseHash } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { MetricTiles } from "@vereinsheim/shot-ui/metrics/MetricTiles"
import { CardHeader } from "@vereinsheim/shot-ui/readout/CardHeader"
import { CardResult } from "@vereinsheim/shot-ui/readout/CardResult"
import { ShotLine } from "@vereinsheim/shot-ui/readout/ShotLine"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { ShotTable } from "@vereinsheim/shot-ui/table/ShotTable"
import { CardContextBar } from "@vereinsheim/shot-ui/nav/CardContextBar"
import { contextCardIds, neighbours } from "@vereinsheim/shot-ui/nav/context"
import { backLabel, backRoute, siblingRoute } from "@vereinsheim/shot-ui/nav/navigate"
import { urlFromRoute, type CardRoute } from "@vereinsheim/shot-ui/nav/routes"
import { defaultWhole, probeOnlyAsMatch, shotLabels } from "@vereinsheim/shot-ui/shots"
import { TargetControls, type Others } from "@vereinsheim/shot-ui/target/TargetControls"
import { TargetView } from "@vereinsheim/shot-ui/target/TargetView"
import type { SeriesKey } from "@vereinsheim/shot-ui/types"
import { initialViewState, viewReducer, type Layer } from "@vereinsheim/shot-ui/view-state"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { useCallback, useEffect, useMemo, useReducer, useState, type MouseEvent } from "react"

import { LaborPanel, type LaborPanelProps } from "./LaborPanel"

import { rawSample, SAMPLES, toMetricShots, type RawShot, type SampleId } from "./samples"
import { NAMED_PERIODS, season, SEASON_NOW_MS, SEASON_TIME_ZONE } from "./season"
import { loadAnchor } from "./loadAnchor"
import { store } from "./store"
import { exposeForTest, underTest } from "./testHook"

type Mode = "view" | "set"

/** die Schüsse einer Karte, wie die Bausteine sie bekommen: nur Probe ist Training und zeigt sich wie Wertung */
const cardShots = (targetId: TargetId, raw: readonly RawShot[]) =>
  probeOnlyAsMatch(toMetricShots(TARGETS[targetId], raw))

/** Anker in die Adresse schreiben, ohne zu scrollen; in der Skriptprüfung bleibt `#pruefen` stehen */
function writeHash(hash: string) {
  if (underTest()) return
  try {
    history.replaceState(null, "", hash)
  } catch {
    // ohne Verlauf (eingebettet) gilt der Anker nur bis zum Neuladen
  }
}

/** einen Abschnitt ins Bild holen: nach dem Laden mit Anker (die Seite entsteht erst im Browser, der eigene
 * Sprung des Browsers findet nichts) und nach einem Reiter-Anker */
function showSection(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }))
}

/** eine Scheibe aus der Saison, geöffnet aus der Seite eines Zeitraums, mit ihrer Adresse (Plan N1) */
export interface OpenedCard {
  id: string
  label: string
  target: TargetId
  raw: RawShot[]
  route: CardRoute
  /** amtliche Wertung der Scheibe, als Hinweis am Schalter */
  official?: Scoring
  /** Metazeile im Kopf: Art, Datum, Uhrzeit (`cardMeta`) */
  meta: string[]
}

export interface CardViewProps {
  /** die Angaben für die Labor-Werkzeuge ohne Umschalter und Hinweis */
  header: Omit<LaborPanelProps, "children" | "hint" | "address">
  explain: boolean
  onExplain: (explain: boolean) => void
  onHelp: (helpId: string | null) => void
  /** eine Scheibe aus der Saison statt eines Beispiels */
  opened?: OpenedCard | null
}

/**
 * Die Seite einer Scheibe im Labor (bis L3 die ganze App): Beispiele oder eine Scheibe aus der Saison, Ansehen und
 * Setzen, Anker, Analyse. Der Zustand gilt je Scheibe; die Seite eines Zeitraums hält ihren eigenen in `App`.
 */
export function CardView({ header, explain, onExplain, onHelp, opened = null }: CardViewProps) {
  const [targetId, setTargetId] = useState<TargetId>(opened?.target ?? "lp-10m")
  const [sampleId, setSampleId] = useState<SampleId>("forty")
  const [raw, setRaw] = useState<RawShot[]>(() => opened?.raw ?? rawSample("lp-10m", "forty"))
  const [mode, setMode] = useState<Mode>("view")
  const [setKind, setSetKind] = useState<RawShot["kind"]>("match")
  const [others, setOthers] = useState<Others>("dim")
  const [pop, setPop] = useState<number | null>(null)
  // Reiter: eine Scheibe beginnt immer mit dem ersten (User, 9. Oktober 2026), nur ein Anker in der Adresse beim
  // Laden öffnet einen anderen. Kein gemerkter Reiter: der vorige stünde sonst auf der nächsten Scheibe
  const [tab, setTab] = useState<AnalysisTab>(
    () => (opened ? undefined : parseHash(loadAnchor())?.tab) ?? ANALYSIS_TABS[0].value
  )
  // der Reiter gehört erst in die Adresse, wenn er gewählt ist oder mit ihr kam: eine geöffnete Scheibe beginnt oben
  // ohne Anker, wie `openCard` sie baut (Review N1)
  const [tabInAddress, setTabInAddress] = useState(() => !opened && !!parseHash(loadAnchor())?.tab)
  const [state, dispatch] = useReducer(viewReducer, undefined, () => {
    // Grundauswahl der ersten Karte: ohne Probe, wenn es Probe und Wertung gibt
    const home = defaultWhole(
      cardShots(opened?.target ?? "lp-10m", opened?.raw ?? rawSample("lp-10m", "forty"))
    )
    return initialViewState({
      selection: home,
      home,
      // eine aus dem Zeitraum geöffnete Scheibe übernimmt dessen Wertung (D6), sonst die gemerkte (Review N1)
      scoring: opened
        ? opened.route.scoring
        : store.get("scoring") === "rings"
          ? "rings"
          : "decimal",
      layers: {
        mpi: store.get("mpi") !== "0",
        circle: store.get("circle") !== "0",
        numbers: store.get("numbers") === "1",
        ellipse: store.get("ellipse") === "1",
      },
    })
  })
  const active = useActiveSection()
  const { pill, jumpTo, back, close, hide } = useReturnJump()

  const target = TARGETS[targetId]
  // nur Probe ist Training und zeigt sich wie Wertung; erst mit Wertung trennt sich die Probe ab
  const shots = useMemo(() => cardShots(targetId, raw), [targetId, raw])
  const samples = SAMPLES[targetId]
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0]
  useEffect(() => exposeForTest(shots, state, target), [shots, state, target])
  // ein Satz im Kopf: der erste Satz der ersten Beobachtung der Analyse
  const sentence = useMemo(() => {
    const first = observations(analysisInput(shots, state.scoring, target))[0]?.text
    return first ? first.split(/(?<=\.) (?=[A-ZÄÖÜ])/)[0] : null
  }, [shots, state.scoring, target])

  // Anker beim Laden: zum Abschnitt; Reiter-Anker auch beim Wechsel der Adresse: Reiter öffnen, zur Analyse
  useEffect(() => {
    const follow = () => {
      const anchor = parseHash(location.hash)
      if (!anchor?.tab) return
      setTab(anchor.tab)
      showSection(anchor.section)
    }
    // nur ein Anker beim Laden springt (`loadAnchor`): Nach einem Wechsel der Ansicht trägt die Adresse noch den Anker
    // der vorigen Seite (Sprungleiste, Reiter), die Scheibe beginnt dann oben; eine geöffnete Scheibe immer
    const onLoad = opened ? null : parseHash(loadAnchor())
    if (onLoad) showSection(onLoad.section)
    addEventListener("hashchange", follow)
    return () => removeEventListener("hashchange", follow)
  }, [])

  const load = (nextTarget: TargetId, nextSample: SampleId) => {
    const available = SAMPLES[nextTarget]
    const chosen = available.find((s) => s.id === nextSample) ?? available[0]
    setTargetId(nextTarget)
    setSampleId(chosen.id)
    const nextRaw = rawSample(nextTarget, chosen.id)
    setRaw(nextRaw)
    setPop(null)
    hide()
    dispatch({ type: "reset", home: defaultWhole(cardShots(nextTarget, nextRaw)) })
  }

  const place = (event: MouseEvent<HTMLDivElement>) => {
    if (mode !== "set") return
    const svg = event.currentTarget.querySelector("svg")
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    // auf 1/100 mm wie bei Meyton; y zeigt in der Scheibe nach oben
    const shot: RawShot = {
      xUm: Math.round((p.x * 1000) / 10) * 10,
      yUm: Math.round((-p.y * 1000) / 10) * 10,
      firedAtMs: (raw.at(-1)?.firedAtMs ?? Date.UTC(2026, 9, 2, 17, 0)) + 45_000,
      kind: setKind,
    }
    setRaw([...raw, shot])
    setPop(raw.length)
  }

  // stabile Rückrufe: die Analyse rechnet ihre Karten nur neu, wenn sich ihre Eingaben ändern
  const toggle = useCallback(
    (layer: Layer) => {
      store.set(layer, state.layers[layer] ? "0" : "1")
      dispatch({ type: "toggle", layer })
    },
    [state.layers]
  )
  const choose = useCallback(
    (index: number, series: SeriesKey | null) => dispatch({ type: "choose", shot: index, series }),
    []
  )
  // was außerhalb der Scheibe die Scheibe ändert, holt sie ins Bild, mit dem Weg zurück (D6)
  const toggleFromAnalysis = useCallback(
    (layer: Layer) => {
      toggle(layer)
      jumpTo(document.querySelector('[data-section="target"]'), "Lage")
    },
    [toggle, jumpTo]
  )
  // „Auf der Scheibe“ im Lineal eines Diagramms: den Schuss zeigen (wählt ohne Umschalten, weitet bei Bedarf die
  // Auswahl) und zur Scheibe springen, die Pille nennt den Reiter (Plan L1, D4)
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
    setTab(next)
    setTabInAddress(true)
    writeHash(hashFor("analysis", next))
  }, [])

  // die Adresse, die die App hätte (Plan N1): Beispiele ohne Herkunft, eine geöffnete Scheibe mit ihrer; die
  // Grundauswahl fällt weg, der Schuss steht als Nummer, der Reiter als Anker
  const route: CardRoute = {
    ...(opened?.route ?? {
      page: "card",
      id: `${targetId}-${sampleId}`,
      origin: null,
      selection: null,
      shot: null,
      scoring: "decimal",
      anchor: null,
    }),
    selection: state.selection === state.home ? null : state.selection,
    shot: state.chosen ? (shotLabels(shots)[state.chosen.index] ?? null) : null,
    scoring: state.scoring,
    anchor: tabInAddress ? { section: "analysis", tab } : null,
  }
  // Rückweg und Blättern im Kontext (Plan N3, D5): die Scheiben, aus denen sie geöffnet wurde, in zeitlicher Folge
  const contextIds = useMemo(
    () =>
      opened
        ? contextCardIds(opened.route, {
            cards: season().map((c) => ({ card: c.card, family: c.family })),
            nowMs: SEASON_NOW_MS,
            timeZone: SEASON_TIME_ZONE,
            named: NAMED_PERIODS,
          })
        : null,
    [opened]
  )
  const near = opened && contextIds ? neighbours(contextIds, opened.id) : null
  const backText = backLabel(route, { named: NAMED_PERIODS, timeZone: SEASON_TIME_ZONE })

  const empty = shots.length === 0
  const scoringSwitch = (
    <ScoringSwitch
      scoring={state.scoring}
      official={opened ? opened.official : sample.official}
      onChange={(scoring) => {
        store.set("scoring", scoring)
        dispatch({ type: "setScoring", scoring })
      }}
    />
  )
  // auf dem Telefon im Kopf, ab 768 px als Box über der Ablesung
  const result = <CardResult shots={shots} state={state} scoring={scoringSwitch} />

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      {opened && (
        <CardContextBar
          back={backRoute(route)}
          backText={backText}
          prev={near?.prev ? siblingRoute(route, near.prev) : null}
          next={near?.next ? siblingRoute(route, near.next) : null}
          paging={contextIds !== null}
        />
      )}

      <CardPage
        header={
          <CardHeader
            title={target.label}
            meta={opened ? opened.meta : [sample.label]}
            result={empty ? null : result}
            sentence={sentence}
          />
        }
        nav={<SectionNav active={active} />}
        result={result}
        empty={empty ? <NoShots /> : undefined}
        target={
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-3.5">
            {/* höchstens so groß, dass sie mit den Serien darunter ins Fenster passt (`--target-max` aus CardPage),
                sonst wenigstens allein: 3,5rem Leiste, 1,875rem Rahmen der Karte, etwas Luft (D5, D9) */}
            <div
              id="target-box"
              data-target-box
              className="relative mx-auto aspect-square w-full max-w-[var(--target-max,calc(100svh-6.5rem))] overflow-hidden rounded-xl bg-surface-2"
              style={{ cursor: mode === "set" ? "crosshair" : undefined }}
              onClick={place}
            >
              <TargetView
                className="block size-full"
                target={target}
                shots={shots}
                state={state}
                others={others}
                popIndex={pop}
                viewKey={opened ? opened.id : `${targetId}:${sample.id}`}
                onChoose={mode === "view" ? choose : undefined}
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
            {/* je Karte eine neue Leiste, wie in der App beim Wechsel der Session */}
            <SeriesStrip
              key={`${targetId}:${sample.id}`}
              target={target}
              shots={shots}
              state={state}
              onSelect={(series) => dispatch({ type: "select", series })}
              onSelectWhole={(whole) => dispatch({ type: "selectWhole", whole })}
            />
          </div>
        }
        aside={
          // die Ablesung als Karte erst ab 768 px, auf dem Telefon die Ablesezeile an der Scheibe; was die
          // ganze Scheibe zusammenfasst, steht im Kopf
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
                {/* ab 768 px höchstens bis zur Unterkante der Serien, dann scrollt sie in sich; mit wenigen
                    Schüssen nur so hoch wie ihre Zeilen */}
                <ShotTable
                  key={`${targetId}:${sample.id}`}
                  className="md:min-h-0"
                  shots={shots}
                  state={state}
                  onChoose={chooseFromTable}
                />
              </div>
            ),
          },
        ]}
        below={[
          {
            id: "numbers",
            node: (
              <MetricTiles
                shots={shots}
                state={state}
                explain={explain}
                onHelp={(key) => onHelp(helpForMetric(key)?.id ?? null)}
                action={
                  <ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={onExplain}>
                    Erklärungen
                  </ToggleChip>
                }
              />
            ),
          },
          {
            id: "analysis",
            node: (
              <AnalysisPanel
                // je Karte neu eingehängt: das Lineal fängt ohne Wahl an
                key={`${targetId}:${sample.id}`}
                shots={shots}
                state={state}
                target={target}
                tab={tab}
                onTab={changeTab}
                explain={explain}
                onToggleLayer={toggleFromAnalysis}
                onHelp={onHelp}
                onChoose={chooseFromAnalysis}
              />
            ),
          },
        ]}
      />
      <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
      {/* zuletzt: der Knopf steht unten rechts, also auch zuletzt in der Tab-Folge (Review) */}
      <LaborPanel
        {...header}
        address={urlFromRoute(route)}
        hint={opened ? `${opened.label} aus der erfundenen Saison.` : sample.hint}
        active={mode === "set" ? "Setzen" : undefined}
      >
        {opened ? null : (
          <>
            <Segmented
              label="Scheibe"
              value={targetId}
              options={[
                { value: "lp-10m", label: "Luftpistole" },
                { value: "lg-10m", label: "Luftgewehr" },
              ]}
              onChange={(id) => load(id, sampleId)}
            />
            <Segmented
              label="Beispiel"
              value={sample.id}
              options={samples.map((s) => ({ value: s.id, label: s.label }))}
              onChange={(id) => load(targetId, id)}
            />
          </>
        )}
        {/* nur im Labor: die App setzt keine Schüsse */}
        <Segmented
          label="Tippen"
          value={mode}
          options={[
            { value: "view", label: "Ansehen" },
            { value: "set", label: "Setzen" },
          ]}
          onChange={setMode}
        />
        {mode === "set" && (
          <Segmented
            label="Neuer Schuss"
            value={setKind}
            options={[
              { value: "match", label: "Wertung" },
              { value: "probe", label: "Probe" },
            ]}
            onChange={setSetKind}
          />
        )}
      </LaborPanel>
    </div>
  )
}
