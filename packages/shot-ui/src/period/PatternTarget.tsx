import type { PatternLayer } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius, scoreColor, SHOT_FILL_OPACITY } from "../geometry"
import { MpiMark } from "../target/MpiMark"
import { TargetFace, TargetRings } from "../target/TargetFace"
import { contourPath } from "./contours"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte im Muster: 10 µm (`periodPattern`) */
const POINT_MM = 0.01
/** Farben der Bänder von außen (selten) nach innen (oft) */
export const HEAT_COLORS = [
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
] as const

export interface PatternTargetProps {
  /** das Bild aus `periodPattern`: unter 50 Schuss die Punkte, sonst die Dichte in Bändern */
  layer: PatternLayer
  target: TargetImage
  /** der Satz unter dem Bild als Name des Bilds */
  label: string
  className?: string
}

/**
 * Trefferbild über einen Zeitraum (L9). Ab 50 Schuss eine Heatmap: auf der ruhigen Scheibe fünf Bänder von selten
 * (violett) bis oft (gelb), deren Grenzen Anteile der Schüsse umschließen, die Ringe als feine Linien darüber. Darunter
 * jeder Schuss in Kalibergröße und Ringfarbe wie auf der Seite einer Scheibe. Der geviertelte Kreis ist die Mitte aller
 * Schüsse. Das Bild trägt den Satz als Namen, die Worte stehen daneben.
 */
export function PatternTarget({ layer, target, label, className }: PatternTargetProps) {
  const half = layer.halfUm / 1000
  const view = { x: -half, y: -half, w: 2 * half }
  const quiet = layer.grid !== null
  const calR = caliberRadius(target)
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      role="img"
      aria-label={label}
      data-pattern-target={quiet ? "density" : "points"}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      <TargetFace target={target} view={view} quiet={quiet} />
      {layer.grid ? (
        <>
          {layer.grid.levels.map((level, i) => (
            <path
              key={i}
              data-pattern-band={i + 1}
              d={contourPath(layer.grid!, level, layer.halfUm)}
              fill={HEAT_COLORS[i]}
              fillOpacity={0.92}
              fillRule="evenodd"
            />
          ))}
          <TargetRings target={target} view={view} quiet stroke="var(--heat-line)" />
        </>
      ) : (
        (layer.points ?? []).map(([x, y, ring], i) => (
          <circle
            key={i}
            data-pattern-shot
            cx={x * POINT_MM}
            cy={-y * POINT_MM}
            r={calR}
            fill={ring === null ? "none" : scoreColor(ring)}
            fillOpacity={SHOT_FILL_OPACITY}
            stroke="var(--shot-edge)"
            strokeWidth={1}
            strokeDasharray={ring === null ? "2 2" : undefined}
            {...HAIR}
          />
        ))
      )}
      {layer.center && (
        <MpiMark x={layer.center.xUm / 1000} y={-layer.center.yUm / 1000} radius={view.w * 0.022} />
      )}
    </svg>
  )
}

/** Legende der Heatmap: ein Verlauf von selten nach oft in den Farben der Bänder */
export function HeatLegend() {
  return (
    <div data-heat-legend className="flex items-center gap-2 text-[12px] text-muted-foreground">
      <span>selten</span>
      <span
        aria-hidden="true"
        className="h-2 flex-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${HEAT_COLORS.join(", ")})` }}
      />
      <span>oft</span>
    </div>
  )
}
