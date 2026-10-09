"use client"

import { cn } from "@vereinsheim/lib/utils"

import { ChartSlot, ChartSvg, crisp } from "../analysis/charts/frame"
import { formatValue } from "../format"
import type { EveningBlock } from "./model"

const HEIGHT = 96
const PAD = 16
/** Mitte der Punkte und Höhe des Bands */
const MID = 46
const BAND_HALF = 18
/** so weit müssen die Beschriftungen unten auseinander liegen, sonst entfällt die am Rand */
const LABEL_ROOM = 64

export interface FormStripProps {
  strip: EveningBlock["strip"]
  average: EveningBlock["average"]
  band: EveningBlock["band"]
  className?: string
}

/**
 * Der Abend im Formband (Plan N5, D2): die letzten Scheiben der Familie als Punkte auf einer Achse des Ø je Schuss,
 * die des Abends groß in der Farbe des Akzents. Dahinter das Formband des Fortschritts und der Schnitt der fünf
 * Scheiben vor dem Abend als gestrichelte Linie. Kein Wert steht nur im SVG: die große Zahl und der Abstand stehen
 * darüber, der Name des Bilds sagt Band und Schnitt in Worten.
 */
export function FormStrip({ strip, average, band, className }: FormStripProps) {
  if (!strip.length) return null
  const values = strip.map((s) => s.value)
  const lo = Math.min(...values, band?.low ?? Infinity, average?.value ?? Infinity)
  const hi = Math.max(...values, band?.high ?? -Infinity, average?.value ?? -Infinity)
  const span = Math.max(hi - lo, 0.1)
  const tonight = strip.filter((s) => s.tonight)
  const label = [
    `Die letzten ${strip.length} Scheiben, die des Abends hervorgehoben`,
    band ? `Formband ${formatValue(band.low, 2)} bis ${formatValue(band.high, 2)}` : null,
    average ? `Schnitt ${formatValue(average.value, 2)}` : null,
  ]
    .filter(Boolean)
    .join("; ")

  return (
    <div data-form-strip className={cn("min-w-0", className)}>
      <ChartSlot height={HEIGHT}>
        {(width) => {
          const x = (v: number) =>
            PAD + ((v - (lo - span * 0.04)) / (span * 1.08)) * (width - 2 * PAD)
          const tonightX = tonight.length
            ? tonight.reduce((sum, s) => sum + x(s.value), 0) / tonight.length
            : null
          const averageX = average ? x(average.value) : null
          const minValue = Math.min(...values)
          const maxValue = Math.max(...values)
          const roomFor = (at: number) => averageX === null || Math.abs(at - averageX) >= LABEL_ROOM
          return (
            <ChartSvg width={width} height={HEIGHT} label={label}>
              {band && (
                <rect
                  data-band
                  x={x(band.low)}
                  y={MID - BAND_HALF}
                  width={Math.max(1, x(band.high) - x(band.low))}
                  height={BAND_HALF * 2}
                  rx={8}
                  className="fill-accent-wash"
                />
              )}
              {averageX !== null && (
                <line
                  data-average
                  x1={crisp(averageX)}
                  x2={crisp(averageX)}
                  y1={MID - BAND_HALF - 4}
                  y2={MID + BAND_HALF + 4}
                  strokeDasharray="3 3"
                  className="stroke-line-strong"
                />
              )}
              {strip.map((s, i) =>
                s.tonight ? null : (
                  <circle
                    key={s.id}
                    data-strip-dot={s.id}
                    cx={x(s.value)}
                    cy={MID + ((i % 3) - 1) * 7}
                    r={4}
                    fillOpacity={0.55}
                    className="fill-muted-foreground"
                  />
                )
              )}
              {tonight.map((s) => (
                <circle
                  key={s.id}
                  data-strip-dot={s.id}
                  data-tonight="true"
                  cx={x(s.value)}
                  cy={MID}
                  r={8}
                  strokeWidth={3}
                  className="fill-primary stroke-card"
                />
              ))}
              {tonightX !== null && (
                <text data-value="true" x={tonightX} y={MID - BAND_HALF - 10} textAnchor="middle">
                  heute
                </text>
              )}
              {roomFor(x(minValue)) && (
                <text x={x(minValue)} y={HEIGHT - 6} textAnchor="start">
                  {formatValue(minValue, 2)}
                </text>
              )}
              {roomFor(x(maxValue)) && (
                <text x={x(maxValue)} y={HEIGHT - 6} textAnchor="end">
                  {formatValue(maxValue, 2)}
                </text>
              )}
              {average && averageX !== null && (
                <text x={averageX} y={HEIGHT - 6} textAnchor="middle">
                  {`Schnitt ${formatValue(average.value, 2)}`}
                </text>
              )}
            </ChartSvg>
          )
        }}
      </ChartSlot>
    </div>
  )
}
