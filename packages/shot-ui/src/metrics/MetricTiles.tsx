"use client"

import { centroid } from "@vereinsheim/shot-core/geometry"
import {
  computeMetric,
  contextOf,
  eligibleShots,
  inScoring,
  inShotOrder,
  metricByKey,
  selectShots,
  timesInOrder,
  type MetricNeed,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { tempo } from "@vereinsheim/shot-core/time"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { directionText, formatValue, unitText } from "../format"
import { HelpButton } from "../help/HelpButton"
import { groupShots, selectionShots } from "../shots"
import type { ViewState } from "../view-state"

/** die zehn Kacheln an der Scheibe, wie in der Spielwiese nach SP-1.12 */
export const TILE_KEYS = [
  "group.enclosingDiameter",
  "group.r50",
  "group.mpiDistance",
  "group.sdX",
  "group.sdY",
  "time.intervalMedian",
  "result.decimalMean",
  "group.sigma",
  "result.tensRate",
  "time.tempoSpread",
] as const

interface HintContext {
  center: { xUm: number; yUm: number } | null
  pauses: number
  scoring: ViewState["scoring"]
}

/** kurze Angabe unter dem Wert, wie gemessen wurde */
const HINTS: Readonly<Record<string, (c: HintContext) => string>> = {
  "group.enclosingDiameter": () => "Durchmesser, Mitte zu Mitte",
  "group.r50": () => "Radius um den Schwerpunkt, in dem die Hälfte liegt, ohne Fehlschüsse",
  "group.mpiDistance": (c) => (c.center ? directionText(c.center) : ""),
  "group.sdX": () => "waagrecht",
  "group.sdY": () => "senkrecht",
  "time.intervalMedian": (c) =>
    c.pauses
      ? `${c.pauses} ${c.pauses === 1 ? "Pause" : "Pausen"} über 3 min nicht gezählt`
      : "Median der Abstände",
  "result.decimalMean": (c) => (c.scoring === "rings" ? "ganze Ringe" : "Zehntelwertung"),
  "group.sigma": () => "kaum von der Schusszahl abhängig",
  "result.tensRate": () => "Anteil der Zehner",
  "time.tempoSpread": () => "IQR der Intervalle",
}

/** was einem Schuss für eine Kennzahl fehlen kann: wie es heißt und wie es mit „nur n …“ klingt */
const NEEDS: Readonly<Record<MetricNeed, { without: string; with: string }>> = {
  time: { without: "ohne Zeiten", with: "mit Zeit" },
  position: { without: "ohne Lage", with: "mit Lage" },
  distance: { without: "ohne Teiler", with: "mit Teiler" },
  decimal: { without: "ohne Zehntel · auf ganze Ringe schalten", with: "mit Zehntel" },
  ring: { without: "ohne Ringwert", with: "mit Ringwert" },
}

type Metric = NonNullable<ReturnType<typeof metricByKey>>

/**
 * Warum es keinen Wert gibt (spiegel-ui-design „Auch – erklären“): zu wenige Schüsse, oder es fehlen
 * Daten wie Zeiten, Lage oder Zehntel (SF-18, SF-61); „ab n Schuss“ nur, wenn es wirklich an der Zahl liegt.
 */
function missingReason(metric: Metric, selected: readonly MetricShot[]): string {
  // die Probe gewählt, die Kennzahl zählt nur Wertung: kein „nur 0 zählen“ (Prüfung, Ergebnis 7)
  if (selected.length && selected.every((shot) => !metric.appliesTo.includes(shot.kind))) {
    return "zählt nur Wertungsschüsse"
  }
  if (selected.length < metric.minShots) return `ab ${metric.minShots} Schuss`
  const needs = ([] as MetricNeed[]).concat(metric.needs ?? [])
  const short = needs
    .map((need) => ({ need, n: selectShots(selected, { need }).length }))
    .sort((a, b) => a.n - b.n)[0]
  if (short && short.n < metric.minShots) {
    const text = NEEDS[short.need]
    return short.n === 0 ? text.without : `nur ${short.n} ${text.with}, ab ${metric.minShots}`
  }
  const eligible = eligibleShots(metric, selected).length
  return eligible < metric.minShots
    ? `nur ${eligible} zählen, ab ${metric.minShots} Schuss`
    : "kein Wert für diese Schüsse"
}

/**
 * Spalten, die die Kacheln ganz füllen (5, 4 oder 3), sonst 5, sobald der Bereich breit genug ist (gut 140 px
 * je Kachel): gemessen am Bereich, nicht am Fenster, sonst quetschen sie sich in eine schmale Spalte neben der
 * Scheibe. Klassen fest für Tailwind.
 */
const COLUMNS: Readonly<Record<number, string>> = {
  5: "@min-[45rem]:grid-cols-5",
  4: "@min-[36rem]:grid-cols-4",
  3: "@min-[27rem]:grid-cols-3",
}
const columnsFor = (count: number) => COLUMNS[[5, 4, 3].find((n) => count % n === 0) ?? 5]

/** σ bleibt σ: In der Großschrift der Beschriftung würde es sonst zu Σ */
function labelNode(label: string): ReactNode {
  const parts = label.split("σ")
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="normal-case">
            σ
          </span>,
          part,
        ]
  )
}

export interface MetricTilesProps {
  shots: readonly MetricShot[]
  state: ViewState
  keys?: readonly string[]
  /** „?“ an einer Kachel: Erklärung öffnen; ohne Handler kein Knopf */
  onHelp?: (key: string) => void
  /** Schalter „Erklärungen“: der Kurzsatz steht sichtbar an jeder Kachel, nicht nur als Tooltip */
  explain?: boolean
  /** etwas im Kopf rechts, etwa der Schalter „Erklärungen“ */
  action?: ReactNode
  className?: string
}

/**
 * Kacheln „Trefferbild in Zahlen“: je Kennzahl Wert, Einheit und eine kurze Angabe, ohne Wert „–“ mit der
 * Mindestzahl. Sie rechnen über die Schüsse der Auswahl wie Streukreis und Schwerpunkt; der Kurzsatz aus
 * `shot-help` steht als Titel, das „?“ öffnet die ganze Erklärung.
 */
export function MetricTiles({
  shots,
  state,
  keys = TILE_KEYS,
  onHelp,
  explain = false,
  action,
  className,
}: MetricTilesProps) {
  const selected = selectionShots(shots, state.selection)
  // dieselben Schüsse wie der Schwerpunkt auf der Scheibe und die Zeiten wie im Fachkern (ohne Platzhalter)
  const center = centroid(
    groupShots(shots, state.selection).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
  )
  const context: HintContext = {
    center,
    pauses: tempo(
      timesInOrder(selectShots(inShotOrder(selected), { need: "time" }), contextOf(selected, shots))
    ).pausesMs.length,
    scoring: state.scoring,
  }
  const mixed = shots.some((s) => s.kind === "probe") && shots.some((s) => s.kind !== "probe")
  // worüber die Kacheln rechnen, in derselben Form wie der Kopf der Analyse („über …“, Plan Schritt 4 D4)
  const scope =
    state.selection === "all"
      ? mixed
        ? "über alle Schüsse mit Probe"
        : "über alle Schüsse"
      : state.selection === "match"
        ? "über alle Schüsse ohne Probe"
        : state.selection === "probe"
          ? "über die Probe"
          : `über Serie ${state.selection}`

  return (
    <section className={cn("@container grid gap-3", className)} aria-label="Trefferbild in Zahlen">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight">Trefferbild in Zahlen</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-muted-foreground">{scope}</span>
          {action}
        </div>
      </div>
      {/* Spalten so, dass die Kacheln jede Zeile ganz füllen (zehn: 2 und 5); sonst bliebe eine Lücke */}
      <div
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border",
          columnsFor(keys.length)
        )}
      >
        {keys.map((key) => {
          const definition = metricByKey(key)
          if (!definition) return null
          const metric = inScoring(definition, state.scoring)
          // die ganze Karte für Abstände: eine späte Probe ist keine Lücke (SF-04)
          const value = computeMetric(metric, selected, shots)
          const label = key === "group.mpiDistance" ? "Schwerpunkt" : metric.label
          const unit = unitText(metric.unit)
          const short = helpForMetric(key)?.short
          // Ø und Zehnerquote zählen nur Wertung, auch wenn die Auswahl Probe einschließt
          const skipsProbe = selected.some((shot) => !metric.appliesTo.includes(shot.kind))
          const why =
            value === null
              ? missingReason(metric, selected)
              : `${HINTS[key]?.(context) ?? ""}${skipsProbe ? " · ohne Probe" : ""}${metric.nSensitive ? " · abhängig von der Schusszahl" : ""}`
          return (
            <div
              key={key}
              data-metric={key}
              title={short}
              className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {labelNode(label)}
                </span>
                {onHelp && <HelpButton label={label} onClick={() => onHelp(key)} />}
              </div>
              <span
                className={cn(
                  "font-display text-[1.6rem] leading-tight font-bold tabular-nums",
                  value === null && "text-muted-foreground"
                )}
              >
                {value === null ? "–" : formatValue(value, metric.decimals)}
                {value !== null && unit && (
                  <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                    {unit}
                  </small>
                )}
              </span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{why}</span>
              {explain && short && (
                <span data-short className="text-[12.5px] leading-snug text-foreground-2">
                  {short}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
