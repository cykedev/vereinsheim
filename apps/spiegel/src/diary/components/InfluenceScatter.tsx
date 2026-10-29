import { formatSigned } from "@vereinsheim/shot-ui/format"

import type { InfluenceRow } from "../analysis/influences"
import { ANALYSIS_TEXTS, pointLabel } from "../analysis/texts"
import { stageOf } from "../scales"
import { dayLabel } from "../summaries"

/** Höhe der Wolke und Rand oben und unten, in Pixeln */
const HEIGHT = 220
const PAD = 16
/** die kleinste Spanne je Seite, in Ringen je Schuss */
const MIN_SPAN = 0.4

/** die Spanne je Seite: mindestens 0,4, sonst aufgerundet auf 0,1 über dem größten Abstand */
export function scatterSpan(distances: readonly number[]): number {
  const largest = Math.max(0, ...distances.map((d) => Math.abs(d)))
  return Math.max(MIN_SPAN, Math.ceil(largest * 10 - 1e-9) / 10)
}

/** x der Stufe in Prozent: 1 links, 5 rechts, mit Rand für die Beschriftung */
const xOf = (stage: number) => `${14 + (stage - 1) * 19}%`

/**
 * Die Punktwolke eines Merkmals: x die Stufe 1 bis 5 des Werts (Punkte einer Stufe leicht versetzt), y der Abstand zur
 * Form, die Form gestrichelt bei 0. Die hohe Gruppe gefüllt, die niedrige hohl, ohne Gruppe leise. Jeder Punkt ist ein
 * Link in seinen Eintrag, mit einem größeren unsichtbaren Ziel.
 */
export function InfluenceScatter({ row, timeZone }: { row: InfluenceRow; timeZone: string }) {
  const span = scatterSpan(row.points.map((p) => p.distance))
  const yOf = (distance: number) => PAD + ((span - distance) / (2 * span)) * (HEIGHT - 2 * PAD)
  const seen = new Map<number, number>()
  return (
    <svg
      data-influence-scatter
      width="100%"
      height={HEIGHT + 20}
      role="group"
      aria-label={ANALYSIS_TEXTS.scatterHint}
      className="block overflow-visible select-none"
    >
      <line
        x1="8%"
        x2="100%"
        y1={yOf(0)}
        y2={yOf(0)}
        className="stroke-quiet"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <g aria-hidden className="fill-muted-foreground text-[12px] tabular-nums">
        <text x="0" y={yOf(span) + 4}>
          {formatSigned(span, 1)}
        </text>
        <text x="0" y={yOf(0) + 4}>
          {ANALYSIS_TEXTS.stripForm}
        </text>
        <text x="0" y={yOf(-span) + 4}>
          {formatSigned(-span, 1)}
        </text>
        {[1, 2, 3, 4, 5].map((stage) => (
          <text key={stage} x={xOf(stage)} y={HEIGHT + 16} textAnchor="middle">
            {stage}
          </text>
        ))}
      </g>
      {row.points.map((point) => {
        const stage = stageOf(point.value)
        const k = seen.get(stage) ?? 0
        seen.set(stage, k + 1)
        const shift = ((k % 5) - 2) * 6
        const y = yOf(point.distance)
        return (
          <a
            key={point.entryId}
            href={`/diary/${point.entryId}`}
            data-point={point.side}
            aria-label={pointLabel(
              dayLabel(point.day, timeZone),
              row.aspect,
              stage,
              point.distance
            )}
            className="focus-visible:outline-2 focus-visible:outline-ring"
          >
            <g transform={`translate(${shift} 0)`}>
              <circle cx={xOf(stage)} cy={y} r="12" fill="transparent" />
              {point.side === "high" ? (
                <circle cx={xOf(stage)} cy={y} r="5.5" className="fill-primary" />
              ) : point.side === "low" ? (
                <circle
                  cx={xOf(stage)}
                  cy={y}
                  r="5"
                  className="fill-card stroke-primary"
                  strokeWidth="2"
                />
              ) : (
                <circle cx={xOf(stage)} cy={y} r="5" className="fill-quiet" />
              )}
            </g>
          </a>
        )
      })}
    </svg>
  )
}
