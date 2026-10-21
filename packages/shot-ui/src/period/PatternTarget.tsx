import type { PatternLayer } from "@vereinsheim/shot-core/analysis"
import type { Point } from "@vereinsheim/shot-core/geometry"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius } from "../geometry"
import { MpiMark } from "../target/MpiMark"
import { TargetFace } from "../target/TargetFace"
import { contourPath } from "./contours"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte im Muster: 10 µm (`periodPattern`) */
const POINT_MM = 0.01

export interface PatternTargetProps {
  /** eine Sicht aus `periodPattern`: Punkte unter 300 Schuss, sonst die Dichte */
  layer: PatternLayer
  target: TargetImage
  /** der Schwerpunkt aller Scheiben, nur in der Lage-Sicht; null: kein Zeichen */
  center: Point | null
  /** der Satz unter dem Bild als Name des Bilds */
  label: string
  className?: string
}

/**
 * Trefferbild über einen Zeitraum (L9): das Scheibenbild um die Mitte, darüber jeder Schuss als kleiner Punkt oder die
 * Dichte als zwei Flächen (außen neun von zehn Schüssen, innen die Hälfte), in der Lage-Sicht der Schwerpunkt aller
 * Scheiben. Das Bild trägt den Satz als Namen, die Worte stehen daneben.
 */
export function PatternTarget({ layer, target, center, label, className }: PatternTargetProps) {
  const half = layer.halfUm / 1000
  const view = { x: -half, y: -half, w: 2 * half }
  const dot = 0.35 * caliberRadius(target)
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      role="img"
      aria-label={label}
      data-pattern-target={layer.grid ? "density" : "points"}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      <TargetFace target={target} view={view} />
      {layer.grid ? (
        <>
          <path
            data-pattern-area="outer"
            d={contourPath(layer.grid, layer.grid.outer, layer.halfUm)}
            fill="var(--primary)"
            fillOpacity={0.22}
            fillRule="evenodd"
            stroke="var(--primary)"
            strokeWidth={1}
            {...HAIR}
          />
          <path
            data-pattern-area="inner"
            d={contourPath(layer.grid, layer.grid.inner, layer.halfUm)}
            fill="var(--primary)"
            fillOpacity={0.45}
            fillRule="evenodd"
            stroke="var(--primary)"
            strokeWidth={1}
            {...HAIR}
          />
        </>
      ) : (
        (layer.points ?? []).map(([x, y], i) => (
          <circle
            key={i}
            cx={x * POINT_MM}
            cy={-y * POINT_MM}
            r={dot}
            fill="var(--primary)"
            fillOpacity={0.5}
          />
        ))
      )}
      {center && <MpiMark x={center.xUm / 1000} y={-center.yUm / 1000} radius={view.w * 0.022} />}
    </svg>
  )
}
