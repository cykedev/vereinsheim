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
/** Luft zwischen Band und Rahmen (U2, D6) */
const TRACK_PAD = 4
/** Breite eines Zeichens der Achsenschrift (Geist Mono, text-xs) und Luft zwischen zwei Beschriftungen */
const CHAR_PX = 7.2
const GAP_PX = 8
/** so schmal darf die Achse höchstens werden; enger liegende Werte stehen mittig */
const MIN_SPAN = 0.1
const textWidth = (text: string) => text.length * CHAR_PX

export interface FormStripProps {
  strip: EveningBlock["strip"]
  average: EveningBlock["average"]
  band: EveningBlock["band"]
  className?: string
}

/**
 * Der Abend im Formband (Plan N5, D2): die letzten Scheiben der Familie als Punkte auf einer Achse des Ø je Schuss,
 * die des Abends groß in der Farbe des Akzents, alles in einem Rahmen über die ganze Achse (U2, D6). Dahinter das Formband wie im Verlauf des Fortschritts (an der letzten
 * Scheibe des Abends) und der Schnitt der fünf Scheiben vor dem Abend als gestrichelte Linie. Kein Wert steht nur im SVG: die große Zahl und der Abstand stehen
 * darüber, der Name des Bilds sagt Band und Schnitt in Worten.
 */
export function FormStrip({ strip, average, band, className }: FormStripProps) {
  if (!strip.length) return null
  const values = strip.map((s) => s.value)
  const rawLo = Math.min(...values, band?.low ?? Infinity, average?.value ?? Infinity)
  const rawHi = Math.max(...values, band?.high ?? -Infinity, average?.value ?? -Infinity)
  // liegen alle Werte enger als die kleinste Achse, steht die Achse um ihre Mitte
  const middle = (rawLo + rawHi) / 2
  const span = Math.max(rawHi - rawLo, MIN_SPAN)
  const lo = rawHi - rawLo < MIN_SPAN ? middle - span / 2 : rawLo
  const tonight = strip.filter((s) => s.tonight)
  const label = [
    `${strip.length === 1 ? "Die letzte Scheibe" : `Die letzten ${strip.length} Scheiben`}, die des Abends hervorgehoben`,
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
          // Beschriftungen unten: kleinster Wert links bündig, größter rechts bündig, der Schnitt mittig über seiner
          // Linie, aber im Bild; eine Randbeschriftung, die eine andere berührt, entfällt (Review N5)
          const minValue = Math.min(...values)
          const maxValue = Math.max(...values)
          const minText = formatValue(minValue, 2)
          const maxText = formatValue(maxValue, 2)
          const averageText = average ? `Schnitt ${formatValue(average.value, 2)}` : null
          const averageHalf = averageText ? textWidth(averageText) / 2 : 0
          const averageX = average
            ? Math.min(Math.max(x(average.value), averageHalf), width - averageHalf)
            : null
          const minSpan: [number, number] = [x(minValue), x(minValue) + textWidth(minText)]
          const maxSpan: [number, number] = [x(maxValue) - textWidth(maxText), x(maxValue)]
          const averageSpan: [number, number] | null =
            averageX === null ? null : [averageX - averageHalf, averageX + averageHalf]
          const apart = (a: [number, number], b: [number, number]) =>
            a[1] + GAP_PX <= b[0] || b[1] + GAP_PX <= a[0]
          const showMin = !averageSpan || apart(minSpan, averageSpan)
          const showMax =
            maxText !== minText &&
            (!averageSpan || apart(maxSpan, averageSpan)) &&
            (!showMin || apart(minSpan, maxSpan))
          return (
            <ChartSvg width={width} height={HEIGHT} label={label}>
              {/* der Rahmen über die ganze Achse: Band und Punkte stehen nicht mehr „im leeren“ (User, U2 D6) */}
              <rect
                data-track
                x={crisp(PAD / 2)}
                y={crisp(MID - BAND_HALF - TRACK_PAD)}
                width={Math.round(width - PAD)}
                height={BAND_HALF * 2 + TRACK_PAD * 2}
                rx={12}
                className="fill-surface-2 stroke-border"
              />
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
                  y1={MID - BAND_HALF - TRACK_PAD}
                  y2={MID + BAND_HALF + TRACK_PAD}
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
                  Abend
                </text>
              )}
              {showMin && (
                <text x={minSpan[0]} y={HEIGHT - 6} textAnchor="start">
                  {minText}
                </text>
              )}
              {showMax && (
                <text x={maxSpan[1]} y={HEIGHT - 6} textAnchor="end">
                  {maxText}
                </text>
              )}
              {averageText && averageX !== null && (
                <text x={averageX} y={HEIGHT - 6} textAnchor="middle">
                  {averageText}
                </text>
              )}
            </ChartSvg>
          )
        }}
      </ChartSlot>
    </div>
  )
}
