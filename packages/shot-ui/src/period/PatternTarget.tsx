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
import { DensityOutlines } from "./DensityOutlines"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte im Muster: 10 µm (`periodPattern`) */
const POINT_MM = 0.01
/** Farben der Dichte von selten nach oft */
export const HEAT_COLORS = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
] as const
/** Deckkraft der Treffer in der Farbe der Dichte: Überlagerungen bleiben zu sehen, der Spiegel scheint durch */
const SHOT_HEAT_OPACITY = 0.85

/** wie das Bild von 50 bis 3.000 Schuss zeichnet: Treffer in den Farben der Dichte oder die Umrisse */
export type PatternView = "density" | "outlines"

export interface PatternTargetProps {
  /** das Bild aus `periodPattern`: Treffer in Ringfarbe, Treffer in Dichtefarbe oder nur die Umrisse */
  layer: PatternLayer
  target: TargetImage
  /** der Satz unter dem Bild als Name des Bilds */
  label: string
  /** gilt nur bei `shots`: Unter 50 Schuss stehen immer die Treffer, über 3.000 immer die Umrisse */
  view?: PatternView
  className?: string
}

/**
 * Trefferbild über einen Zeitraum (L9) auf der Scheibe, wie die Seite einer Scheibe sie zeichnet (`TargetBoard`:
 * Papier, Spiegel, Ringe, Ringzahlen). Bis 3.000 Schuss jeder Treffer in Kalibergröße, gefärbt nach der Dichte an
 * seiner Stelle von selten (hellviolett) bis oft (gelb), die dichten zuletzt; unter 50 Schuss in seiner Ringfarbe, weil
 * eine Dichte dann nichts sagt. Mit `view` „outlines“ und über 3.000 Schuss immer stehen statt der Treffer die
 * Umrisse wie beim Vergleichen (`DensityOutlines`): durchgezogen und getönt die Hälfte der Schüsse, gestrichelt 9 von
 * 10. Der geviertelte Kreis ist die Mitte aller Schüsse. Ringzahlen und Schwerpunkt richten sich wie auf der Scheibe
 * nach der gemessenen Breite.
 */
export function PatternTarget({
  layer,
  target,
  label,
  view: wanted = "density",
  className,
}: PatternTargetProps) {
  const outlines =
    layer.style === "outlines" || (layer.style === "shots" && wanted === "outlines")
      ? layer.grid
      : null
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
      aria-label={`Trefferbild über den Zeitraum: ${label}`}
      data-pattern-target={layer.style}
      data-pattern-view={outlines ? "outlines" : "density"}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      {/* bei wenigen Treffern wie auf der Seite einer Scheibe; sonst liegen Ringe und Ringzahlen über den Treffern
          oder Umrissen, damit man sieht, was wo ist */}
      <TargetBoard
        target={target}
        view={view}
        ringLabel={sizes.ringLabel}
        part={layer.style === "rings" ? "all" : "fills"}
      />
      {outlines && (
        <DensityOutlines
          grid={outlines}
          halfUm={layer.halfUm}
          color="var(--compare-a)"
          name="pattern"
          tint
        />
      )}
      {/* jeder Treffer: in der Farbe der Dichte an seiner Stelle, bei wenigen Schüssen in der seines Rings */}
      {(outlines ? [] : (layer.points ?? [])).map(([x, y, ring, band], i) => (
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

/** Legende der Dichte: ein Verlauf von selten nach oft in ihren Farben */
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
