import { groupShape } from "@vereinsheim/shot-core/analysis"
import { selectShots, shotNumbers, type MetricShot } from "@vereinsheim/shot-core/metrics"

import { MpiMark } from "../../target/MpiMark"
import { ChartSvg } from "./frame"
import { FieldAxes, fieldFrame, FieldScale } from "./field"

/**
 * Form der Gruppe um den Schwerpunkt: die 2-σ-Ellipse als Fläche unter den
 * Punkten und als Linie darüber, Ausreißer rot, der Schwerpunkt in der Mitte, Maßstab unten links. Die Form
 * rechnet ohne die Ausreißer, also sitzen Ellipse und Mitte auf dem Schwerpunkt der übrigen (`centerUm`).
 */
export function ShapeChart({ width, shots }: { width: number; shots: readonly MetricShot[] }) {
  const positioned = selectShots(shots, { need: "position" })
  const points = positioned.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
  const shape = groupShape(shots)
  if (!shape) return null
  const center = shape.centerUm
  const relative = points.map((p) => ({ xUm: p.xUm - center.xUm, yUm: p.yUm - center.yUm }))
  const extent = Math.max(2 * shape.majorUm, ...relative.map((p) => Math.hypot(p.xUm, p.yUm)))
  const frame = fieldFrame(width, extent)
  // rot sind genau die Schüsse, die die Form herausgenommen hat: eine Quelle für Rechnung und Bild
  const numbers = shotNumbers(shots)
  const without = new Set(shape.without)
  const flagged = new Set(positioned.filter((shot) => without.has(numbers.get(shot) as number)))
  const ellipse = {
    cx: frame.cx,
    cy: frame.cy,
    rx: 2 * shape.majorUm * frame.k,
    ry: 2 * shape.minorUm * frame.k,
    transform: `rotate(${(-shape.angleRad * 180) / Math.PI} ${frame.cx} ${frame.cy})`,
  }

  return (
    <ChartSvg
      width={width}
      height={frame.size}
      label={`Form der Gruppe${shape.without.length ? " ohne die Ausreißer" : ""} um ihren Schwerpunkt`}
    >
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
            stroke="var(--shot-edge)"
            strokeWidth={1}
          />
        )
      })}
      {/* Ausreißer nicht nur über die Farbe: ein Ring um den Punkt */}
      {relative.map((p, i) =>
        flagged.has(positioned[i]) ? (
          <circle
            key={`ring-${i}`}
            data-outlier-ring={numbers.get(positioned[i])}
            cx={frame.X(p.xUm)}
            cy={frame.Y(p.yUm)}
            r={7.5}
            fill="none"
            stroke="var(--destructive)"
            strokeWidth={1.5}
          />
        ) : null
      )}
      <ellipse {...ellipse} fill="none" stroke="var(--primary)" strokeWidth={1.25} />
      <MpiMark data-overlay="mpi" x={frame.cx} y={frame.cy} radius={5} />
      <FieldScale frame={frame} spanUm={extent * 2} />
    </ChartSvg>
  )
}
