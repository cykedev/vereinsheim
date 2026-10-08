"use client"

import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"

import { formatValue } from "../format"
import type { ViewState } from "../view-state"

/** die Zeilen der Übersicht: Beschriftung und Kennzahl (in Zehnteln; `inScoring` wählt die Wertung) */
export const SUMMARY_KEYS = [
  ["Ergebnis", "result.decimal"],
  ["Zehner", "result.tens"],
  ["Innenzehner", "result.innerTens"],
  ["bester Teiler", "result.bestTeiler"],
] as const

export interface CardSummaryProps {
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  className?: string
}

/**
 * Übersicht der ganzen Scheibe: Zahl der Schüsse, Ergebnis, Zehner, Innenzehner und bester Teiler in der
 * gewählten Wertung, aus dem Fachkern. Sie folgt bewusst nicht der Auswahl, weil sie das Ergebnis der
 * Scheibe zeigt (Entscheidung D1 in `plans/2026-10-08-spiegel-shot-ui-kacheln.md`).
 */
export function CardSummary({ shots, state, className }: CardSummaryProps) {
  const match = shots.filter((shot) => shot.kind === "match").length
  const probe = shots.length - match
  return (
    <dl
      aria-label="Übersicht"
      className={cn(
        "grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]",
        className
      )}
    >
      <dt className="text-muted-foreground">Wertung</dt>
      <dd className="font-semibold tabular-nums">
        {`${match} Schuss${probe ? ` + ${probe} Probe` : ""}`}
      </dd>
      {SUMMARY_KEYS.map(([term, key]) => {
        const definition = metricByKey(key)
        const metric = definition ? inScoring(definition, state.scoring) : null
        const value = metric ? computeMetric(metric, shots) : null
        return [
          <dt key={`${key}:t`} className="text-muted-foreground">
            {term}
          </dt>,
          <dd key={`${key}:d`} className="font-semibold tabular-nums">
            {metric && value !== null ? formatValue(value, metric.decimals) : "–"}
          </dd>,
        ]
      })}
    </dl>
  )
}
