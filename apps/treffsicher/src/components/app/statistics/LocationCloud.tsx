"use client"

import { ChartSlot, ChartSvg, crisp, niceStep } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { formatValue } from "@vereinsheim/shot-ui/format"
import { MpiMark } from "@vereinsheim/shot-ui/target/MpiMark"

import { countOf } from "@vereinsheim/shot-ui/period/words"

import type { LocationSummary } from "@/lib/statistics/location"
import { tickDecimals } from "@/lib/statistics/locationText"
import { SESSION_WORDS } from "@/lib/statistics/words"

const PAD = 28
const MAX_SIDE = 340

/** Halbe Breite der Achsen in mm: alle Lagen und das Mittel im Bild, mindestens 1 mm, auf eine runde Stufe */
function halfSpan(summary: LocationSummary): { half: number; step: number } {
  const far = Math.max(1, ...summary.points.flatMap((p) => [Math.abs(p.xMm), Math.abs(p.yMm)]))
  const step = niceStep(far, 2)
  return { half: Math.ceil(far / step) * step, step }
}

/**
 * Wolke der Trefferlagen: je Einheit ein Punkt (rechts und hoch positiv), das Mittel als Schwerpunkt-Zeichen, die
 * Mitte als Achsenkreuz. Die im Verlauf gewählte Einheit ist hervorgehoben.
 */
export function LocationCloud({
  summary,
  chosen,
}: {
  summary: LocationSummary
  chosen: string | null
}) {
  const { half, step } = halfSpan(summary)
  const ticks: number[] = []
  for (let v = -half; v <= half + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return (
    <ChartSlot height={MAX_SIDE}>
      {(width) => {
        const side = Math.min(width, MAX_SIDE)
        const plot = side - 2 * PAD
        const at = (mm: number) => PAD + ((mm + half) / (2 * half)) * plot
        const atY = (mm: number) => PAD + ((half - mm) / (2 * half)) * plot
        const ordered = [...summary.points].sort((a, b) =>
          a.id === chosen ? 1 : b.id === chosen ? -1 : 0
        )
        return (
          <div className="flex justify-center">
            <div style={{ width: side }}>
              <ChartSvg
                width={side}
                height={side}
                label={`Trefferlage von ${countOf(summary.points.length, SESSION_WORDS)}, rechts und hoch positiv`}
              >
                {ticks.map((t) => (
                  <g key={t}>
                    <line
                      x1={crisp(at(t))}
                      x2={crisp(at(t))}
                      y1={PAD}
                      y2={PAD + plot}
                      stroke={t === 0 ? "var(--line-strong)" : "var(--border)"}
                    />
                    <line
                      x1={PAD}
                      x2={PAD + plot}
                      y1={crisp(atY(t))}
                      y2={crisp(atY(t))}
                      stroke={t === 0 ? "var(--line-strong)" : "var(--border)"}
                    />
                    <text x={at(t)} y={side - 8} textAnchor="middle">
                      {formatValue(t, tickDecimals(step))}
                    </text>
                    <text x={PAD - 6} y={atY(t) + 4} textAnchor="end">
                      {formatValue(t, tickDecimals(step))}
                    </text>
                  </g>
                ))}
                {ordered.map((p) => (
                  <circle
                    key={p.id}
                    data-location-point={p.id}
                    data-chosen={p.id === chosen || undefined}
                    cx={at(p.xMm)}
                    cy={atY(p.yMm)}
                    r={p.id === chosen ? 6 : 4}
                    fill={p.id === chosen ? "var(--primary)" : "var(--chart-1)"}
                    fillOpacity={p.id === chosen ? 1 : 0.55}
                    stroke="var(--shot-edge)"
                    strokeWidth={1}
                  />
                ))}
                {summary.mean && (
                  <MpiMark x={at(summary.mean.xMm)} y={atY(summary.mean.yMm)} radius={7} />
                )}
              </ChartSvg>
            </div>
          </div>
        )
      }}
    </ChartSlot>
  )
}
