import { groupShape, outliers } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots, shotNumbers, type MetricShot } from "@vereinsheim/shot-core/metrics"

import { MpiMark } from "../../target/MpiMark"
import { ChartSvg } from "./frame"
import { FieldAxes, fieldFrame, FieldScale } from "./field"

/**
 * Form der Gruppe um den Schwerpunkt (Spielwiese `shapeChart`): die 2-σ-Ellipse als Fläche unter den
 * Punkten und als Linie darüber, Ausreißer rot, der Schwerpunkt in der Mitte, Maßstab unten links.
 */
export function ShapeChart({ width, shots }: { width: number; shots: readonly MetricShot[] }) {
  const positioned = selectShots(shots, { need: "position" })
  const points = positioned.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
  const center = centroid(points)
  const shape = groupShape(shots)
  if (!center || !shape) return null
  const relative = points.map((p) => ({ xUm: p.xUm - center.xUm, yUm: p.yUm - center.yUm }))
  const extent = Math.max(2 * shape.majorUm, ...relative.map((p) => Math.hypot(p.xUm, p.yUm)))
  const frame = fieldFrame(width, extent)
  const flagged = new Set(outliers(shots)?.flagged.map((f) => f.shot))
  const numbers = shotNumbers(shots)
  const ellipse = {
    cx: frame.cx,
    cy: frame.cy,
    rx: 2 * shape.majorUm * frame.k,
    ry: 2 * shape.minorUm * frame.k,
    transform: `rotate(${(-shape.angleRad * 180) / Math.PI} ${frame.cx} ${frame.cy})`,
  }

  return (
    <ChartSvg width={width} height={frame.size} label="Form der Gruppe um den Schwerpunkt">
      <FieldAxes frame={frame} />
      <ellipse {...ellipse} fill="var(--accent-wash)" />
      {relative.map((p, i) => {
        const shot = positioned[i]
        const out = flagged.has(shot)
        return (
          <circle
            key={i}
            data-group-point={numbers.get(shot)}
            data-outlier={out || undefined}
            cx={frame.X(p.xUm)}
            cy={frame.Y(p.yUm)}
            r={out ? 4 : 3}
            fill={out ? "var(--destructive)" : "var(--foreground-2)"}
            stroke="var(--card)"
            strokeWidth={1}
          />
        )
      })}
      <ellipse {...ellipse} fill="none" stroke="var(--primary)" strokeWidth={1.25} />
      <MpiMark data-overlay="mpi" x={frame.cx} y={frame.cy} radius={5} />
      <FieldScale frame={frame} spanUm={extent * 2} />
    </ChartSvg>
  )
}
