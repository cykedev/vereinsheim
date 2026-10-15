"use client"

import { cn } from "@vereinsheim/lib/utils"

import { ChartSlot, ChartSvg, crisp } from "../analysis/charts/frame"
import { formatValue } from "../format"
import type { EveningBlock } from "./model"

const HEIGHT = 112
/** links Platz für die Achse (zwei Werte), rechts und oben Luft, oben dazu das Datum des Abends */
const PAD = { left: 44, right: 14, top: 26, bottom: 10 }
/** Luft im Rahmen um die Punkte */
const INSET = 8

export interface FormStripProps {
  strip: EveningBlock["strip"]
  /** das Formband an der letzten Scheibe, für den Namen des Bilds */
  band: EveningBlock["band"]
  /** das Datum des Abends („Sa 26.09.“), steht über seinen Scheiben */
  dateLabel: string
  className?: string
}

/**
 * Der Abend im Formband als kleiner Verlauf: die
 * letzten Scheiben der Familie in zeitlicher Folge von links nach rechts, der Ø je Schuss nach oben, wie der Verlauf
 * im Fortschritt. Das Band läuft als Fläche um den gleitenden Schnitt, der als Linie in der Mitte; die Scheiben des
 * Abends rechts groß in der Farbe des Akzents, über ihnen das Datum. Alles in einem Rahmen. Kein Wert steht
 * nur im SVG: Zahl und Bezug stehen darüber, der Name des Bilds sagt Folge, Abend und Band in Worten.
 */
export function FormStrip({ strip, band, dateLabel, className }: FormStripProps) {
  if (!strip.length) return null
  const values = strip.flatMap((s) => [
    s.value,
    s.mean,
    ...(s.band ? [s.band.low, s.band.high] : []),
  ])
  const rawLo = Math.min(...values)
  const rawHi = Math.max(...values)
  // liegen alle Werte gleich, steht eine kleine Spanne um sie
  const span = Math.max(rawHi - rawLo, 0.1)
  const lo = rawHi - rawLo < 0.1 ? (rawLo + rawHi) / 2 - span / 2 : rawLo
  const hi = lo + span
  const minValue = Math.min(...strip.map((s) => s.value))
  const maxValue = Math.max(...strip.map((s) => s.value))
  const minText = formatValue(minValue, 2)
  const maxText = formatValue(maxValue, 2)
  const label = [
    `${strip.length === 1 ? "Die letzte Scheibe" : `Die letzten ${strip.length} Scheiben in zeitlicher Folge`}, die des Abends (${dateLabel}) hervorgehoben`,
    band ? `Formband zuletzt ${formatValue(band.low, 2)} bis ${formatValue(band.high, 2)}` : null,
  ]
    .filter(Boolean)
    .join("; ")

  return (
    <div data-form-strip className={cn("min-w-0", className)}>
      <ChartSlot height={HEIGHT}>
        {(width) => {
          const plotLeft = PAD.left + INSET
          const plotRight = width - PAD.right - INSET
          const x = (i: number) =>
            strip.length === 1
              ? (plotLeft + plotRight) / 2
              : plotLeft + (i / (strip.length - 1)) * (plotRight - plotLeft)
          const top = PAD.top + INSET
          const bottom = HEIGHT - PAD.bottom - INSET
          const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top)
          // das Band gibt es ab der fünften Scheibe der Familie lückenlos bis zur letzten (`periodTrend`), die Punkte
          // mit Band sind also eine zusammenhängende Folge und der Pfad ein Streifen
          const banded = strip.flatMap((s, i) => (s.band ? [{ i, band: s.band }] : []))
          const bandPath =
            banded.length > 1
              ? `M${banded.map(({ i, band: b }) => `${x(i)},${y(b.high)}`).join(" L")} L${[
                  ...banded,
                ]
                  .reverse()
                  .map(({ i, band: b }) => `${x(i)},${y(b.low)}`)
                  .join(" L")} Z`
              : null
          // der Schnitt über weniger als fünf Scheiben gestrichelt, bis zum ersten vollen Punkt (wie `PeriodChart`)
          const coords = strip.map((s, i) => `${x(i)},${y(s.mean)}`)
          const firstFull = strip.findIndex((s) => !s.partial)
          const partialLine = firstFull < 0 ? coords : coords.slice(0, firstFull + 1)
          const fullLine = firstFull < 0 ? [] : coords.slice(firstFull)
          // die untere Zahl nur, wenn sie anders lautet und nicht in die obere läuft
          const showMin = minText !== maxText && y(minValue) - y(maxValue) >= 14
          const tonight = strip.flatMap((s, i) => (s.tonight ? [i] : []))
          const labelX = tonight.length
            ? tonight.reduce((sum, i) => sum + x(i), 0) / tonight.length
            : null
          return (
            <ChartSvg width={width} height={HEIGHT} label={label}>
              {/* der Rahmen um den Verlauf: Band und Punkte stehen nicht „im leeren“ */}
              <rect
                data-track
                x={crisp(PAD.left)}
                y={crisp(PAD.top)}
                width={Math.round(width - PAD.left - PAD.right)}
                height={HEIGHT - PAD.top - PAD.bottom}
                rx={10}
                className="fill-surface-2 stroke-border"
              />
              {bandPath && <path data-band d={bandPath} className="fill-accent-wash" />}
              {partialLine.length > 1 && (
                <polyline
                  data-mean="partial"
                  points={partialLine.join(" ")}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  className="stroke-primary"
                />
              )}
              {fullLine.length > 1 && (
                <polyline
                  data-mean
                  points={fullLine.join(" ")}
                  fill="none"
                  strokeWidth={1.5}
                  className="stroke-primary"
                />
              )}
              {strip.map((s, i) =>
                s.tonight ? null : (
                  <circle
                    key={s.id}
                    data-strip-dot={s.id}
                    cx={x(i)}
                    cy={y(s.value)}
                    r={3.5}
                    fillOpacity={0.6}
                    className="fill-muted-foreground"
                  />
                )
              )}
              {strip.map((s, i) =>
                s.tonight ? (
                  <circle
                    key={s.id}
                    data-strip-dot={s.id}
                    data-tonight="true"
                    cx={x(i)}
                    cy={y(s.value)}
                    r={6}
                    strokeWidth={2.5}
                    className="fill-primary stroke-card"
                  />
                ) : null
              )}
              {labelX !== null && (
                <text
                  data-evening-label="true"
                  data-value="true"
                  x={Math.min(labelX, width - PAD.right)}
                  y={PAD.top - 8}
                  textAnchor={labelX > width - PAD.right - 30 ? "end" : "middle"}
                >
                  {dateLabel}
                </text>
              )}
              <text x={PAD.left - 6} y={y(maxValue)} textAnchor="end" dominantBaseline="central">
                {maxText}
              </text>
              {showMin && (
                <text x={PAD.left - 6} y={y(minValue)} textAnchor="end" dominantBaseline="central">
                  {minText}
                </text>
              )}
            </ChartSvg>
          )
        }}
      </ChartSlot>
    </div>
  )
}
