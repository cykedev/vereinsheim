import { sightersBeforeMatch } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots, shotNumbers, type MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import { MpiMark } from "../../target/MpiMark"
import { ChartSvg } from "./frame"
import { fieldFrame, FieldScale } from "./field"

const point = (s: MetricShot) => ({ xUm: s.xUm as number, yUm: s.yUm as number })

/**
 * Probe auf der Scheibe (Spielwiese `sighterChart`, D7): die Probe vor der Wertung in Abgabefolge, nur mit
 * gültiger Lage, hohl um die Mitte mit ihrer Nummer, dazu Ringe als Haarlinien und der Schwerpunkt der
 * Wertung; Maßstab unten links.
 */
export function SighterChart({
  width,
  shots,
  target,
}: {
  width: number
  shots: readonly MetricShot[]
  target: TargetImage
}) {
  const sighters = selectShots(sightersBeforeMatch(shots), { need: "position" })
  if (!sighters.length) return null
  const numbers = shotNumbers(shots)
  const matchCenter = centroid(
    selectShots(
      shots.filter((s) => s.kind === "match"),
      { need: "position" }
    ).map(point)
  )
  const extent =
    Math.max(
      ...sighters.map((s) => Math.hypot(s.xUm as number, s.yUm as number)),
      matchCenter ? Math.hypot(matchCenter.xUm, matchCenter.yUm) : 0
    ) * 1.15
  const frame = fieldFrame(width, extent)
  const calR = Math.max(3.5, (target.caliberUm / 2) * frame.k)

  return (
    <ChartSvg width={width} height={frame.size} label="Probeschüsse um die Mitte">
      {target.ringRadiiUm.map((rUm) => {
        const r = rUm * frame.k
        return r <= frame.size / 2 - 2 ? (
          <circle
            key={rUm}
            cx={frame.cx}
            cy={frame.cy}
            r={r}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={1}
          />
        ) : null
      })}
      <path
        d={`M${frame.cx - 6} ${frame.cy}h12M${frame.cx} ${frame.cy - 6}v12`}
        stroke="var(--foreground-2)"
        strokeWidth={1}
      />
      {sighters.map((shot) => {
        const label = `P${numbers.get(shot)}`
        const { xUm, yUm } = point(shot)
        return (
          <g key={label} data-sighter={label}>
            <circle
              cx={frame.X(xUm)}
              cy={frame.Y(yUm)}
              r={calR}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1.5}
            >
              <title>{label}</title>
            </circle>
            <text data-value x={frame.X(xUm) + calR + 3} y={frame.Y(yUm) - calR}>
              {label}
            </text>
          </g>
        )
      })}
      {matchCenter && (
        <MpiMark
          data-overlay="mpi"
          x={frame.X(matchCenter.xUm)}
          y={frame.Y(matchCenter.yUm)}
          radius={5}
        />
      )}
      <FieldScale frame={frame} spanUm={extent * 2} />
    </ChartSvg>
  )
}
