"use client"

import { centroid } from "@vereinsheim/shot-core/geometry"
import {
  computeMetric,
  inScoring,
  metricByKey,
  timesWithGaps,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { tempo } from "@vereinsheim/shot-core/time"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { directionText, formatValue, unitText } from "../format"
import { hasPosition, selectionShots } from "../shots"
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
  "group.enclosingDiameter": () => "Mitte zu Mitte",
  "group.r50": () => "Median der Abstände, ohne Fehlschüsse",
  "group.mpiDistance": (c) => (c.center ? directionText(c.center) : ""),
  "group.sdX": () => "waagrecht, n − 1",
  "group.sdY": () => "senkrecht, n − 1",
  "time.intervalMedian": (c) =>
    c.pauses
      ? `${c.pauses} ${c.pauses === 1 ? "Pause" : "Pausen"} über 3 min nicht gezählt`
      : "Median der Abstände",
  "result.decimalMean": (c) => (c.scoring === "rings" ? "in ganzen Ringen" : "in Zehnteln"),
  "group.sigma": () => "Rayleigh-σ, kaum von n abhängig",
  "result.tensRate": () => "Anteil der Zehner",
  "time.tempoSpread": () => "IQR der Intervalle",
}

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
  className,
}: MetricTilesProps) {
  const selected = selectionShots(shots, state.selection)
  const center = centroid(
    selected.filter(hasPosition).map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
  )
  const context: HintContext = {
    center,
    pauses: tempo(timesWithGaps(selected)).pausesMs.length,
    scoring: state.scoring,
  }
  const scope =
    state.selection === "all"
      ? selected.some((s) => s.kind === "match")
        ? "alle Wertungsschüsse"
        : "Probe"
      : state.selection === "probe"
        ? "Probe"
        : `Serie ${state.selection}`

  return (
    <section className={cn("grid gap-3", className)} aria-label="Trefferbild in Zahlen">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight">Trefferbild in Zahlen</h2>
        <span className="text-[13px] text-muted-foreground">{scope}</span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {keys.map((key) => {
          const definition = metricByKey(key)
          if (!definition) return null
          const metric = inScoring(definition, state.scoring)
          const value = computeMetric(metric, selected)
          const label = key === "group.mpiDistance" ? "Schwerpunkt" : metric.label
          const unit = unitText(metric.unit)
          const why =
            value === null
              ? `ab ${metric.minShots} Schuss`
              : `${HINTS[key]?.(context) ?? ""}${metric.nSensitive ? " · abhängig von der Schusszahl" : ""}`
          return (
            <div
              key={key}
              data-metric={key}
              title={helpForMetric(key)?.short}
              className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {labelNode(label)}
                </span>
                {onHelp && (
                  <button
                    type="button"
                    aria-label={`Erklärung: ${label}`}
                    onClick={() => onHelp(key)}
                    className="-m-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="size-4"
                    >
                      <circle cx={12} cy={12} r={9} />
                      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.3" />
                      <path d="M12 17h.01" />
                    </svg>
                  </button>
                )}
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
            </div>
          )
        })}
      </div>
    </section>
  )
}
