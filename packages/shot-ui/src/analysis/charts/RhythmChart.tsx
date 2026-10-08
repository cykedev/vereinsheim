import { rhythmProfile } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"

import { durationText } from "../../format"
import { ChartSvg, crisp, niceStep } from "./frame"

const HEIGHT = 190
const PAD = { left: 36, right: 12, top: 18, bottom: 26 }

/**
 * Rhythmus (Spielwiese `rhythmChart`): Abstand zum vorigen Schuss als Säule, eine Pause gekappt, in der
 * Farbe für Hinweise und mit ihrer Dauer beschriftet, dazu der Median der letzten fünf Abstände als
 * Linie; ab zwei Abständen.
 */
export function RhythmChart({ width, shots }: { width: number; shots: readonly MetricShot[] }) {
  const profile = rhythmProfile(shots, 5)
  const timed = profile.filter((p) => p.intervalMs !== null)
  if (timed.length < 2) return null
  const normal = timed.filter((p) => !p.pause).map((p) => (p.intervalMs as number) / 1000)
  const highest = Math.max(10, ...normal)
  const step = niceStep(highest, 3)
  const cap = Math.ceil((highest * 1.12) / step) * step
  const n = profile[profile.length - 1].number
  const x = (k: number) =>
    PAD.left + ((k - 1) / Math.max(1, n - 1)) * (width - PAD.left - PAD.right)
  const y = (sec: number) =>
    PAD.top + (1 - Math.min(sec, cap) / cap) * (HEIGHT - PAD.top - PAD.bottom)
  const bw = Math.max(2, Math.min(10, ((width - PAD.left - PAD.right) / Math.max(1, n - 1)) * 0.55))
  const grid: number[] = []
  for (let v = 0; v <= cap + 1e-9; v += step) grid.push(v)
  const tick = n > 30 ? 10 : 5
  const ticks: number[] = []
  for (let k = 1; k <= n; k++) if (k === 1 || k % tick === 0) ticks.push(k)
  const line = profile.filter((p) => p.medianMs !== null)

  return (
    <ChartSvg width={width} height={HEIGHT} label="Abstände zwischen den Schüssen">
      {grid.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={crisp(y(v))}
            y2={crisp(y(v))}
            stroke={v === 0 ? "var(--line-strong)" : "var(--border)"}
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central">
            {`${v} s`}
          </text>
        </g>
      ))}
      {timed.map((p) => {
        const ms = p.intervalMs as number
        const top = y(ms / 1000)
        const base = y(0)
        return (
          <g key={p.number}>
            <rect
              data-interval={p.number}
              data-pause={p.pause || undefined}
              x={x(p.number) - bw / 2}
              y={top}
              width={bw}
              height={Math.max(1, base - top)}
              rx={Math.min(2, bw / 2)}
              fill={p.pause ? "var(--warning)" : "var(--primary)"}
              fillOpacity={p.pause ? 0.85 : 0.45}
            >
              <title>{`vor Schuss ${p.number}: ${durationText(ms)}${p.pause ? " (Pause)" : ""}`}</title>
            </rect>
            {p.pause && (
              <text data-value x={x(p.number) + bw / 2 + 4} y={PAD.top + 8}>
                {durationText(ms)}
              </text>
            )}
          </g>
        )
      })}
      {line.length > 1 && (
        <path
          data-median="true"
          d={line
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${x(p.number).toFixed(1)} ${y((p.medianMs as number) / 1000).toFixed(1)}`
            )
            .join("")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {ticks.map((k) => (
        <text key={k} x={x(k)} y={HEIGHT - 6} textAnchor="middle">
          {k}
        </text>
      ))}
    </ChartSvg>
  )
}
