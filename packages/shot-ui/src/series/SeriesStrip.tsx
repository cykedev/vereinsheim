"use client"

import { seriesCurve } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"
import { useMemo } from "react"

import { caliberRadius, probeCorner, scoreColor, seriesTileView, tileColumns } from "../geometry"
import { formatTotal, hasPosition, isProbeShot, seriesKeyOf } from "../shots"
import { useElementWidth } from "../target/useAnimatedViewBox"
import type { SeriesKey, Whole } from "../types"
import { isSelected, type ViewState } from "../view-state"

export interface SeriesStripProps {
  target: TargetImage
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  state: ViewState
  /** Tippen auf eine kleine Scheibe wählt genau diese Serie; dieselbe noch einmal zeigt wieder alle */
  onSelect?: (key: SeriesKey) => void
  /** die ganze Scheibe wählen: „Alle“ mit Probe oder „Ohne Probe“ (nur, wenn es beides gibt) */
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
  onSelectWhole,
  className,
}: SeriesStripProps) {
  const [width, measure] = useElementWidth()

  const blocks = useMemo<Block[]>(() => {
    const result: Block[] = []
    const probes = shots.flatMap((shot, i) => (shot.kind === "probe" ? [i] : []))
    if (probes.length) {
      result.push({
        key: "probe",
        title: "Probe",
        value: String(probes.length),
        unit: "Schuss",
        sub: "",
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
        indices: shots.flatMap((shot, i) => (seriesKeyOf(shot) === point.series ? [i] : [])),
      })
    }
    return result
  }, [shots, state.scoring])

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
  const whole = state.selection === "all" || state.selection === "match"
  const mixed = shots.some((s) => s.kind === "probe") && shots.some((s) => s.kind !== "probe")
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
        <div className="flex flex-wrap gap-1.5">
          {wholeButton("all", "Alle")}
          {mixed && wholeButton("match", "Ohne Probe")}
        </div>
      </div>
      <div
        ref={measure}
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 104px))` }}
      >
        {blocks.map((block) => {
          // ganze Scheibe: keine Kachel gedrückt, ohne Probe die Probe blass; eine Serie: nur sie gedrückt
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
              <svg
                viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
                aria-hidden="true"
                className={cn(
                  "block aspect-square h-auto w-full rounded-lg border border-border",
                  dim && "opacity-55"
                )}
              >
                <rect x={view.x} y={view.y} width={view.w} height={view.w} fill="var(--paper)" />
                {(block.key === "probe" ||
                  (block.indices.length > 0 &&
                    block.indices.every((i) => isProbeShot(shots[i])))) && (
                  <polygon
                    data-probe-corner="true"
                    points={probeCorner(view)}
                    fill="var(--spiegel)"
                  />
                )}
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
                        {...HAIR}
                      />
                    ) : (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={calR}
                        fill={shot.ring === null ? "none" : color}
                        fillOpacity={0.8}
                        stroke="var(--shot-edge)"
                        strokeWidth={1}
                        strokeDasharray={shot.ring === null ? "2 2" : undefined}
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
