import { ChartSvg } from "./frame"

const LABELS: readonly [number, string][] = [
  [0, "12"],
  [3, "3"],
  [6, "6"],
  [9, "9"],
]

/**
 * Richtungsuhr (Spielwiese `clockChart`): ein 30°-Keil je besetzter Stunde, die Fläche wächst mit der
 * Zahl (Radius √(n/max)), Ringe für 25, 50 und 100 %, beschriftet bei 12, 3, 6 und 9.
 */
export function ClockChart({ width, counts }: { width: number; counts: readonly number[] }) {
  const size = Math.min(width, 250)
  const cx = width / 2
  const cy = size / 2
  const R = size / 2 - 22
  const max = Math.max(1, ...counts)
  const at = (angle: number, radius: number) =>
    `${(cx + radius * Math.sin(angle)).toFixed(2)} ${(cy - radius * Math.cos(angle)).toFixed(2)}`

  return (
    <ChartSvg width={width} height={size} label="Richtungsuhr">
      {[0.25, 0.5, 1].map((share) => (
        <circle
          key={share}
          cx={cx}
          cy={cy}
          r={R * Math.sqrt(share)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {counts.map((count, hour) => {
        if (!count) return null
        const r = R * Math.sqrt(count / max)
        const a0 = ((hour * 30 - 15) * Math.PI) / 180
        const a1 = ((hour * 30 + 15) * Math.PI) / 180
        return (
          <path
            key={hour}
            data-hour={hour}
            data-radius={r}
            d={`M${cx} ${cy}L${at(a0, r)}A${r} ${r} 0 0 1 ${at(a1, r)}Z`}
            fill="var(--primary)"
            fillOpacity={0.55}
            stroke="var(--card)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          >
            <title>{`${hour === 0 ? 12 : hour} Uhr: ${count}`}</title>
          </path>
        )
      })}
      {LABELS.map(([hour, label]) => {
        const a = (hour * 30 * Math.PI) / 180
        return (
          <text
            key={hour}
            x={cx + (R + 12) * Math.sin(a)}
            y={cy - (R + 12) * Math.cos(a)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {label}
          </text>
        )
      })}
    </ChartSvg>
  )
}
