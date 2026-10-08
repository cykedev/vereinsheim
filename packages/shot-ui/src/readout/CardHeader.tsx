import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { formatValue } from "../format"
import type { ViewState } from "../view-state"

/**
 * Kennzahlen der ganzen Scheibe unter dem Ergebnis, aus dem Fachkern in der gewählten Wertung (`inScoring`).
 * Früher eine eigene Übersicht, die Ergebnis und Schusszahl ein zweites Mal zeigte (User, 8. Oktober 2026).
 */
export const HEADER_FACTS = [
  ["Zehner", "result.tens"],
  ["Innenzehner", "result.innerTens"],
  ["bester Teiler", "result.bestTeiler"],
] as const

export interface CardHeaderProps {
  /** Scheibe oder Disziplin */
  title: string
  /** Datum, Stand, Beispiel …; mit „·“ verbunden */
  meta: readonly string[]
  shots: readonly MetricShot[]
  state: ViewState
  /** Umschalter ganze Ringe/Zehntel */
  scoring: ReactNode
  /** ein Satz zur Scheibe, die erste Beobachtung; null: keiner */
  sentence: string | null
  className?: string
}

/**
 * Kopf der Seite einer Scheibe (Plan Schritt 4, D2): Titel und Metazeile, das Ergebnis groß aus dem Fachkern
 * mit Wertungsschüssen und Probe, darunter Zehner, Innenzehner und bester Teiler, daneben die Wertung, darunter
 * ein Satz. Alles über die ganze Scheibe, nicht über die Auswahl (D1 in
 * `plans/2026-10-08-spiegel-shot-ui-kacheln.md`). Ohne Wert ein Strich mit Grund wie die Kachel.
 */
export function CardHeader({
  title,
  meta,
  shots,
  state,
  scoring,
  sentence,
  className,
}: CardHeaderProps) {
  const total = computeMetric(inScoring(metricByKey("result.decimal")!, state.scoring), shots)
  const count = shots.filter((s) => s.kind === "match").length
  const probe = shots.length - count
  return (
    // kein <header>: außerhalb von <main> wäre es eine zweite Banner-Landmarke neben dem Kopf der App
    <div data-card-header className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
            {title}
          </h1>
          {meta.length > 0 && (
            <p className="text-[13px] text-muted-foreground">{meta.join(" · ")}</p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="grid gap-1">
            <p
              data-result
              className="font-display text-[2.6rem] leading-none font-bold tabular-nums"
            >
              {total === null ? "–" : formatValue(total, state.scoring === "rings" ? 0 : 1)}
              {total !== null && (
                <small className="ml-2 font-sans text-[15px] font-medium text-muted-foreground">
                  Ringe
                </small>
              )}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {total !== null
                ? `${count} Schuss${probe ? ` + ${probe} Probe` : ""}`
                : count
                  ? "nicht jeder Schuss mit Wert"
                  : "ab 1 Schuss"}
            </p>
            {count > 0 && (
              <dl
                aria-label="Kennzahlen der Scheibe"
                className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
              >
                {HEADER_FACTS.map(([term, key]) => {
                  const metric = inScoring(metricByKey(key)!, state.scoring)
                  const value = computeMetric(metric, shots)
                  return (
                    <div key={key} className="flex gap-1.5">
                      <dt className="text-muted-foreground">{term}</dt>
                      <dd className="font-semibold tabular-nums">
                        {value === null ? "–" : formatValue(value, metric.decimals)}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </div>
          {scoring}
        </div>
      </div>
      {sentence && (
        <p data-sentence className="max-w-[46rem] text-[14px] leading-relaxed text-foreground-2">
          {sentence}
        </p>
      )}
    </div>
  )
}
