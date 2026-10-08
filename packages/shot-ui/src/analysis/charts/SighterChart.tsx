import { sightersBeforeMatch } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots, shotNumbers, type MetricShot } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import { MpiMark } from "../../target/MpiMark"
import { ChartSvg } from "./frame"
import { fieldFrame, FieldScale } from "./field"
import { placeLabels } from "./labels"

const point = (s: MetricShot) => ({ xUm: s.xUm as number, yUm: s.yUm as number })

/** Schrift der Nummern: 12 px Mono (`ChartSvg`), Zeilenhöhe und Breite je Zeichen für das Ausweichen */
const LABEL_HEIGHT = 14
const CHAR_WIDTH = 7.5

/**
 * Probe auf der Scheibe (Spielwiese `sighterChart`, D7): die Probe vor der Wertung in Abgabefolge, nur mit
 * gültiger Lage, hohl in Kalibergröße um die Mitte, dazu Ringe als Haarlinien und der Schwerpunkt der
 * Wertung; Maßstab unten links. Die Nummer steht wie auf der Scheibe in der Mitte des Schusses, mit hellem
 * Saum über allen Kreisen; liegen zwei fast gleich, weicht die spätere aus (`placeLabels`). Der Ausschnitt
 * reicht bis zum Rand des weitesten Schusses (User, 8. Oktober 2026: Nummern standen außen am Kaliber,
 * überlagerten sich und ragten aus dem Bild).
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
      ...sighters.map((s) => Math.hypot(s.xUm as number, s.yUm as number) + target.caliberUm / 2),
      matchCenter ? Math.hypot(matchCenter.xUm, matchCenter.yUm) : 0
    ) * 1.05
  const frame = fieldFrame(width, extent)
  const calR = Math.max(3.5, (target.caliberUm / 2) * frame.k)
  const labels = sighters.map((shot) => `P${numbers.get(shot)}`)
  const at = placeLabels(
    sighters.map((shot, i) => ({
      x: frame.X(shot.xUm as number),
      y: frame.Y(shot.yUm as number),
      width: labels[i].length * CHAR_WIDTH + 4,
    })),
    LABEL_HEIGHT
  )

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
      {sighters.map((shot, i) => {
        const { xUm, yUm } = point(shot)
        return (
          <g key={labels[i]} data-sighter={labels[i]}>
            <circle
              cx={frame.X(xUm)}
              cy={frame.Y(yUm)}
              r={calR}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1.5}
            >
              <title>{labels[i]}</title>
            </circle>
          </g>
        )
      })}
      {/* die Nummern über allen Kreisen, mit Saum in der Farbe der Karte */}
      {labels.map((label, i) => (
        <text
          key={label}
          data-value
          data-sighter-label={label}
          x={at[i].x}
          y={at[i].y}
          textAnchor="middle"
          dominantBaseline="central"
          stroke="var(--card)"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {label}
        </text>
      ))}
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
