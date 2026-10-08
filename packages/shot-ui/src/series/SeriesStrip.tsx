"use client"

import { seriesCurve } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"
import { useMemo, useRef } from "react"

import { caliberRadius, scoreColor, seriesTileView, tileColumns } from "../geometry"
import { formatTotal, hasPosition, seriesKeyOf, sightAdjustCut } from "../shots"
import { useElementWidth } from "../target/useAnimatedViewBox"
import type { SeriesKey } from "../types"
import { isSelected, type ViewState } from "../view-state"

export interface SeriesStripProps {
  target: TargetImage
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  /** Tippen auf eine kleine Scheibe nimmt sie in die Auswahl oder heraus */
  onSelect?: (key: SeriesKey) => void
  onSelectAll?: () => void
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

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
const mm = (um: number) => um / 1000

/**
 * Serien als kleine Scheiben (spiegel-ui-design): je Serie und für die Probe eine kleine Scheibe, alle im
 * gleichen Ausschnitt um die Mitte, darunter das Serienergebnis in der gewählten Wertung. Jede Kachel ist
 * ein Schalter für die Auswahl; „Alle“ setzt zurück. Die Kacheln füllen die Zeilen gleichmäßig.
 */
export function SeriesStrip({
  target,
  shots,
  state,
  onSelect,
  onSelectAll,
  className,
}: SeriesStripProps) {
  const grid = useRef<HTMLDivElement>(null)
  const width = useElementWidth(grid)
  const cut = sightAdjustCut(shots, state.adjustAfter)

  const blocks = useMemo<Block[]>(() => {
    const result: Block[] = []
    const probes = shots.flatMap((shot, i) => (shot.kind === "probe" ? [i] : []))
    if (probes.length) {
      result.push({
        key: "probe",
        title: "Probe",
        value: String(probes.length),
        unit: "Schuss",
        sub: cut ? `${probes.length - cut} nach der Verstellung` : "",
        indices: probes,
      })
    }
    for (const point of seriesCurve(shots, state.scoring)) {
      result.push({
        key: point.series,
        title: `Serie ${point.series}`,
        value: formatTotal(point.total, state.scoring),
        unit: "",
        sub: point.shots < 10 ? `${point.shots} von 10 Schuss` : "",
        indices: shots.flatMap((shot, i) =>
          shot.kind === "match" && shot.series === point.series ? [i] : []
        ),
      })
    }
    return result
  }, [shots, state.scoring, cut])

  const view = useMemo(
    () =>
      seriesTileView(
        target,
        shots
          .filter(hasPosition)
          .map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
      ),
    [target, shots]
  )

  if (!blocks.length) return null

  const half = view.w / 2
  const calR = caliberRadius(target)
  const blackR = mm(target.ringRadiiUm[target.blackFromRing - 1])
  const columns = tileColumns(blocks.length, width || 300)
  const all = state.selection === "all"
  let probeNumber = 0
  const probeNumbers = shots.map((shot) => (shot.kind === "probe" ? ++probeNumber : 0))

  return (
    <div className={cn("grid gap-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">Serien</span>
        <button
          type="button"
          aria-pressed={all}
          onClick={onSelectAll}
          className="cursor-pointer rounded-full border border-line-strong px-3 py-1 text-[12.5px] leading-none font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent-wash aria-pressed:text-foreground"
        >
          Alle
        </button>
      </div>
      <div
        ref={grid}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 104px))` }}
      >
        {blocks.map((block) => {
          const pressed = !all && isSelected(state.selection, block.key)
          const dim = !all && !pressed
          const label = `${block.title}: ${block.value}${block.unit ? ` ${block.unit}` : ""}${
            block.sub ? `, ${block.sub}` : ""
          }`
          return (
            <button
              key={String(block.key)}
              type="button"
              data-series={String(block.key)}
              aria-pressed={pressed}
              data-dim={dim || undefined}
              onClick={onSelect ? () => onSelect(block.key) : undefined}
              className={cn(
                "grid min-w-0 cursor-pointer content-start gap-1.5 rounded-[10px] p-0.5 text-left focus-visible:outline-2 focus-visible:outline-ring",
                pressed && "bg-accent-wash outline-2 outline-primary",
                dim && "opacity-55"
              )}
            >
              <svg
                viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
                role="img"
                aria-label={label}
                className="block aspect-square h-auto w-full rounded-lg border border-border"
              >
                <rect x={view.x} y={view.y} width={view.w} height={view.w} fill="var(--paper)" />
                <circle r={blackR} fill="var(--spiegel)" />
                {target.weapon === "lg" && (
                  <circle r={mm(target.ringRadiiUm[9])} fill="var(--paper)" />
                )}
                {target.ringRadiiUm.map((radiusUm, i) => {
                  const r = mm(radiusUm)
                  if (r > half * 1.5 || (i === 9 && target.weapon === "lg")) return null
                  return (
                    <circle
                      key={i}
                      r={r}
                      fill="none"
                      stroke={
                        i + 1 >= target.blackFromRing ? "var(--spiegel-line)" : "var(--paper-line)"
                      }
                      strokeWidth={0.75}
                      opacity={0.7}
                      {...HAIR}
                    />
                  )
                })}
                {block.indices
                  .filter((i) => hasPosition(shots[i]))
                  .map((i) => {
                    const shot = shots[i]
                    const x = mm(shot.xUm as number)
                    const y = -mm(shot.yUm as number)
                    const color = shot.ring === null ? "var(--paper-line)" : scoreColor(shot.ring)
                    return seriesKeyOf(shot) === "probe" ? (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={calR * 0.92}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.25}
                        strokeDasharray={probeNumbers[i] <= cut ? "2 2" : undefined}
                        {...HAIR}
                      />
                    ) : (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={calR}
                        fill={color}
                        fillOpacity={0.8}
                        stroke="var(--shot-edge)"
                        strokeWidth={1}
                        {...HAIR}
                      />
                    )
                  })}
              </svg>
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
