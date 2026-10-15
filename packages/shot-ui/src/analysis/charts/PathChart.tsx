import { mpiPath } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots, type MetricShot } from "@vereinsheim/shot-core/metrics"

import { MpiMark } from "../../target/MpiMark"
import { ChartSvg } from "./frame"
import { FieldAxes, fieldFrame, FieldScale } from "./field"

/**
 * Schwerpunkt je Serie gegen den Schwerpunkt der Scheibe in der Mitte: Linie in
 * Serienfolge, je Serie eine Marke mit ihrer Nummer; ab zwei Serien mit Lage.
 */
export function PathChart({ width, shots }: { width: number; shots: readonly MetricShot[] }) {
  const path = mpiPath(shots)
  const whole = centroid(
    // wie `mpiPath`: nur Schüsse mit Serie
    selectShots(
      shots.filter((s) => s.series !== null),
      { need: "position" }
    ).map((s) => ({
      xUm: s.xUm as number,
      yUm: s.yUm as number,
    }))
  )
  if (path.length < 2 || !whole) return null
  const relative = path.map((p) => ({
    series: p.series,
    dx: p.center.xUm - whole.xUm,
    dy: p.center.yUm - whole.yUm,
  }))
  const extent = Math.max(...relative.map((p) => Math.hypot(p.dx, p.dy))) * 1.25
  const frame = fieldFrame(width, extent)

  return (
    <ChartSvg width={width} height={frame.size} label="Schwerpunkt je Serie">
      <FieldAxes frame={frame} />
      <polyline
        points={relative.map((p) => `${frame.X(p.dx)},${frame.Y(p.dy)}`).join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <MpiMark x={frame.cx} y={frame.cy} radius={5} />
      {relative.map((p) => (
        <g key={p.series} data-path-series={p.series}>
          <circle
            cx={frame.X(p.dx)}
            cy={frame.Y(p.dy)}
            r={9}
            fill="var(--card)"
            stroke="var(--primary)"
            strokeWidth={1.5}
          />
          <text
            data-value
            x={frame.X(p.dx)}
            y={frame.Y(p.dy)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {p.series}
          </text>
        </g>
      ))}
      <FieldScale frame={frame} spanUm={extent * 2} />
    </ChartSvg>
  )
}
