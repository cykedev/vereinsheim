"use client"

import type { PositionOverTime } from "@vereinsheim/shot-core/analysis"
import { formatDateOnly, formatMonthShort } from "@vereinsheim/lib/format"

import {
  RulerMark,
  RulerReadout,
  RULER_HINT,
  useRuler,
  ValuesTable,
} from "../analysis/charts/ChartRuler"
import { ChartSvg, crisp, niceStep } from "../analysis/charts/frame"
import { formatValue } from "../format"
import { monthStarts } from "./PeriodChart"

/** eine Zeitreihe: Abstand zur Mitte in einer Richtung, oben positiv */
const ROWS = [
  { key: "x", up: "rechts", down: "links", value: (p: { xUm: number; yUm: number }) => p.xUm },
  { key: "y", up: "hoch", down: "tief", value: (p: { xUm: number; yUm: number }) => p.yUm },
] as const

const PAD = { left: 48, right: 10, top: 8, bottom: 22 }
const ROW_H = 92
const GAP = 14
export const TIMELINE_HEIGHT = PAD.top + 2 * ROW_H + GAP + PAD.bottom

/** gleitender Schnitt der bis zu fünf letzten Scheiben über ihre Schüsse, in Folge ([[adr-034]]) */
export function trailingMean(
  values: readonly { value: number; n: number }[],
  window = 5
): number[] {
  return values.map((_, i) => {
    const part = values.slice(Math.max(0, i - window + 1), i + 1)
    const shots = part.reduce((s, v) => s + v.n, 0)
    return part.reduce((s, v) => s + v.value * v.n, 0) / shots
  })
}

/**
 * halbe Höhe beider Zeitreihen in µm, gleich für beide: neun von zehn Abständen mit Rand, auf eine runde Teilung,
 * mindestens 0,5 mm. Eine einzelne Scheibe weit draußen staucht so die übrigen nicht an die Mitte; sie steht als Ring
 * am Rand, ihren Wert sagt die Ablesung.
 */
export function timelineLimit(points: Pick<PositionOverTime, "points">["points"]): number {
  const far = points
    .flatMap((p) => [Math.abs(p.center.xUm), Math.abs(p.center.yUm)])
    .sort((a, b) => a - b)
  const reach = Math.max(500, (far.length ? far[Math.ceil(0.9 * far.length) - 1] : 0) * 1.3)
  const step = niceStep(reach / 1000, 2) * 1000
  return Math.ceil(reach / step) * step
}

/** „1,2 mm rechts“, „mittig“ unter 0,05 mm */
const offsetText = (um: number, up: string, down: string) =>
  Math.abs(um) < 50 ? "mittig" : `${formatValue(Math.abs(um) / 1000, 1)} mm ${um > 0 ? up : down}`

/**
 * Lage über Zeit (L10) als zwei Zeitreihen wie der Verlauf: oben links und rechts, unten tief und hoch, jede Scheibe
 * ein Punkt mit ihrem Schwerpunkt, die Linie der Schnitt der letzten fünf, gestrichelt die Mitte. Das Lineal wählt die
 * Scheibe für die Ablesung der Seite (Tippen, Ziehen, Pfeiltasten); die Werte stehen auch als Tabelle.
 */
export function PositionTimeline({
  overTime,
  width,
  timeZone,
  chosen,
  onChoose,
}: {
  overTime: Pick<PositionOverTime, "points">
  width: number
  timeZone: string
  chosen: string | null
  onChoose?: (id: string) => void
}) {
  const points = overTime.points
  const first = points[0]?.atMs ?? 0
  const last = points.at(-1)?.atMs ?? first
  const span = Math.max(1, last - first)
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const xOf = (ms: number) => PAD.left + ((ms - first) / span) * plotW
  const xs = points.map((p) => xOf(p.atMs))
  const preset = points.findIndex((p) => p.id === chosen)
  const ruler = useRuler(xs, width, preset < 0 ? null : preset, (i) => {
    if (i !== null && points[i]) onChoose?.(points[i].id)
  })
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const index = ruler.index
  const text =
    index === null
      ? null
      : `${date(points[index].atMs)} · ${offsetText(points[index].center.xUm, "rechts", "links")} · ${offsetText(points[index].center.yUm, "hoch", "tief")}`
  const limit = timelineLimit(points)
  const ticks = monthStarts(first, last, timeZone)
  const tickEvery = Math.max(1, Math.ceil((ticks.length * 34) / plotW))
  const base = PAD.top + 2 * ROW_H + GAP
  return (
    <div className="grid gap-2">
      <RulerReadout text={text} />
      <ChartSvg
        width={width}
        height={TIMELINE_HEIGHT}
        label="Lage über Zeit, links und rechts, tief und hoch"
        svgProps={{ ...ruler.svgProps, "aria-valuetext": text ?? RULER_HINT }}
      >
        {ROWS.map((row, r) => {
          const top = PAD.top + r * (ROW_H + GAP)
          const yOf = (um: number) => top + ROW_H / 2 - (um / limit) * (ROW_H / 2)
          const values = points.map((p) => row.value(p.center))
          const mean = trailingMean(points.map((p, i) => ({ value: values[i], n: p.n })))
          return (
            <g key={row.key} data-timeline-row={row.key}>
              <rect
                x={PAD.left}
                y={top}
                width={plotW}
                height={ROW_H}
                fill="var(--surface-2)"
                rx={6}
              />
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={crisp(yOf(0))}
                y2={crisp(yOf(0))}
                stroke="var(--line-strong)"
                strokeDasharray="4 4"
              />
              <text x={PAD.left - 6} y={top + 12} textAnchor="end">
                {row.up}
              </text>
              <text x={PAD.left - 6} y={yOf(0) + 4} textAnchor="end">
                Mitte
              </text>
              <text x={PAD.left - 6} y={top + ROW_H - 4} textAnchor="end">
                {row.down}
              </text>
              {values.length > 1 && (
                <polyline
                  points={values.map((_, i) => `${xs[i]},${yOf(mean[i])}`).join(" ")}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                />
              )}
              {values.map((v, i) => {
                const outside = Math.abs(v) > limit
                return (
                  <circle
                    key={points[i].id}
                    data-timeline-card={points[i].id}
                    data-outside={outside || undefined}
                    cx={xs[i]}
                    cy={yOf(Math.max(-limit, Math.min(limit, v)))}
                    r={i === index ? 4.5 : 3}
                    fill={outside ? "none" : "var(--primary)"}
                    fillOpacity={i === index ? 1 : 0.5}
                    stroke={i === index ? "var(--foreground)" : outside ? "var(--primary)" : "none"}
                    strokeWidth={1.5}
                  />
                )
              })}
            </g>
          )
        })}
        {ticks.map((at, i) =>
          i % tickEvery ? null : (
            <text key={at} x={xOf(at) + 3} y={TIMELINE_HEIGHT - 6}>
              {formatMonthShort(new Date(at), timeZone)}
            </text>
          )
        )}
        {index !== null && <RulerMark x={xs[index]} top={PAD.top} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption="Schwerpunkt je Scheibe"
        columns={["Datum", "links oder rechts", "tief oder hoch", "Schuss"]}
        rows={points.map((p) => [
          date(p.atMs),
          offsetText(p.center.xUm, "rechts", "links"),
          offsetText(p.center.yUm, "hoch", "tief"),
          String(p.n),
        ])}
      />
    </div>
  )
}
