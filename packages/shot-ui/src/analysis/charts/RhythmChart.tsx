"use client"

import { rhythmProfile } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"

import { durationText } from "../../format"
import { RULER_HINT, RulerMark, RulerReadout, useRuler, ValuesTable } from "./ChartRuler"
import { ChartSvg, crisp, niceStep } from "./frame"

const HEIGHT = 190
const PAD = { left: 36, right: 12, top: 18, bottom: 26 }

/**
 * Rhythmus: Abstand zum vorigen Schuss als Säule, eine Pause gekappt, in der
 * Farbe für Hinweise und mit ihrer Dauer beschriftet, dazu der Median der letzten fünf Abstände als
 * Linie; ab zwei Abständen. Werte per Lineal wie im Verlauf: Die Zeile nennt den Abstand vor dem
 * gewählten Schuss und den Median, „Auf der Scheibe“ zeigt den Schuss dort; darunter „Werte als Tabelle“.
 */
export function RhythmChart({
  width,
  shots,
  card = shots,
  chosenNumber = null,
  onShow,
}: {
  width: number
  shots: readonly MetricShot[]
  /** die ganze Karte, aus der `shots` stammen: eine späte Probe ist keine Lücke (SF-04) */
  card?: readonly MetricShot[]
  /** Nummer des auf der Scheibe gewählten Schusses: das Lineal steht auf dem Abstand vor ihm */
  chosenNumber?: number | null
  /** „Auf der Scheibe“: den Schuss mit dieser Nummer dort zeigen */
  onShow?: (number: number) => void
}) {
  const profile = rhythmProfile(shots, 5, card)
  const timed = profile.filter((p) => p.intervalMs !== null)
  // x vor dem Ausstieg ohne Abstände: das Lineal braucht die Positionen in jedem Fall (Regeln der Hooks)
  const n = profile.length ? profile[profile.length - 1].number : 1
  const x = (k: number) =>
    PAD.left + ((k - 1) / Math.max(1, n - 1)) * (width - PAD.left - PAD.right)
  const preset = chosenNumber === null ? -1 : timed.findIndex((p) => p.number === chosenNumber)
  const ruler = useRuler(
    timed.map((p) => x(p.number)),
    width,
    preset < 0 ? null : preset
  )
  if (timed.length < 2) return null
  const chosen = ruler.index === null ? null : timed[ruler.index]
  const normal = timed.filter((p) => !p.pause).map((p) => (p.intervalMs as number) / 1000)
  const highest = Math.max(10, ...normal)
  const step = niceStep(highest, 3)
  const cap = Math.ceil((highest * 1.12) / step) * step
  const y = (sec: number) =>
    PAD.top + (1 - Math.min(sec, cap) / cap) * (HEIGHT - PAD.top - PAD.bottom)
  const bw = Math.max(2, Math.min(10, ((width - PAD.left - PAD.right) / Math.max(1, n - 1)) * 0.55))
  const grid: number[] = []
  for (let v = 0; v <= cap + 1e-9; v += step) grid.push(v)
  const tick = n > 30 ? 10 : 5
  const ticks: number[] = []
  for (let k = 1; k <= n; k++) if (k === 1 || k % tick === 0) ticks.push(k)
  const line = profile.filter((p) => p.medianMs !== null)
  const gapText = (p: (typeof timed)[number]) =>
    `vor Schuss ${p.number}: ${durationText(p.intervalMs as number)}${p.pause ? " (Pause)" : ""}${
      // kurz, damit es auf dem Telefon in zwei Zeilen passt; die Notiz erklärt den Median der letzten fünf
      p.medianMs !== null ? ` · Median ${durationText(p.medianMs)}` : ""
    }`

  return (
    <div className="grid gap-2">
      <RulerReadout
        text={chosen ? gapText(chosen) : null}
        action={
          onShow
            ? { label: "Auf der Scheibe", onClick: () => chosen && onShow(chosen.number) }
            : null
        }
      />
      <ChartSvg
        width={width}
        height={HEIGHT}
        label="Abstände zwischen den Schüssen"
        svgProps={{
          ...ruler.svgProps,
          "aria-valuetext": chosen ? gapText(chosen) : RULER_HINT,
        }}
      >
        {grid.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={crisp(y(v))}
              y2={crisp(y(v))}
              stroke={v === 0 ? "var(--line-strong)" : "var(--border)"}
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central">
              {`${v} s`}
            </text>
          </g>
        ))}
        {timed.map((p) => {
          const ms = p.intervalMs as number
          const top = y(ms / 1000)
          const base = y(0)
          return (
            <g key={p.number}>
              <rect
                data-interval={p.number}
                data-pause={p.pause || undefined}
                data-chosen={p === chosen || undefined}
                x={x(p.number) - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1, base - top)}
                rx={Math.min(2, bw / 2)}
                fill={p.pause ? "var(--warning)" : "var(--primary)"}
                fillOpacity={p === chosen ? 0.9 : p.pause ? 0.85 : 0.45}
              />
              {p.pause && (
                <text data-value x={x(p.number) + bw / 2 + 4} y={PAD.top + 8}>
                  {durationText(ms)}
                </text>
              )}
            </g>
          )
        })}
        {line.length > 1 && (
          <path
            data-median="true"
            d={line
              .map(
                (p, i) =>
                  `${i ? "L" : "M"}${x(p.number).toFixed(1)} ${y((p.medianMs as number) / 1000).toFixed(1)}`
              )
              .join("")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {ticks.map((k) => (
          <text key={k} x={x(k)} y={HEIGHT - 6} textAnchor="middle">
            {k}
          </text>
        ))}
        {chosen && <RulerMark x={x(chosen.number)} top={PAD.top} bottom={HEIGHT - PAD.bottom} />}
      </ChartSvg>
      <ValuesTable
        caption="Abstände zwischen den Schüssen"
        columns={["vor Schuss", "Abstand", "Median der letzten fünf"]}
        rows={timed.map((p) => [
          `${p.number}${p.pause ? " (Pause)" : ""}`,
          durationText(p.intervalMs as number),
          p.medianMs === null ? "–" : durationText(p.medianMs),
        ])}
      />
    </div>
  )
}
