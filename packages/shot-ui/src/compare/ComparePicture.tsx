"use client"

import type { ComparePicture as Picture } from "@vereinsheim/shot-core/analysis"
import type { Point } from "@vereinsheim/shot-core/geometry"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { cn } from "@vereinsheim/lib/utils"

import { useState } from "react"

import { caliberRadius, screenSizes, targetView, unitsPerPixel } from "../geometry"
import { contourPath } from "../period/contours"
import type { ViewBox } from "../types"
import { MpiMark } from "../target/MpiMark"
import { TargetBoard } from "../target/TargetBoard"
import { CornerButton, ZOOM_ICON } from "../target/TargetControls"
import { useAnimatedViewBox, useElementWidth } from "../target/useAnimatedViewBox"

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

/** die Mitte einer Seite: das Zeichen des Schwerpunkts mit einem Ring in der Farbe der Seite */
function Center({ at, side, radius }: { at: Point; side: Side; radius: number }) {
  const x = at.xUm / 1000
  const y = -at.yUm / 1000
  return (
    <g data-compare-center={side}>
      <MpiMark x={x} y={y} radius={radius} />
      <circle cx={x} cy={y} r={radius * 1.3} fill="none" stroke={EDGE} strokeWidth={5} {...HAIR} />
      <circle
        cx={x}
        cy={y}
        r={radius * 1.3}
        fill="none"
        stroke={SIDE_COLORS[side]}
        strokeWidth={3}
        {...HAIR}
      />
    </g>
  )
}

/**
 * der Ausschnitt um die Gruppe beider Seiten wie auf der Seite einer Scheibe (`groupView`): Kreis plus halbes Kaliber,
 * um 30 % erweitert, mindestens fünf halbe Kaliber; ohne Gruppe die ganze Scheibe
 */
export function focusView(target: TargetImage, focus: Picture["focus"]): ViewBox {
  if (!focus) return targetView(target)
  const calR = caliberRadius(target)
  const half = Math.max((focus.radiusUm / 1000 + calR) * 1.3, calR * 5)
  return { x: focus.xUm / 1000 - half, y: -focus.yUm / 1000 - half, w: 2 * half }
}

/** die Namen der Seiten unter dem Bild, je mit dem Punkt ihrer Farbe */
export function SideLegend({ a, b }: { a: string; b: string }) {
  const sides = [
    ["a", a],
    ["b", b],
  ] as const
  return (
    <div data-side-legend className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-foreground-2">
      {sides.map(([side, name]) => (
        <span key={side} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: SIDE_COLORS[side] }}
          />
          {name}
        </span>
      ))}
    </div>
  )
}

/**
 * Das Bild zweier Seiten auf der Scheibe, wie die Seite einer Scheibe sie zeichnet (`TargetBoard`: Flächen unten, Ringe
 * und Ringzahlen über den Seiten). Je Seite ein Umriss oder Punkte (`comparePicture`), B zuerst, A darüber: Ein Umriss
 * ist die Fläche mit 9 von 10 Schüssen gestrichelt und die mit der Hälfte durchgezogen, bei A getönt; Punkte sind jeder
 * Schuss in Kalibergröße in der Farbe seiner Seite. Darüber die beiden Mitten mit einem Ring in der Farbe ihrer Seite. Das Bild öffnet auf
 * der Gruppe beider Seiten; die Lupe oben links zeigt die ganze Scheibe und zurück, wie auf der Seite einer Scheibe.
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
  const [group, setGroup] = useState(true)
  const view = useAnimatedViewBox(group ? focusView(target, picture.focus) : targetView(target))
  const sizes = screenSizes(target, unitsPerPixel(view, width))
  const calR = caliberRadius(target)
  const sides = ["b", "a"] as const
  return (
    <div className={cn("relative", className)}>
      <svg
        ref={measure}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        role="img"
        aria-label={`Bild beider Seiten: ${label}`}
        data-compare-picture={picture.style}
        className="block aspect-square h-auto w-full rounded-xl border border-border select-none"
      >
        <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} part="fills" />
        {sides.map((side) => {
          const own = picture[side]
          if (own.kind === "dots")
            return own.points.map(([x, y], i) => (
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
          const inner = contourPath(own.grid, own.grid.levels[INNER], picture.halfUm)
          return (
            <g key={side}>
              {side === "a" && (
                <path d={inner} fill={SIDE_COLORS.a} fillOpacity={0.4} fillRule="evenodd" />
              )}
              <Outline
                d={contourPath(own.grid, own.grid.levels[OUTER], picture.halfUm)}
                side={side}
                dashed
              />
              <Outline d={inner} side={side} dashed={false} />
            </g>
          )
        })}
        <TargetBoard target={target} view={view} ringLabel={sizes.ringLabel} part="lines" />
        {sides.map((side) => {
          const center = picture[side].center
          return center ? (
            <Center key={side} at={center} side={side} radius={sizes.mpiRadius} />
          ) : null
        })}
      </svg>
      {/* ohne Schuss gibt es keine Gruppe, auf die das Bild zoomen könnte */}
      {picture.focus && (
        <div className="pointer-events-none absolute top-2 left-2">
          <CornerButton label="Auf Gruppe zoomen" pressed={group} onPress={() => setGroup(!group)}>
            {ZOOM_ICON}
          </CornerButton>
        </div>
      )}
    </div>
  )
}
