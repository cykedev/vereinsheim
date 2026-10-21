"use client"

import type { ComparePicture as Picture } from "@vereinsheim/shot-core/analysis"
import type { Point } from "@vereinsheim/shot-core/geometry"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { caliberRadius, screenSizes, unitsPerPixel } from "../geometry"
import { contourPath } from "../period/contours"
import { MpiMark } from "../target/MpiMark"
import { TargetBoard } from "../target/TargetBoard"
import { useElementWidth } from "../target/useAnimatedViewBox"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Raster der Punkte: 10 µm (`comparePicture`) */
const POINT_MM = 0.01
/** Stufen der Umrisse in `HEAT_SHARES`: 9 von 10 und die Hälfte der Schüsse */
const OUTER = 1
const INNER = 3
/** Saum unter Linien und Buchstaben, damit sie auf Papier, Spiegel und Ringen stehen */
const EDGE = "var(--shot-edge)"

export const SIDE_COLORS = { a: "var(--compare-a)", b: "var(--compare-b)" } as const

type Side = keyof typeof SIDE_COLORS

/** ein Umriss mit dunklem Saum: gestrichelt die Fläche mit 9 von 10, durchgezogen die mit der Hälfte der Schüsse */
function Outline({ d, side, dashed }: { d: string; side: Side; dashed: boolean }) {
  return (
    <g data-compare-outline={side} data-dashed={dashed || undefined}>
      <path d={d} fill="none" stroke={EDGE} strokeWidth={5} fillRule="evenodd" {...HAIR} />
      <path
        d={d}
        fill="none"
        stroke={SIDE_COLORS[side]}
        strokeWidth={2.5}
        strokeDasharray={dashed ? "6 4" : undefined}
        fillRule="evenodd"
        {...HAIR}
      />
    </g>
  )
}

/** die Mitte einer Seite: das Zeichen des Schwerpunkts, ein Ring in der Farbe der Seite und ihr Buchstabe */
function Center({ at, side, radius }: { at: Point; side: Side; radius: number }) {
  const x = at.xUm / 1000
  const y = -at.yUm / 1000
  return (
    <g data-compare-center={side}>
      <MpiMark x={x} y={y} radius={radius} />
      <circle
        cx={x}
        cy={y}
        r={radius * 1.25}
        fill="none"
        stroke={SIDE_COLORS[side]}
        strokeWidth={3}
        {...HAIR}
      />
      <text
        x={x + radius * 1.8}
        y={y - radius * 1.4}
        fontSize={radius * 2.2}
        fontWeight={700}
        fill={SIDE_COLORS[side]}
        stroke={EDGE}
        strokeWidth={3}
        paintOrder="stroke"
        style={{ fontFamily: "var(--font-display)" }}
        {...HAIR}
      >
        {side.toUpperCase()}
      </text>
    </g>
  )
}

/**
 * Das Bild zweier Seiten auf der Scheibe, wie die Seite einer Scheibe sie zeichnet (`TargetBoard`: Flächen unten, Ringe
 * und Ringzahlen über den Seiten). Ab 50 Schuss je Seite zwei Umrisse: B zuerst, A darüber, je die Fläche mit 9 von 10
 * Schüssen gestrichelt und die mit der Hälfte durchgezogen, bei A getönt. Sonst jeder Schuss in Kalibergröße in der
 * Farbe seiner Seite, B zuerst. Darüber die beiden Mitten mit A und B.
 */
export function ComparePicture({
  picture,
  target,
  label,
  className,
}: {
  picture: Picture
  target: TargetImage
  /** der Satz als Name des Bilds */
  label: string
  className?: string
}) {
  const [width, measure] = useElementWidth()
  const half = picture.halfUm / 1000
  const view = { x: -half, y: -half, w: 2 * half }
  const sizes = screenSizes(target, unitsPerPixel(view, width))
  const calR = caliberRadius(target)
  const sides = ["b", "a"] as const
  return (
    <svg
      ref={measure}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
      role="img"
      aria-label={`Bild beider Seiten: ${label}`}
      data-compare-picture={picture.style}
      className={cn(
        "block aspect-square h-auto w-full rounded-xl border border-border select-none",
        className
      )}
    >
      <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} part="fills" />
      {picture.style === "outlines"
        ? sides.map((side) => {
            const grid = picture[side].grid
            const inner = contourPath(grid, grid.levels[INNER], picture.halfUm)
            return (
              <g key={side}>
                {side === "a" && (
                  <path d={inner} fill={SIDE_COLORS.a} fillOpacity={0.4} fillRule="evenodd" />
                )}
                <Outline
                  d={contourPath(grid, grid.levels[OUTER], picture.halfUm)}
                  side={side}
                  dashed
                />
                <Outline d={inner} side={side} dashed={false} />
              </g>
            )
          })
        : sides.map((side) =>
            picture[side].points.map(([x, y], i) => (
              <circle
                key={`${side}${i}`}
                data-compare-shot={side}
                cx={x * POINT_MM}
                cy={-y * POINT_MM}
                r={calR}
                fill={SIDE_COLORS[side]}
                fillOpacity={0.85}
                stroke={EDGE}
                strokeWidth={1}
                {...HAIR}
              />
            ))
          )}
      <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} part="lines" />
      {sides.map((side) => {
        const center = picture[side].center
        return center ? (
          <Center key={side} at={center} side={side} radius={sizes.mpiRadius} />
        ) : null
      })}
    </svg>
  )
}
