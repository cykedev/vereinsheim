"use client"

import type { PatternLayer } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import {
  caliberRadius,
  scoreColor,
  screenSizes,
  SHOT_FILL_OPACITY,
  unitsPerPixel,
} from "../geometry"
import { MpiMark } from "../target/MpiMark"
import { TargetBoard } from "../target/TargetBoard"
import { useElementWidth } from "../target/useAnimatedViewBox"
import { contourPath } from "./contours"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte im Muster: 10 µm (`periodPattern`) */
const POINT_MM = 0.01
/** Farben der Bänder von außen (selten) nach innen (oft) */
export const HEAT_COLORS = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
] as const
/**
 * Deckkraft der Bänder von außen nach innen: deckend genug, dass sich Violett auch vom Spiegel klar abhebt; nur das ganz
 * leichte äußere Band lässt Papier und Spiegel noch durchscheinen
 */
const HEAT_OPACITY = [0.6, 0.85, 0.9, 0.93, 0.95, 0.97] as const
/** Deckkraft der Treffer in der Farbe der Dichte: Überlagerungen bleiben zu sehen, der Spiegel scheint durch */
const SHOT_HEAT_OPACITY = 0.85

export interface PatternTargetProps {
  /** das Bild aus `periodPattern`: unter 50 Schuss die Punkte, sonst die Dichte in Bändern */
  layer: PatternLayer
  target: TargetImage
  /** der Satz unter dem Bild als Name des Bilds */
  label: string
  className?: string
}

/**
 * Trefferbild über einen Zeitraum (L9) auf der Scheibe, wie die Seite einer Scheibe sie zeichnet (`TargetBoard`: Papier,
 * Spiegel, Ringe, Ringzahlen). Bis 3.000 Schuss jeder Treffer in Kalibergröße, gefärbt nach der Dichte an seiner Stelle
 * von selten (hellviolett) bis oft (gelb), die dichten zuletzt; unter 50 Schuss in seiner Ringfarbe, weil eine Dichte
 * dann nichts sagt. Darüber die Dichte als sechs Bänder zwischen den Flächen und den Ringen. Der geviertelte Kreis ist
 * die Mitte aller Schüsse. Ringzahlen und Schwerpunkt richten sich wie auf der Scheibe nach der gemessenen Breite.
 */
export function PatternTarget({ layer, target, label, className }: PatternTargetProps) {
  const [width, measure] = useElementWidth()
  const half = layer.halfUm / 1000
  const view = { x: -half, y: -half, w: 2 * half }
  const sizes = screenSizes(target, unitsPerPixel(view, width))
  const calR = caliberRadius(target)
  return (
    <svg
      ref={measure}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      role="img"
      aria-label={label}
      data-pattern-target={layer.style}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      {/* bei wenigen Treffern wie auf der Seite einer Scheibe; mit Dichte liegen Ringe und Ringzahlen über den Bändern
          oder Treffern, damit man sieht, was wo ist */}
      <TargetBoard
        target={target}
        view={view}
        ringLabel={sizes.ringLabel}
        part={layer.style === "rings" ? "all" : "fills"}
      />
      {layer.style === "bands" &&
        layer.grid?.levels.map((level, i) => (
          <path
            key={i}
            data-pattern-band={i + 1}
            d={contourPath(layer.grid!, level, layer.halfUm)}
            fill={HEAT_COLORS[i]}
            fillOpacity={HEAT_OPACITY[i]}
            fillRule="evenodd"
          />
        ))}
      {/* jeder Treffer: in der Farbe der Dichte an seiner Stelle, bei wenigen Schüssen in der seines Rings */}
      {(layer.points ?? []).map(([x, y, ring, band], i) => (
        <circle
          key={i}
          data-pattern-shot
          data-band={band ?? undefined}
          cx={x * POINT_MM}
          cy={-y * POINT_MM}
          r={calR}
          fill={band !== null ? HEAT_COLORS[band] : ring === null ? "none" : scoreColor(ring)}
          fillOpacity={band !== null ? SHOT_HEAT_OPACITY : SHOT_FILL_OPACITY}
          stroke="var(--shot-edge)"
          strokeWidth={1}
          strokeDasharray={band === null && ring === null ? "2 2" : undefined}
          {...HAIR}
        />
      ))}
      {layer.style !== "rings" && (
        <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} part="lines" />
      )}
      {layer.center && (
        <MpiMark
          x={layer.center.xUm / 1000}
          y={-layer.center.yUm / 1000}
          radius={sizes.mpiRadius}
        />
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
