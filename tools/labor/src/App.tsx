import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import {
  AnalysisPanel,
  ANALYSIS_TABS,
  type AnalysisTab,
} from "@vereinsheim/shot-ui/analysis/AnalysisPanel"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"
import { HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { HelpDetails } from "@vereinsheim/shot-ui/help/HelpDetails"
import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { MetricTiles } from "@vereinsheim/shot-ui/metrics/MetricTiles"
import { CardSummary } from "@vereinsheim/shot-ui/readout/CardSummary"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { ShotTable } from "@vereinsheim/shot-ui/table/ShotTable"
import { defaultWhole, probeOnlyAsMatch } from "@vereinsheim/shot-ui/shots"
import { TargetView } from "@vereinsheim/shot-ui/target/TargetView"
import type { SeriesKey } from "@vereinsheim/shot-ui/types"
import { initialViewState, viewReducer, type Layer } from "@vereinsheim/shot-ui/view-state"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { useEffect, useMemo, useReducer, useState, type MouseEvent } from "react"

import { rawSample, SAMPLES, toMetricShots, type RawShot, type SampleId } from "./samples"
import { exposeForTest } from "./testHook"

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

const LAYERS: readonly [Layer, string][] = [
  ["mpi", "Schwerpunkt"],
  ["circle", "Streukreis"],
  ["numbers", "Nummern"],
  ["ellipse", "Vertrauensellipse"],
]

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

export function App({ commit }: { commit: string }) {
  const [targetId, setTargetId] = useState<TargetId>("lp-10m")
  const [sampleId, setSampleId] = useState<SampleId>("forty")
  const [raw, setRaw] = useState<RawShot[]>(() => rawSample("lp-10m", "forty"))
  const [mode, setMode] = useState<Mode>("view")
  const [setKind, setSetKind] = useState<RawShot["kind"]>("match")
  const [others, setOthers] = useState<"dim" | "hide">("dim")
  const [pop, setPop] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>(() => (store.get("theme") as Theme | null) ?? "system")
  const [explain, setExplain] = useState(() => store.get("help") === "1")
  const [helpId, setHelpId] = useState<string | null>(null)
  const [tab, setTab] = useState<AnalysisTab>(() => {
    const saved = store.get("tab")
    return ANALYSIS_TABS.find((t) => t.value === saved)?.value ?? "overview"
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

  const target = TARGETS[targetId]
  // nur Probe ist Training und zeigt sich wie Wertung; erst mit Wertung trennt sich die Probe ab
  const shots = useMemo(() => cardShots(targetId, raw), [targetId, raw])
  const samples = SAMPLES[targetId]
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0]
  useEffect(() => exposeForTest(shots, state, target), [shots, state, target])

  const load = (nextTarget: TargetId, nextSample: SampleId) => {
    const available = SAMPLES[nextTarget]
    const chosen = available.find((s) => s.id === nextSample) ?? available[0]
    setTargetId(nextTarget)
    setSampleId(chosen.id)
    const nextRaw = rawSample(nextTarget, chosen.id)
    setRaw(nextRaw)
    setPop(null)
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

  const toggle = (layer: Layer) => {
    store.set(layer, state.layers[layer] ? "0" : "1")
    dispatch({ type: "toggle", layer })
  }

  const choose = (index: number, series: SeriesKey | null) =>
    dispatch({ type: "choose", shot: index, series })

  const changeTab = (next: AnalysisTab) => {
    store.set("tab", next)
    setTab(next)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-7 px-4 pt-7 pb-14">
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
          einer Kachel erklärt die Zahl.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
            Stand {commit}
          </span>
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
            Design 2
          </span>
        </div>
      </header>

      <section className="grid gap-4" aria-label="Scheibe">
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
        </div>

        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {LAYERS.map(([layer, label]) => (
                  <ToggleChip
                    key={layer}
                    pressed={state.layers[layer]}
                    onPressedChange={() => toggle(layer)}
                  >
                    {label}
                  </ToggleChip>
                ))}
              </div>
              <Segmented
                label="Ausschnitt"
                value={state.view}
                options={[
                  { value: "target", label: "Scheibe" },
                  { value: "group", label: "Gruppe" },
                ]}
                onChange={(view) => dispatch({ type: "setView", view })}
              />
            </div>
            <div
              id="target-box"
              className="relative aspect-square max-w-full overflow-hidden rounded-xl bg-surface-2"
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <Segmented
                label="Übrige Schüsse"
                value={others}
                options={[
                  { value: "dim", label: "Übrige blass" },
                  { value: "hide", label: "Übrige aus" },
                ]}
                onChange={setOthers}
              />
            </div>
            <p className="text-[13px] text-muted-foreground">{sample.hint}</p>
            <HelpDetails id="trefferbild" open={explain} />
          </div>

          <aside className="grid content-start gap-4">
            <div id="readout" className="rounded-2xl border border-border bg-card p-4">
              <ShotReadout shots={shots} state={state} />
            </div>
            <div id="summary" className="grid gap-3 rounded-2xl border border-border bg-card p-4">
              <ScoringSwitch
                scoring={state.scoring}
                official={sample.official}
                onChange={(scoring) => {
                  store.set("scoring", scoring)
                  dispatch({ type: "setScoring", scoring })
                }}
              />
              <CardSummary shots={shots} state={state} />
            </div>
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
            <div id="shot-table" className="rounded-2xl border border-border bg-card p-2">
              <ShotTable className="md:max-h-80" shots={shots} state={state} onChoose={choose} />
            </div>
          </aside>
        </div>
      </section>

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
      <AnalysisPanel
        shots={shots}
        state={state}
        target={target}
        tab={tab}
        onTab={changeTab}
        explain={explain}
        onToggleLayer={toggle}
        onHelp={setHelpId}
      />
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </div>
  )
}
