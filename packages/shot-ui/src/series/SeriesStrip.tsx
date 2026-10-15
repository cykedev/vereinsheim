"use client"

import { seriesCurve } from "@vereinsheim/shot-core/analysis"
import { isDrawn, type MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"
import { useMemo } from "react"

import { seriesTileView, tileColumns } from "../geometry"
import { formatTotal, isProbeShot, seriesKeyOf } from "../shots"
import { MiniTarget } from "../target/MiniTarget"
import { useElementWidth } from "../target/useAnimatedViewBox"
import type { SeriesKey, Whole } from "../types"
import { isSelected, type ViewState } from "../view-state"

export interface SeriesStripProps {
  target: TargetImage
  /** die Schüsse der Scheibe wie am Ausdruck (`asOnPrintout`) in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  /** Tippen auf eine kleine Scheibe wählt genau diese Serie; dieselbe noch einmal zeigt wieder alle */
  onSelect?: (key: SeriesKey) => void
  /** „Alle“: die ganze Scheibe wählen */
  onSelectWhole?: (whole: Whole) => void
  className?: string
}

interface Block {
  key: SeriesKey
  title: string
  value: string
  unit: string
  sub: string
  indices: number[]
}

/**
 * Serien als kleine Scheiben (spiegel-ui-design): je Serie eine kleine Scheibe, alle im gleichen Ausschnitt um die
 * Mitte, darunter das Serienergebnis in der gewählten Wertung. Jede Kachel ist ein Schalter für die Auswahl; „Alle“
 * setzt zurück. Die Kacheln füllen die Zeilen gleichmäßig. Keine Probe-Kachel: Eine Scheibe ist wie am Ausdruck;
 * ein Training nur aus Probe hat Serien mit dem Probe-Eck.
 */
export function SeriesStrip({
  target,
  shots,
  state,
  onSelect,
  onSelectWhole,
  className,
}: SeriesStripProps) {
  const [width, measure] = useElementWidth()

  const blocks = useMemo<Block[]>(() => {
    const result: Block[] = []
    for (const point of seriesCurve(shots, state.scoring)) {
      result.push({
        key: point.series,
        title: `Serie ${point.series}`,
        value: formatTotal(point.total, state.scoring),
        unit: "",
        sub: point.shots < 10 ? `${point.shots} von 10 Schuss` : "",
        indices: shots.flatMap((shot, i) => (seriesKeyOf(shot) === point.series ? [i] : [])),
      })
    }
    return result
  }, [shots, state.scoring])

  const view = useMemo(
    () =>
      seriesTileView(
        target,
        shots.filter(isDrawn).map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
      ),
    [target, shots]
  )

  if (!blocks.length) return null

  const columns = tileColumns(blocks.length, width || 300)
  const whole = state.selection === "all"
  const wholeButton = (value: Whole, label: string) => (
    <button
      type="button"
      aria-pressed={state.selection === value}
      onClick={onSelectWhole ? () => onSelectWhole(value) : undefined}
      className="cursor-pointer rounded-full border border-line-strong px-3 py-1 text-[12.5px] leading-none font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent-wash aria-pressed:text-foreground"
    >
      {label}
    </button>
  )

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">Serien</span>
        <div className="flex flex-wrap gap-1.5">{wholeButton("all", "Alle")}</div>
      </div>
      <div
        ref={measure}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 104px))` }}
      >
        {blocks.map((block) => {
          // ganze Scheibe: keine Kachel gedrückt; eine Serie: nur sie gedrückt, die übrigen blass
          const pressed = !whole && isSelected(state.selection, block.key)
          const dim = !isSelected(state.selection, block.key)
          const label = `${block.title}: ${block.value}${block.unit ? ` ${block.unit}` : ""}${
            block.sub ? `, ${block.sub}` : ""
          }`
          return (
            <button
              key={String(block.key)}
              type="button"
              data-series={String(block.key)}
              aria-pressed={pressed}
              aria-label={label}
              data-dim={dim || undefined}
              onClick={onSelect ? () => onSelect(block.key) : undefined}
              className={cn(
                "grid min-w-0 cursor-pointer content-start gap-1.5 rounded-[10px] p-0.5 text-left focus-visible:outline-2 focus-visible:outline-ring",
                pressed && "bg-accent-wash outline-2 outline-primary"
              )}
            >
              {/* blass tritt nur das Bild zurück; die Schrift behält ihren Kontrast */}
              <MiniTarget
                target={target}
                view={view}
                shots={block.indices.map((i) => shots[i]).filter(isDrawn)}
                probeCorner={
                  block.indices.length > 0 && block.indices.every((i) => isProbeShot(shots[i]))
                }
                dim={dim}
              />
              <span className="grid gap-px text-xs leading-tight text-muted-foreground">
                <span data-title="true">{block.title}</span>
                <b className="font-display text-[15px] font-bold text-foreground tabular-nums">
                  {block.value}
                  {block.unit && (
                    <small className="font-sans text-xs font-medium text-muted-foreground">
                      {" "}
                      {block.unit}
                    </small>
                  )}
                </b>
                {block.sub && <small className="text-xs">{block.sub}</small>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
