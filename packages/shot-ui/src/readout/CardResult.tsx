import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { formatValue } from "../format"
import { noResultReason } from "../reasons"
import type { ViewState } from "../view-state"

/**
 * Kennzahlen der ganzen Scheibe unter dem Ergebnis, aus dem Fachkern in der gewählten Wertung (`inScoring`).
 * Früher eine eigene Übersicht, die Ergebnis und Schusszahl ein zweites Mal zeigte (User, 8. Oktober 2026).
 */
export const RESULT_FACTS = [
  ["Zehner", "result.tens"],
  ["Innenzehner", "result.innerTens"],
  ["bester Teiler", "result.bestTeiler"],
] as const

export interface CardResultProps {
  shots: readonly MetricShot[]
  state: ViewState
  /** Umschalter ganze Ringe/Zehntel */
  scoring: ReactNode
  className?: string
}

/**
 * Ergebnis der ganzen Scheibe: groß aus dem Fachkern, darunter Wertungsschüsse und Probe, Zehner, Innenzehner
 * und bester Teiler, dazu die Wertung. Nicht über die Auswahl (D1 in `plans/2026-10-08-spiegel-shot-ui-kacheln.md`).
 * Auf dem Telefon im Kopf, ab 768 px als Box über der Ablesung (`CardPage`, User, 8. Oktober 2026). Ohne Wert ein
 * Strich mit Grund wie die Kachel.
 */
export function CardResult({ shots, state, scoring, className }: CardResultProps) {
  const total = computeMetric(inScoring(metricByKey("result.decimal")!, state.scoring), shots)
  const count = shots.filter((s) => s.kind === "match").length
  const probe = shots.length - count
  return (
    <div className={cn("grid content-start gap-3", className)}>
      <div className="grid gap-1">
        <p data-result className="font-display text-[2.6rem] leading-none font-bold tabular-nums">
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
            : noResultReason(shots, state.scoring)}
        </p>
        {count > 0 && (
          <dl
            aria-label="Kennzahlen der Scheibe"
            className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
          >
            {RESULT_FACTS.map(([term, key]) => {
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
  )
}
