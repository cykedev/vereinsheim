import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue, unitText } from "../format"
import { HelpButton } from "../help/HelpButton"
import type { PeriodTile } from "./model"
import { verdictText } from "./sentence"

export interface PeriodTilesProps {
  tiles: readonly PeriodTile[]
  /** Name des Vergleichszeitraums; null ohne Vergleich */
  compareLabel: string | null
  onHelp?: (metricKey: string) => void
  className?: string
}

const cards = (n: number) => `${n} ${n === 1 ? "Scheibe" : "Scheiben"}`

/**
 * Zahlen über den Zeitraum (Plan L3, D11): je Kennzahl das Mittel der Werte je Scheibe (Einheit Scheibe) und die
 * Zahl der Scheiben; mit Vergleich der Wert im Vergleichszeitraum, der Unterschied und das Urteil („bedeutsam“ nur
 * neben einem Urteil). Kacheln mit Wert, Einheit und kurzer Angabe, drei Spalten ab 27rem Breite.
 */
export function PeriodTiles({ tiles, compareLabel, onHelp, className }: PeriodTilesProps) {
  return (
    <section
      className={cn("@container grid gap-3", className)}
      aria-label="Zahlen über den Zeitraum"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight">Zahlen über den Zeitraum</h2>
        <span className="text-[13px] text-muted-foreground">
          {compareLabel ? `Mittel je Scheibe, gegen ${compareLabel}` : "Mittel je Scheibe"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border @min-[27rem]:grid-cols-3">
        {tiles.map((tile) => {
          const unit = unitText(tile.unit)
          const short = helpForMetric(tile.key)?.short
          const other = tile.compare
          return (
            <div
              key={tile.key}
              data-period-tile={tile.key}
              title={short}
              className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {tile.label}
                </span>
                {onHelp && (
                  <HelpButton
                    label={tile.label}
                    helpId={helpForMetric(tile.key)?.id}
                    onClick={() => onHelp(tile.key)}
                  />
                )}
              </div>
              <span
                className={cn(
                  "font-display text-[1.6rem] leading-tight font-bold tabular-nums",
                  tile.value === null && "text-muted-foreground"
                )}
              >
                {tile.value === null ? "–" : formatValue(tile.value, tile.decimals)}
                {tile.value !== null && unit && (
                  <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                    {unit}
                  </small>
                )}
              </span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">
                {tile.value === null ? "keine Scheibe mit Wert" : cards(tile.n)}
              </span>
              {other && compareLabel && (
                <span data-tile-compare className="text-[12.5px] leading-snug text-foreground-2">
                  {other.value === null
                    ? `${compareLabel}: keine Scheibe mit Wert`
                    : `${compareLabel}: ${formatValue(other.value, tile.decimals)}`}
                  {other.comparison && (
                    <>
                      <br />
                      <span className="tabular-nums">{`Δ ${formatSigned(other.comparison.delta, tile.decimals)} · `}</span>
                      <span className="font-semibold">
                        {verdictText(other.comparison, tile.better)}
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
