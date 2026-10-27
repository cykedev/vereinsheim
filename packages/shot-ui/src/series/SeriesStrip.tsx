"use client"

import { seriesCurve } from "@vereinsheim/shot-core/analysis"
import { isDrawn, type MetricShot, type SeriesSum } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"
import { useMemo } from "react"

import { Dash } from "../Dash"
import { REASON_TEXT } from "../detail"
import { formatValue } from "../format"
import { miniView, seriesTileView, tileColumns } from "../geometry"
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
  /**
   * die Serien-Summen einer Scheibe ohne Einzelschüsse: Tragen die Schüsse keine Serie, stehen die Summen in denselben
   * Kacheln, die kleine Scheibe als leiser Platzhalter, ohne Wahl
   */
  sums?: readonly SeriesSum[]
  /** ganz ohne Serien: an ihrer Stelle dieser Satz unter der Leiste (ohne ihn bleibt der Bereich leer) */
  missing?: string
  className?: string
}

interface Block {
  key: SeriesKey
  title: string
  value: string
  /** ohne Wert in der Wertung: der Grund am „–“ */
  reason?: string
  unit: string
  sub: string
  indices: number[]
}

/**
 * Serien als kleine Scheiben (spiegel-ui-design): je Serie eine kleine Scheibe, alle im gleichen Ausschnitt um die
 * Mitte, darunter das Serienergebnis in der gewählten Wertung. Jede Kachel ist ein Schalter für die Auswahl; „Alle“
 * setzt zurück. Die Kacheln füllen die Zeilen gleichmäßig. Keine Probe-Kachel: Eine Scheibe ist wie am Ausdruck;
 * eine Scheibe nur aus Probe hat Serien mit dem Probe-Eck. Ein Bau für jede Detailtiefe: Serien ohne Lage zeigen den
 * leisen Platzhalter, Serien-Summen (`sums`) dieselben Kacheln ohne Wahl, ganz ohne Serien steht ein Satz (`missing`)
 * unter derselben Leiste.
 */
export function SeriesStrip({
  target,
  shots,
  state,
  onSelect,
  onSelectWhole,
  sums,
  missing,
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
    if (result.length || !sums?.length) return result
    // Serien-Summen: der Wert in der Wertung, die Schusszahl immer (wie „n von 10 Schuss“ bei Schüssen)
    for (const sum of sums) {
      const value =
        state.scoring === "rings"
          ? sum.rings
          : sum.decimalTenths === null
            ? null
            : sum.decimalTenths / 10
      result.push({
        key: sum.series,
        title: `Serie ${sum.series}`,
        value: value === null ? "–" : formatValue(value, state.scoring === "rings" ? 0 : 1),
        ...(value === null
          ? { reason: state.scoring === "rings" ? REASON_TEXT.onlyTenths : REASON_TEXT.noTenths }
          : {}),
        unit: "",
        sub: `${sum.shots} Schuss`,
        indices: [],
      })
    }
    return result
  }, [shots, state.scoring, sums])
  const fromSums = blocks.length > 0 && !blocks.some((block) => block.indices.length)

  // ohne eine Lage wie die kleinen Scheiben der Übersichten (Spiegel und Ringe), sonst um die Gruppe der Scheibe
  const view = useMemo(() => {
    const points = shots
      .filter(isDrawn)
      .map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
    return points.length ? seriesTileView(target, points) : miniView(target, [])
  }, [target, shots])

  if (!blocks.length && !missing) return null

  const columns = tileColumns(blocks.length, width || 300)
  const whole = state.selection === "all"
  // aus Summen gibt es nichts zu wählen: „Alle“ steht da wie gedrückt, ohne Knopf
  const wholeButton = (value: Whole, label: string) =>
    fromSums ? (
      <span className="rounded-full border border-primary bg-accent-wash px-3 py-1 text-[12.5px] leading-none font-semibold text-foreground">
        {label}
      </span>
    ) : (
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
    <div data-sum-series={fromSums || undefined} className={cn("grid gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">Serien</span>
        {blocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{wholeButton("all", "Alle")}</div>
        )}
      </div>
      {!blocks.length && (
        <p data-series-missing className="text-[13px] text-muted-foreground">
          {missing}
        </p>
      )}
      <div
        ref={measure}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 104px))` }}
      >
        {blocks.map((block) => {
          // ganze Scheibe: keine Kachel gedrückt; eine Serie: nur sie gedrückt, die übrigen blass
          const pressed = !whole && isSelected(state.selection, block.key)
          const dim = !isSelected(state.selection, block.key)
          const label = `${block.title}: ${block.value}${block.reason ? ` ${block.reason}` : ""}${
            block.unit ? ` ${block.unit}` : ""
          }${block.sub ? `, ${block.sub}` : ""}`
          const image = (
            <>
              {/* blass tritt nur das Bild zurück; die Schrift behält ihren Kontrast */}
              {/* ohne Lage der Serie der leise Platzhalter, wie bei Serien aus Summen */}
              <MiniTarget
                target={target}
                view={view}
                shots={block.indices.map((i) => shots[i]).filter(isDrawn)}
                placeholder={!block.indices.some((i) => isDrawn(shots[i]))}
                probeCorner={
                  block.indices.length > 0 && block.indices.every((i) => isProbeShot(shots[i]))
                }
                dim={dim}
              />
              <span className="grid gap-px text-xs leading-tight text-muted-foreground">
                <span data-title="true">{block.title}</span>
                <b className="font-display text-[15px] font-bold text-foreground tabular-nums">
                  {block.reason ? <Dash reason={block.reason} /> : block.value}
                  {block.unit && (
                    <small className="font-sans text-xs font-medium text-muted-foreground">
                      {" "}
                      {block.unit}
                    </small>
                  )}
                </b>
                {block.sub && <small className="text-xs">{block.sub}</small>}
              </span>
            </>
          )
          if (fromSums)
            return (
              <div
                key={String(block.key)}
                data-series={String(block.key)}
                className="grid min-w-0 content-start gap-1.5 rounded-[10px] p-0.5"
              >
                {image}
              </div>
            )
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
              {image}
            </button>
          )
        })}
      </div>
    </div>
  )
}
