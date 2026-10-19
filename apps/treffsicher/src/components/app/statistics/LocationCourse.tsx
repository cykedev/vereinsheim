"use client"

import type { TrendPoint } from "@vereinsheim/shot-core/analysis"
import {
  RulerMark,
  RulerReadout,
  useRuler,
  ValuesTable,
} from "@vereinsheim/shot-ui/analysis/charts/ChartRuler"
import { ChartSvg, crisp, niceStep } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { formatSigned, formatValue } from "@vereinsheim/shot-ui/format"
import { formatDateOnly, formatShortDay } from "@vereinsheim/lib/format"

import type { LocationSummary } from "@/lib/statistics/location"
import { locationText, tickDecimals } from "@/lib/statistics/locationText"

const HEIGHT = 200
const PAD = { left: 40, right: 12, top: 10, bottom: 22 }
const SERIES = [
  { axis: "x", color: "var(--chart-1)", label: "waagrecht (rechts +)" },
  { axis: "y", color: "var(--chart-2)", label: "senkrecht (hoch +)" },
] as const

/** Linie des Schnitts der letzten fünf: gestrichelt, solange es noch keine fünf sind */
function MeanLine({
  points,
  x,
  y,
  color,
}: {
  points: readonly TrendPoint[]
  x: (i: number) => number
  y: (v: number) => number
  color: string
}) {
  const path = (from: number, to: number) =>
    points
      .slice(from, to)
      .map((p, k) => `${k ? "L" : "M"}${x(from + k).toFixed(1)} ${y(p.mean).toFixed(1)}`)
      .join("")
  const full = points.findIndex((p) => !p.partial)
  const split = full < 0 ? points.length : full
  return (
    <>
      {split > 1 && (
        <path d={path(0, split)} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 4" />
      )}
      {full >= 0 && (
        <path
          d={path(Math.max(0, split - 1), points.length)}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      )}
    </>
  )
}

/**
 * Verlauf der Trefferlage: je Einheit waagrecht und senkrecht als Punkt, je Achse der Schnitt der letzten fünf als
 * Linie. Das Lineal wählt eine Einheit (die Wolke hebt sie hervor), darunter „Werte als Tabelle“.
 */
export function LocationCourse({
  width,
  summary,
  timeZone,
  chosen,
  onChoose,
}: {
  width: number
  summary: LocationSummary
  timeZone: string
  chosen: string | null
  onChoose: (id: string | null) => void
}) {
  const { points, course } = summary
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const x = (i: number) => PAD.left + (points.length > 1 ? i / (points.length - 1) : 0.5) * plotW
  const xs = points.map((_, i) => x(i))
  const preset = chosen === null ? null : points.findIndex((p) => p.id === chosen)
  const ruler = useRuler(xs, width, preset !== null && preset >= 0 ? preset : null, (i) =>
    onChoose(i === null ? null : (points[i]?.id ?? null))
  )
  const far = Math.max(1, ...points.flatMap((p) => [Math.abs(p.xMm), Math.abs(p.yMm)]))
  const step = niceStep(far, 2)
  const half = Math.ceil(far / step) * step
  const base = HEIGHT - PAD.bottom
  const y = (v: number) => PAD.top + ((half - v) / (2 * half)) * (base - PAD.top)
  const ticks: number[] = []
  for (let v = -half; v <= half + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  const index = ruler.index
  const text =
    index === null
      ? null
      : `${formatDateOnly(new Date(points[index].atMs), timeZone)} · ${locationText(points[index])}`
  const date = (ms: number) => formatShortDay(new Date(ms), timeZone)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-foreground-2">
        {SERIES.map((s) => (
          <span key={s.axis} className="inline-flex items-center gap-[7px]">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <RulerReadout text={text} />
      <ChartSvg
        width={width}
        height={HEIGHT}
        label="Trefferlage je Einheit, waagrecht und senkrecht, mit Schnitt der letzten fünf"
        svgProps={{ ...ruler.svgProps, "aria-valuetext": text ?? undefined }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={crisp(y(t))}
              y2={crisp(y(t))}
              stroke={t === 0 ? "var(--line-strong)" : "var(--border)"}
            />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {formatValue(t, tickDecimals(step))}
            </text>
          </g>
        ))}
        {points.length > 0 && (
          <>
            <text x={x(0)} y={HEIGHT - 6} textAnchor="start">
              {date(points[0].atMs)}
            </text>
            {points.length > 1 && (
              <text x={x(points.length - 1)} y={HEIGHT - 6} textAnchor="end">
                {date(points[points.length - 1].atMs)}
              </text>
            )}
          </>
        )}
        {SERIES.map((s) => (
          <g key={s.axis}>
            <MeanLine points={course[s.axis]} x={x} y={y} color={s.color} />
            {course[s.axis].map((p, i) => (
              <circle
                key={p.id}
                cx={x(i)}
                cy={y(p.value)}
                r={i === index ? 5 : 3.5}
                fill={s.color}
                stroke="var(--shot-edge)"
                strokeWidth={1}
              />
            ))}
          </g>
        ))}
        {index !== null && <RulerMark x={xs[index]} top={PAD.top} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption="Trefferlage je Einheit in mm"
        columns={["Datum", "waagrecht (rechts +)", "senkrecht (hoch +)"]}
        rows={points.map((p) => [
          formatDateOnly(new Date(p.atMs), timeZone),
          formatSigned(p.xMm, 2),
          formatSigned(p.yMm, 2),
        ])}
      />
    </div>
  )
}
