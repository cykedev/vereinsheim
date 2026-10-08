import { movingAverage, pauseRecovery } from "@vereinsheim/shot-core/analysis"
import { shotNumbers, type MetricShot, type Scoring } from "@vereinsheim/shot-core/metrics"

import { formatValue } from "../../format"
import { scoreColor } from "../../geometry"
import { ChartSvg, crisp } from "./frame"

const HEIGHT = 230
const PAD = { left: 30, right: 12, top: 24, bottom: 26 }

/**
 * Verlauf (Spielwiese `courseChart`): Wert je Schuss in Ringwert-Farbe, gleitender Schnitt über zehn
 * (gestrichelt, solange es noch keine zehn sind), Serien mit Trenner und Namen, Pausen als gestrichelte
 * Linie. Achse bis 10 in ganzen Ringen, bis 10,9 in Zehnteln; ab zwei Schuss mit Wert.
 */
export function CourseChart({
  width,
  shots,
  scoring,
}: {
  width: number
  shots: readonly MetricShot[]
  scoring: Scoring
}) {
  const avg = movingAverage(shots, scoring, 10)
  if (avg.length < 2) return null
  const maxN = avg[avg.length - 1].number
  const values = avg.map((p) => p.value)
  const top = scoring === "rings" ? 10 : 10.9
  const low = Math.min(Math.floor(Math.min(...values)), Math.floor(top) - 2)
  const x = (n: number) => PAD.left + ((n - 1) / (maxN - 1)) * (width - PAD.left - PAD.right)
  const y = (v: number) =>
    PAD.top + ((top + 0.15 - v) / (top + 0.15 - (low - 0.15))) * (HEIGHT - PAD.top - PAD.bottom)
  const grid: number[] = []
  for (let r = Math.ceil(low); r <= Math.floor(top); r++) grid.push(r)

  // Serien über die Schussnummern: erste und letzte Nummer je Serie
  const numbers = shotNumbers(shots)
  const ranges = new Map<number, [number, number]>()
  for (const shot of shots) {
    const n = numbers.get(shot)
    if (shot.series === null || n === undefined) continue
    const r = ranges.get(shot.series) ?? [n, n]
    ranges.set(shot.series, [Math.min(r[0], n), Math.max(r[1], n)])
  }
  const series = [...ranges].sort((a, b) => a[1][0] - b[1][0])
  const pauses = pauseRecovery(shots, scoring)?.effects ?? []
  const step = maxN > 30 ? 10 : 5
  const ticks: number[] = []
  for (let n = 1; n <= maxN; n++) if (n === 1 || n % step === 0) ticks.push(n)
  const path = (points: typeof avg) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${x(p.number).toFixed(1)} ${y(p.meanRings).toFixed(1)}`)
      .join("")
  const fullFrom = avg.findIndex((p) => !p.partial)
  const partial = avg.filter((p) => p.partial)
  const digits = scoring === "rings" ? 0 : 1

  return (
    <ChartSvg width={width} height={HEIGHT} label="Wert je Schuss mit gleitendem Schnitt">
      {grid.map((r) => (
        <g key={r}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={crisp(y(r))}
            y2={crisp(y(r))}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={y(r)} textAnchor="end" dominantBaseline="central">
            {r}
          </text>
        </g>
      ))}
      {series.map(([name, [first, last]], k) => {
        const between = crisp((x(last) + x(last + 1)) / 2)
        return (
          <g key={name}>
            <text x={(x(first) + x(Math.min(last, maxN))) / 2} y={12} textAnchor="middle">
              {`S${name}`}
            </text>
            {k < series.length - 1 && last < maxN && (
              <line
                data-series-separator={last}
                x1={between}
                x2={between}
                y1={PAD.top - 6}
                y2={HEIGHT - PAD.bottom}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
            )}
          </g>
        )
      })}
      {pauses.map((effect) => {
        const at = crisp((x(effect.afterShot - 1) + x(effect.afterShot)) / 2)
        return (
          <line
            key={effect.afterShot}
            data-pause-line={effect.afterShot}
            x1={at}
            x2={at}
            y1={PAD.top - 6}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--warning)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )
      })}
      {ticks.map((n) => (
        <text key={n} x={x(n)} y={HEIGHT - 6} textAnchor="middle">
          {n}
        </text>
      ))}
      {partial.length > 0 && (
        <path
          data-average="partial"
          d={path(fullFrom > 0 ? avg.slice(0, fullFrom + 1) : partial)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
      )}
      {fullFrom >= 0 && (
        <path
          data-average="full"
          d={path(avg.slice(fullFrom))}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {avg.map((p) => (
        <circle
          key={p.number}
          data-course-point={p.number}
          cx={x(p.number)}
          cy={y(p.value)}
          r={3.5}
          fill={scoreColor(scoring === "rings" ? p.value : Math.floor(p.value + 1e-9))}
          stroke="var(--card)"
          strokeWidth={1}
        >
          <title>{`Schuss ${p.number}: ${formatValue(p.value, digits)}`}</title>
        </circle>
      ))}
    </ChartSvg>
  )
}
