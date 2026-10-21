"use client"

import type { PositionOverTime } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatDateOnly } from "@vereinsheim/lib/format"
import type { PointerEvent } from "react"

import { ValuesTable } from "../analysis/charts/ChartRuler"
import { directionName, formatValue } from "../format"
import { MpiMark } from "../target/MpiMark"
import { TargetFace } from "../target/TargetFace"
import { nearestPoint } from "./nearest"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const

/** halbe Kantenlänge in mm: alle Schwerpunkte mit Rand, mindestens 1,5 mm (die Zehn bleibt zu sehen) */
export function positionHalfMm(overTime: Pick<PositionOverTime, "points">): number {
  const far = Math.max(0, ...overTime.points.map((p) => Math.hypot(p.center.xUm, p.center.yUm)))
  return Math.max(1.5, (far / 1000) * 1.25)
}

/**
 * Lage über Zeit (L10): der Schwerpunkt jeder Scheibe als Punkt auf dem Scheibenbild, größer mit mehr Schüssen, eine
 * dünne Linie in zeitlicher Folge, das Mittel als Schwerpunkt-Zeichen. Antippen wählt die nächste Scheibe für die
 * Ablesung der Seite; die gewählte ist hervorgehoben. Die Werte stehen für Tastatur und Screenreader in der Tabelle.
 */
export function PositionChart({
  overTime,
  target,
  timeZone,
  chosen,
  onChoose,
}: {
  overTime: PositionOverTime
  target: TargetImage
  timeZone: string
  /** die gewählte Scheibe der Seite */
  chosen: string | null
  onChoose?: (id: string) => void
}) {
  const half = positionHalfMm(overTime)
  const view = { x: -half, y: -half, w: 2 * half }
  const base = view.w * 0.012
  const points = overTime.points.map((p) => ({
    id: p.id,
    x: p.center.xUm / 1000,
    y: -p.center.yUm / 1000,
    r: base * Math.sqrt(Math.max(1, p.n) / 40),
  }))
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const matrix = svg.getScreenCTM()
    if (!onChoose || !matrix) return
    const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const index = nearestPoint(points, { x: at.x, y: at.y })
    if (index !== null) onChoose(points[index].id)
  }
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  return (
    <div className="grid gap-2">
      <svg
        viewBox={`${view.x} ${view.y} ${view.w} ${view.w}`}
        role="img"
        aria-label="Schwerpunkt je Scheibe auf der Scheibe"
        data-position-chart="true"
        onPointerUp={pick}
        className="mx-auto block aspect-square h-auto w-full max-w-[22rem] cursor-pointer rounded-xl border border-border select-none"
      >
        <TargetFace target={target} view={view} />
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            opacity={0.6}
            {...HAIR}
          />
        )}
        {points.map((p) => (
          <circle
            key={p.id}
            data-position-card={p.id}
            aria-current={p.id === chosen ? "true" : undefined}
            cx={p.x}
            cy={p.y}
            r={p.id === chosen ? p.r * 1.6 : p.r}
            fill="var(--primary)"
            fillOpacity={p.id === chosen ? 1 : 0.6}
            stroke={p.id === chosen ? "var(--foreground)" : "var(--shot-edge)"}
            strokeWidth={p.id === chosen ? 2 : 1}
            {...HAIR}
          />
        ))}
        {overTime.mean && (
          <MpiMark x={overTime.mean.xUm / 1000} y={-overTime.mean.yUm / 1000} radius={base * 1.6} />
        )}
      </svg>
      <ValuesTable
        caption="Schwerpunkt je Scheibe"
        columns={["Datum", "Richtung", "Abstand zur Mitte", "Schuss"]}
        rows={overTime.points.map((p) => [
          date(p.atMs),
          directionName(p.center),
          `${formatValue(Math.hypot(p.center.xUm, p.center.yUm) / 1000, 2)} mm`,
          String(p.n),
        ])}
      />
    </div>
  )
}
