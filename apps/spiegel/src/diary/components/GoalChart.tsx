import { formatMonthShort } from "@vereinsheim/lib/format"

import type { GoalPoint } from "../goals/measure"

const W = 340
const H = 120
const PAD = { left: 8, right: 34, top: 12, bottom: 22 }

/**
 * Der Verlauf eines Ziels: ein Punkt je gezählter Scheibe oder Serie in zeitlicher Folge, die Linie des Ziels
 * gestrichelt in Gold, die Punkte ab der Linie in Gold, die übrigen leise. Unten nur der erste und letzte Monat.
 */
export function GoalChart({
  points,
  threshold,
  thresholdLabel,
  timeZone,
}: {
  points: readonly GoalPoint[]
  threshold: number
  thresholdLabel: string
  timeZone: string
}) {
  if (!points.length) return null
  const values = points.map((p) => p.value)
  const low = Math.min(threshold, ...values)
  const high = Math.max(threshold, ...values)
  const span = high - low || 1
  const y = (value: number) => PAD.top + (1 - (value - low) / span) * (H - PAD.top - PAD.bottom)
  const x = (i: number) =>
    points.length === 1
      ? (W - PAD.right + PAD.left) / 2
      : PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  const month = (ms: number) => formatMonthShort(new Date(ms), timeZone)
  const line = y(threshold)
  return (
    <svg
      data-goal-chart
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Verlauf mit der Linie bei ${thresholdLabel}`}
    >
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={line}
        y2={line}
        stroke="var(--gold)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <text x={W - PAD.right + 4} y={line + 4} fontSize={11} fill="var(--gold)">
        {thresholdLabel}
      </text>
      {points.map((p, i) => (
        <circle
          key={`${p.cardId}-${p.series ?? 0}`}
          cx={x(i)}
          cy={y(p.value)}
          r={p.hit ? 5 : 4.5}
          fill={p.hit ? "var(--gold)" : "var(--quiet)"}
          stroke={p.hit ? "var(--card)" : "none"}
          strokeWidth={1.5}
        />
      ))}
      <text x={PAD.left} y={H - 4} fontSize={11} fill="var(--muted-foreground)">
        {month(points[0].startedAtMs)}
      </text>
      {points.length > 1 && (
        <text
          x={W - PAD.right}
          y={H - 4}
          fontSize={11}
          textAnchor="end"
          fill="var(--muted-foreground)"
        >
          {month(points[points.length - 1].startedAtMs)}
        </text>
      )}
    </svg>
  )
}
