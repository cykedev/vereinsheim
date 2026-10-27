"use client"

import type { Scoring, SeriesSum } from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"

import { Dash } from "../Dash"
import { REASON_TEXT } from "../detail"
import { formatValue } from "../format"
import { tileColumns } from "../geometry"
import { useElementWidth } from "../target/useAnimatedViewBox"

export interface SumSeriesProps {
  /** die gespeicherten Serien-Summen einer Scheibe ohne Einzelschüsse */
  series: readonly SeriesSum[]
  scoring: Scoring
  className?: string
}

/**
 * Serien aus Summen (eine Scheibe ohne Einzelschüsse): je Serie eine Kachel im Raster von `SeriesStrip`, mit dem Wert
 * in der Wertung, ohne kleine Scheibe und ohne Wahl (es gibt keine Schüsse, die eine Serie zeigen könnte). Fehlt der
 * Wert in dieser Wertung, steht „–“ mit Grund.
 */
export function SumSeries({ series, scoring, className }: SumSeriesProps) {
  const [width, measure] = useElementWidth()
  if (!series.length) return null
  const columns = tileColumns(series.length, width || 300)
  return (
    <div data-sum-series className={cn("grid gap-2.5", className)}>
      <span className="text-[13px] text-muted-foreground">Serien</span>
      <div
        ref={measure}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 104px))` }}
      >
        {series.map((sum) => {
          const value =
            scoring === "rings"
              ? sum.rings === null
                ? null
                : formatValue(sum.rings, 0)
              : sum.decimalTenths === null
                ? null
                : formatValue(sum.decimalTenths / 10, 1)
          const reason = scoring === "rings" ? REASON_TEXT.onlyTenths : REASON_TEXT.noTenths
          return (
            <div
              key={sum.series}
              data-series={sum.series}
              className="grid gap-px rounded-[10px] border border-border p-2 text-xs leading-tight text-muted-foreground"
            >
              <span data-title="true">{`Serie ${sum.series}`}</span>
              <b className="font-display text-[15px] font-bold text-foreground tabular-nums">
                {value ?? <Dash reason={reason} />}
              </b>
              {sum.shots < 10 && <small className="text-xs">{`${sum.shots} von 10 Schuss`}</small>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
