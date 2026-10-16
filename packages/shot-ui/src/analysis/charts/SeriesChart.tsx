import type { SeriesPoint } from "@vereinsheim/shot-core/analysis"
import { modalLength } from "@vereinsheim/shot-core/stats"

import { formatValue } from "../../format"
import { ChartSvg, crisp, niceStep } from "./frame"

const HEIGHT = 176
const PAD = { left: 40, right: 12, top: 30, bottom: 26 }
const INSET = 28

/**
 * Serienergebnisse: Linie über die Serien voller Länge, eine kurze Restserie
 * hohl und mit ihrer Länge, Werte über den Punkten; ab zwei Serien mit mindestens einem Wert.
 */
export function SeriesChart({
  width,
  series,
  digits,
}: {
  width: number
  series: readonly SeriesPoint[]
  /** Nachkommastellen der Werte: 1 in Zehnteln, 0 in ganzen Ringen */
  digits: number
}) {
  const totals = series.flatMap((p) => (p.total === null ? [] : [p.total]))
  if (series.length < 2 || totals.length < 1) return null
  // die Länge voller Serien, wie `seriesConsistency` im Fachkern; ab zwei Serien nie null
  const modal = modalLength(series.map((p) => p.shots)) as number
  const span = Math.max(...totals) - Math.min(...totals) || 1
  // nicht feiner als die Wertung: ein Zehntel, in ganzen Ringen ein Ring
  const step = Math.max(niceStep(span, 3), digits ? 0.1 : 1)
  const lo = Math.floor((Math.min(...totals) - step * 0.3) / step) * step
  const hi = Math.ceil((Math.max(...totals) + step * 0.3) / step) * step
  const x = (i: number) =>
    PAD.left + INSET + (i / (series.length - 1)) * (width - PAD.left - PAD.right - 2 * INSET)
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * (HEIGHT - PAD.top - PAD.bottom)
  const grid: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) grid.push(v)
  const line = series
    .map((p, i) => [p, i] as const)
    .filter(([p]) => p.shots === modal && p.total !== null)
    .map(([p, i]) => `${x(i)},${y(p.total as number)}`)
    .join(" ")

  return (
    <ChartSvg width={width} height={HEIGHT} label="Serienergebnisse">
      {grid.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={crisp(y(v))}
            y2={crisp(y(v))}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central">
            {formatValue(v, step < 1 ? 1 : 0)}
          </text>
        </g>
      ))}
      <polyline
        data-series-line="true"
        points={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {series.map((p, i) => {
        if (p.total === null) {
          return (
            <text key={p.series} x={x(i)} y={HEIGHT - 6} textAnchor="middle">
              {`S${p.series} –`}
            </text>
          )
        }
        const short = p.shots !== modal
        const value = formatValue(p.total, digits)
        return (
          <g key={p.series}>
            <circle
              data-series-point={p.series}
              data-short={short || undefined}
              cx={x(i)}
              cy={y(p.total)}
              r={4.5}
              fill={short ? "var(--card)" : "var(--primary)"}
              stroke={short ? "var(--muted-foreground)" : "var(--shot-edge)"}
              strokeWidth={short ? 1.5 : 2}
            >
              <title>{`Serie ${p.series}: ${value} (${p.shots} Schuss)`}</title>
            </circle>
            <text data-value x={x(i)} y={y(p.total) - 11} textAnchor="middle">
              {value}
            </text>
            <text x={x(i)} y={HEIGHT - 6} textAnchor="middle">
              {`S${p.series}${short ? ` (${p.shots})` : ""}`}
            </text>
          </g>
        )
      })}
    </ChartSvg>
  )
}
