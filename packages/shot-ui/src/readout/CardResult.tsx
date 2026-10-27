import {
  computeMetric,
  inScoring,
  metricByKey,
  sumsResult,
  type CardSums,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { formatValue } from "../format"
import { noResultReason } from "../reasons"
import type { ViewState } from "../view-state"

/**
 * Kennzahlen der ganzen Scheibe unter dem Ergebnis, aus dem Fachkern in der gewählten Wertung (`inScoring`).
 */
export const RESULT_FACTS = [
  ["Zehner", "result.tens"],
  ["Innenzehner", "result.innerTens"],
  ["bester Teiler", "result.bestTeiler"],
] as const

export interface CardResultProps {
  shots: readonly MetricShot[]
  state: ViewState
  /**
   * die Summen der Scheibe neben den Schüssen: Geben die Schüsse in der Wertung kein Ergebnis (etwa Schüsse nur in
   * ganzen Ringen, Serien mit Zehnteln), kommt es aus den Summen, wie in Liste und Fortschritt (`cardValues`)
   */
  sums?: CardSums
  /** Kreise (Art, Wertung) rechts in der Zeile der großen Zahl */
  actions?: ReactNode
  /** ein Hinweis unten, etwa ein Fehler beim Speichern */
  notice?: ReactNode
  className?: string
}

/**
 * Ergebnis der ganzen Scheibe: groß aus dem Fachkern, darunter die Schusszahl (wie am Ausdruck ohne Probe), Zehner, Innenzehner
 * und bester Teiler; rechts neben der Zahl die Kreise der Einstellungen. Nicht über die Auswahl.
 * Auf dem Telefon im Kopf, ab 768 px als Box über der Ablesung (`CardPage`). Ohne Wert ein
 * Strich mit Grund wie die Kachel.
 */
export function CardResult({ shots, state, sums, actions, notice, className }: CardResultProps) {
  const fromSums = sumsResult(sums, state.scoring)
  const total =
    computeMetric(inScoring(metricByKey("result.decimal")!, state.scoring), shots) ??
    (fromSums ? fromSums.tenths / 10 : null)
  const count = shots.filter((s) => s.kind === "match").length
  return (
    <div className={cn("grid content-start gap-3", className)}>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p data-result className="font-display text-[2.6rem] leading-none font-bold tabular-nums">
            {total === null ? "–" : formatValue(total, state.scoring === "rings" ? 0 : 1)}
            {total !== null && (
              <small className="ml-2 font-sans text-[15px] font-medium text-muted-foreground">
                Ringe
              </small>
            )}
          </p>
          {actions && (
            <div data-result-actions className="ml-auto flex shrink-0 items-center gap-1.5">
              {actions}
            </div>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">
          {total !== null ? `${count} Schuss` : noResultReason(shots, state.scoring)}
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
      {notice}
    </div>
  )
}
