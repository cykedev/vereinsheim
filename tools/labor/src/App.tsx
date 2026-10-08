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
import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { CardPage } from "@vereinsheim/shot-ui/layout/CardPage"
import { ReturnPill } from "@vereinsheim/shot-ui/layout/ReturnPill"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { hashFor, parseHash } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { useReturnJump } from "@vereinsheim/shot-ui/layout/useReturnJump"
import { MetricTiles } from "@vereinsheim/shot-ui/metrics/MetricTiles"
import { CardHeader } from "@vereinsheim/shot-ui/readout/CardHeader"
import { CardSummary } from "@vereinsheim/shot-ui/readout/CardSummary"
import { ShotLine } from "@vereinsheim/shot-ui/readout/ShotLine"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { ShotTable } from "@vereinsheim/shot-ui/table/ShotTable"
import { defaultWhole, probeOnlyAsMatch } from "@vereinsheim/shot-ui/shots"
import { TargetControls, type Others } from "@vereinsheim/shot-ui/target/TargetControls"
import { TargetView } from "@vereinsheim/shot-ui/target/TargetView"
import type { SeriesKey } from "@vereinsheim/shot-ui/types"
import { initialViewState, viewReducer, type Layer } from "@vereinsheim/shot-ui/view-state"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { useCallback, useEffect, useMemo, useReducer, useState, type MouseEvent } from "react"

import { rawSample, SAMPLES, toMetricShots, type RawShot, type SampleId } from "./samples"
import { exposeForTest, underTest } from "./testHook"

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`labor.${key}`)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(`labor.${key}`, value)
    } catch {
      // ohne Speicher gilt die Wahl nur bis zum Neuladen
    }
  },
}

type Theme = "system" | "light" | "dark"
type Mode = "view" | "set"

/** die Schüsse einer Karte, wie die Bausteine sie bekommen: nur Probe ist Training und zeigt sich wie Wertung */
const cardShots = (targetId: TargetId, raw: readonly RawShot[]) =>
  probeOnlyAsMatch(toMetricShots(TARGETS[targetId], raw))

function useTheme(theme: Theme) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches)
      )
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])
}

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

export function App({ commit }: { commit: string }) {
  const [targetId, setTargetId] = useState<TargetId>("lp-10m")
  const [sampleId, setSampleId] = useState<SampleId>("forty")
  const [raw, setRaw] = useState<RawShot[]>(() => rawSample("lp-10m", "forty"))
  const [mode, setMode] = useState<Mode>("view")
  const [setKind, setSetKind] = useState<RawShot["kind"]>("match")
  const [others, setOthers] = useState<Others>("dim")
  const [pop, setPop] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (store.get("theme") as Theme | null) ?? "system")
  const [explain, setExplain] = useState(() => store.get("help") === "1")
  const [helpId, setHelpId] = useState<string | null>(null)
  // Reiter: der Anker in der Adresse vor dem gemerkten (Plan Schritt 4, D7)
  const [tab, setTab] = useState<AnalysisTab>(() => {
    const anchored = typeof location === "undefined" ? undefined : parseHash(location.hash)?.tab
    const saved = store.get("tab")
    return anchored ?? ANALYSIS_TABS.find((t) => t.value === saved)?.value ?? "overview"
  })
  const [state, dispatch] = useReducer(viewReducer, undefined, () => {
    // Grundauswahl der ersten Karte: ohne Probe, wenn es Probe und Wertung gibt
    const home = defaultWhole(cardShots("lp-10m", rawSample("lp-10m", "forty")))
    return initialViewState({
      selection: home,
      home,
      scoring: store.get("scoring") === "rings" ? "rings" : "decimal",
      layers: {
        mpi: store.get("mpi") !== "0",
        circle: store.get("circle") !== "0",
        numbers: store.get("numbers") === "1",
        ellipse: store.get("ellipse") === "1",
      },
    })
  })
  useTheme(theme)
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
    const onLoad = parseHash(location.hash)
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
      jumpTo(document.querySelector('[data-section="scheibe"]'), "Lage")
    },
    [toggle, jumpTo]
  )
  const chooseFromTable = useCallback(
    (index: number, series: SeriesKey | null) => {
      choose(index, series)
      jumpTo(document.querySelector('[data-section="scheibe"]'), "Schüsse")
    },
    [choose, jumpTo]
  )
  const changeTab = useCallback((next: AnalysisTab) => {
    store.set("tab", next)
    setTab(next)
    writeHash(hashFor("analyse", next))
  }, [])

  const scoringSwitch = (
    <ScoringSwitch
      scoring={state.scoring}
      official={sample.official}
      onChange={(scoring) => {
        store.set("scoring", scoring)
        dispatch({ type: "setScoring", scoring })
      }}
    />
  )

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <header className="grid gap-2.5">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Spiegel · Labor
        </p>
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.3rem)] font-bold tracking-tight text-balance">
          Die Bausteine im Einsatz
        </h1>
        <p className="max-w-[46rem] text-foreground-2">
          Alles hier sind die echten Bausteine aus <code>packages/shot-ui</code>, mit dem Fachkern
          gerechnet. Tippe auf eine Serie, um nur sie zu sehen, auf einen Treffer oder eine Zeile
          der Tabelle, um ihn abzulesen, oder setze im Modus „Setzen“ eigene Schüsse. Das „?“ an
          einer Kachel oder Karte erklärt die Zahl.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
            Stand {commit}
          </span>
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
            Design 2
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Segmented
            label="Darstellung"
            value={theme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Hell" },
              { value: "dark", label: "Dunkel" },
            ]}
            onChange={(next) => {
              store.set("theme", next)
              setTheme(next)
            }}
          />
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
        </div>
        <p id="sample-hint" className="max-w-[46rem] text-[13px] text-muted-foreground">
          {sample.hint}
        </p>
      </header>

      <CardPage
        header={
          <CardHeader
            title={target.label}
            meta={[sample.label]}
            shots={shots}
            state={state}
            scoring={scoringSwitch}
            sentence={sentence}
          />
        }
        nav={<SectionNav active={active} />}
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
                viewKey={`${targetId}:${sample.id}`}
                onChoose={mode === "view" ? choose : undefined}
              />
              <TargetControls
                state={state}
                others={others}
                onToggle={toggle}
                onView={(view) => dispatch({ type: "setView", view })}
                onOthers={setOthers}
                onHelp={() => setHelpId("trefferbild")}
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
          <>
            {/* die Ablesung als Karte erst ab 768 px, auf dem Telefon die Ablesezeile an der Scheibe */}
            <div
              id="readout"
              className="rounded-2xl border border-border bg-card p-4 max-md:hidden"
            >
              <ShotReadout shots={shots} state={state} />
            </div>
            <div id="summary" className="rounded-2xl border border-border bg-card p-4">
              <CardSummary shots={shots} state={state} />
            </div>
          </>
        }
        beside={[
          {
            id: "schuesse",
            node: (
              <div
                id="shot-table"
                className="rounded-2xl border border-border bg-card p-2 md:h-full"
              >
                {/* ab 768 px so hoch wie Scheibe und Serien links, scrollt in sich */}
                <ShotTable
                  key={`${targetId}:${sample.id}`}
                  className="md:h-full"
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
            id: "zahlen",
            node: (
              <MetricTiles
                shots={shots}
                state={state}
                explain={explain}
                onHelp={(key) => setHelpId(helpForMetric(key)?.id ?? null)}
                action={
                  <ToggleChip
                    pressed={explain}
                    icon={<HelpIcon />}
                    onPressedChange={(next) => {
                      store.set("help", next ? "1" : "0")
                      setExplain(next)
                    }}
                  >
                    Erklärungen
                  </ToggleChip>
                }
              />
            ),
          },
          {
            id: "analyse",
            node: (
              <AnalysisPanel
                shots={shots}
                state={state}
                target={target}
                tab={tab}
                onTab={changeTab}
                explain={explain}
                onToggleLayer={toggleFromAnalysis}
                onHelp={setHelpId}
              />
            ),
          },
        ]}
      />
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
      <ReturnPill label={pill?.label ?? null} onReturn={back} onDismiss={close} />
    </div>
  )
}
