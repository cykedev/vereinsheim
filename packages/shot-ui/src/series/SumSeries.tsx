"use client"

import type { Scoring, SeriesSum } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { Dash } from "../Dash"
import { REASON_TEXT } from "../detail"
import { formatValue } from "../format"
import { seriesTileView, tileColumns } from "../geometry"
import { MiniTarget } from "../target/MiniTarget"
import { useElementWidth } from "../target/useAnimatedViewBox"

export interface SumSeriesProps {
  /** das Scheibenbild der Disziplin, leise je Serie als Platzhalter der kleinen Scheibe */
  target: TargetImage
  /** die gespeicherten Serien-Summen einer Scheibe ohne Einzelschüsse */
  series: readonly SeriesSum[]
  scoring: Scoring
  className?: string
}

/**
 * Serien aus Summen (eine Scheibe ohne Einzelschüsse): je Serie eine Kachel wie in `SeriesStrip`, die kleine Scheibe als
 * leiser Platzhalter ohne Treffer, darunter der Wert in der Wertung; ohne Wahl (es gibt keine Schüsse, die eine Serie
 * zeigen könnte). Fehlt der Wert in dieser Wertung, steht „–“ mit Grund. Die Mitte einer Trefferlage als Summe steht
 * nur auf der großen Scheibe, nicht je Serie.
 */
export function SumSeries({ target, series, scoring, className }: SumSeriesProps) {
  const [width, measure] = useElementWidth()
  if (!series.length) return null
  const columns = tileColumns(series.length, width || 300)
  // derselbe Ausschnitt wie die Serien einer Scheibe ohne Treffer
  const view = seriesTileView(target, [])
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
              className="grid min-w-0 content-start gap-1.5 rounded-[10px] p-0.5"
            >
              <MiniTarget target={target} view={view} shots={[]} placeholder />
              <span className="grid gap-px text-xs leading-tight text-muted-foreground">
                <span data-title="true">{`Serie ${sum.series}`}</span>
                <b className="font-display text-[15px] font-bold text-foreground tabular-nums">
                  {value ?? <Dash reason={reason} />}
                </b>
                {sum.shots < 10 && (
                  <small className="text-xs">{`${sum.shots} von 10 Schuss`}</small>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
