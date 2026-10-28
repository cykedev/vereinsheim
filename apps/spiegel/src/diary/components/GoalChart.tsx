"use client"

import { formatMonthShort, formatShortDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { ChartSlot, ChartSvg } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { ValuesTable } from "@vereinsheim/shot-ui/analysis/charts/ChartRuler"
import { formatValue } from "@vereinsheim/shot-ui/format"

import type { GoalPoint } from "../goals/measure"

const H = 120
const PAD = { left: 6, right: 40, top: 10, bottom: 22 }

/**
 * Der Verlauf eines Ziels in Bildschirm-Pixeln (Schrift 12 px wie jedes Diagramm): ein Punkt je gezählter Scheibe oder
 * Serie in zeitlicher Folge, die Linie des Ziels gestrichelt in Gold, die Punkte ab der Linie in Gold, die übrigen
 * leise. Unten der erste und letzte Monat, darunter die Werte als Tabelle.
 */
export function GoalChart({
  points,
  threshold,
  thresholdLabel,
  digits,
  timeZone,
}: {
  points: readonly GoalPoint[]
  threshold: number
  thresholdLabel: string
  /** Stellen der Werte: 0 in ganzen Ringen, 1 in Zehnteln */
  digits: number
  timeZone: string
}) {
  if (!points.length) return null
  const values = points.map((p) => p.value)
  const low = Math.min(threshold, ...values)
  const high = Math.max(threshold, ...values)
  const span = high - low || 1
  const y = (value: number) => PAD.top + (1 - (value - low) / span) * (H - PAD.top - PAD.bottom)
  const month = (ms: number) => formatMonthShort(new Date(ms), timeZone)
  const label = `Verlauf mit der Linie bei ${thresholdLabel}`
  const bySeries = points.some((p) => p.series !== null)
  return (
    <div data-goal-chart className="grid gap-2">
      <ChartSlot height={H}>
        {(width) => {
          const x = (i: number) =>
            points.length === 1
              ? (width - PAD.right + PAD.left) / 2
              : PAD.left + (i / (points.length - 1)) * (width - PAD.left - PAD.right)
          const line = y(threshold)
          return (
            <ChartSvg width={width} height={H} label={label}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={line}
                y2={line}
                stroke="var(--gold)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text x={width - PAD.right + 6} y={line + 4} data-value>
                {thresholdLabel}
              </text>
              {points.map((p, i) => (
                <circle
                  key={`${p.cardId}-${p.series ?? 0}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={p.hit ? 5 : 4.5}
                  fill={p.hit ? "var(--gold)" : "var(--quiet)"}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
              ))}
              <text x={PAD.left} y={H - 4}>
                {month(points[0].startedAtMs)}
              </text>
              {points.length > 1 && (
                <text x={width - PAD.right} y={H - 4} textAnchor="end">
                  {month(points[points.length - 1].startedAtMs)}
                </text>
              )}
            </ChartSvg>
          )
        }}
      </ChartSlot>
      <ValuesTable
        caption={label}
        columns={bySeries ? ["Tag", "Serie", "Ringe"] : ["Tag", "Ringe"]}
        rows={points.map((p) => [
          formatShortDate(new Date(zonedDayStartMs(p.day, timeZone) + 12 * 3_600_000), timeZone),
          ...(bySeries ? [String(p.series)] : []),
          formatValue(p.value, digits),
        ])}
      />
    </div>
  )
}
