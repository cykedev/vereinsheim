import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { CardSummary } from "@vereinsheim/shot-ui/readout/CardSummary"
import { ShotReadout } from "@vereinsheim/shot-ui/readout/ShotReadout"
import { SeriesStrip } from "@vereinsheim/shot-ui/series/SeriesStrip"
import { TargetView } from "@vereinsheim/shot-ui/target/TargetView"
import { initialViewState, viewReducer, type Layer } from "@vereinsheim/shot-ui/view-state"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { useEffect, useMemo, useReducer, useState, type MouseEvent } from "react"

import { rawSample, SAMPLES, toMetricShots, type RawShot, type SampleId } from "./samples"

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
  const [state, dispatch] = useReducer(viewReducer, undefined, () =>
    initialViewState({
      scoring: store.get("scoring") === "rings" ? "rings" : "decimal",
      adjustAfter: SAMPLES["lp-10m"][0].adjustAfter,
      layers: {
        mpi: store.get("mpi") !== "0",
        circle: store.get("circle") !== "0",
        numbers: store.get("numbers") === "1",
        ellipse: store.get("ellipse") === "1",
      },
    })
  )
  useTheme(theme)

  const target = TARGETS[targetId]
  const shots = useMemo(() => toMetricShots(target, raw), [target, raw])
  const samples = SAMPLES[targetId]
  const sample = samples.find((s) => s.id === sampleId) ?? samples[0]

  const load = (nextTarget: TargetId, nextSample: SampleId) => {
    const available = SAMPLES[nextTarget]
    const chosen = available.find((s) => s.id === nextSample) ?? available[0]
    setTargetId(nextTarget)
    setSampleId(chosen.id)
    setRaw(rawSample(nextTarget, chosen.id))
    setPop(null)
    dispatch({ type: "reset", adjustAfter: chosen.adjustAfter })
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
          Die Scheibe und die Serien hier sind die echten Bausteine aus{" "}
          <code>packages/shot-ui</code>, mit dem Fachkern gerechnet. Tippe auf eine Serie, um nur
          sie zu sehen, auf einen Treffer, um ihn abzulesen, oder setze im Modus „Setzen“ eigene
          Schüsse.
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
            label="Wertung"
            value={state.scoring}
            options={[
              { value: "decimal", label: "Zehntel" },
              { value: "rings", label: "Ganze Ringe" },
            ]}
            onChange={(scoring) => {
              store.set("scoring", scoring)
              dispatch({ type: "setScoring", scoring })
            }}
          />
          <Segmented
            label="Thema"
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
                onChoose={
                  mode === "view"
                    ? (index, series) => dispatch({ type: "choose", shot: index, series })
                    : undefined
                }
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
          </div>

          <aside className="grid content-start gap-4">
            <div id="readout" className="rounded-2xl border border-border bg-card p-4">
              <ShotReadout shots={shots} state={state} />
            </div>
            <div id="summary" className="rounded-2xl border border-border bg-card p-4">
              <CardSummary shots={shots} state={state} />
            </div>
          </aside>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3.5">
          {/* je Karte eine neue Leiste, wie in der App beim Wechsel der Session */}
          <SeriesStrip
            key={`${targetId}:${sample.id}`}
            target={target}
            shots={shots}
            state={state}
            onSelect={(series) => dispatch({ type: "select", series })}
            onSelectAll={() => dispatch({ type: "selectAll" })}
          />
        </div>
      </section>
    </div>
  )
}
