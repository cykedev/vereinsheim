"use client"

import type { VolumeBucket } from "@vereinsheim/shot-core/analysis"

import {
  RULER_HINT,
  RulerMark,
  RulerReadout,
  useRuler,
  ValuesTable,
} from "../analysis/charts/ChartRuler"
import { ChartSvg, crisp, niceStep } from "../analysis/charts/frame"

const HEIGHT = 120
const PAD = { left: 36, right: 12, top: 10, bottom: 22 }

export type VolumeWeek = VolumeBucket & { label: string }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** „KW 29: 140 Schuss mit Probe, 3 Scheiben, 2 Tage“ */
export const weekText = (w: VolumeWeek) =>
  w.cards
    ? `${w.label}: ${w.shots} Schuss mit Probe, ${plural(w.cards, "Scheibe", "Scheiben")}, ${plural(w.days, "Tag", "Tage")}`
    : `${w.label}: kein Training`

/**
 * Umfang je Woche (Plan L3, D15, T6): je ISO-Woche eine Säule der Schüsse mit Probe, auch Wochen ohne Training
 * (Pausen sichtbar). Das Lineal nennt Schüsse, Scheiben und Tage; darunter „Werte als Tabelle“. Die Schüsse
 * zählen hier mit Probe, die Ergebnis-Box zählt Wertungsschüsse (Prüfung, 9. Oktober 2026).
 */
export function VolumeChart({ width, weeks }: { width: number; weeks: readonly VolumeWeek[] }) {
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const slot = plotW / Math.max(1, weeks.length)
  const x = (i: number) => PAD.left + (i + 0.5) * slot
  const ruler = useRuler(
    weeks.map((_, i) => x(i)),
    width
  )
  if (!weeks.length) return null
  const max = Math.max(1, ...weeks.map((w) => w.shots))
  const step = niceStep(max, 2)
  const top = Math.ceil(max / step) * step
  const base = HEIGHT - PAD.bottom
  const y = (v: number) => PAD.top + (1 - v / top) * (base - PAD.top)
  const bw = Math.max(2, Math.min(14, slot - 2))
  const every = Math.max(1, Math.ceil(36 / slot))
  const chosen = ruler.index === null ? null : weeks[ruler.index]
  const text = chosen ? weekText(chosen) : null
  const grid: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) grid.push(v)

  return (
    <div className="grid gap-2">
      <RulerReadout text={text} />
      <ChartSvg
        width={width}
        height={HEIGHT}
        label="Schüsse je Woche"
        svgProps={{ ...ruler.svgProps, "aria-valuetext": text ?? RULER_HINT }}
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
              {v}
            </text>
          </g>
        ))}
        {weeks.map((w, i) =>
          w.shots ? (
            <rect
              key={w.key}
              data-week={w.key}
              data-chosen={w === chosen || undefined}
              x={x(i) - bw / 2}
              y={y(w.shots)}
              width={bw}
              height={Math.max(1, base - y(w.shots))}
              rx={Math.min(2, bw / 2)}
              fill="var(--primary)"
              fillOpacity={w === chosen ? 0.9 : 0.45}
            />
          ) : null
        )}
        {weeks.map((w, i) =>
          i % every ? null : (
            <text key={w.key} x={x(i)} y={HEIGHT - 6} textAnchor="middle">
              {w.label.replace("KW ", "")}
            </text>
          )
        )}
        {chosen && <RulerMark x={x(ruler.index as number)} top={PAD.top} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption="Schüsse je Woche"
        columns={["Woche", "Schuss mit Probe", "Scheiben", "Tage"]}
        rows={weeks.map((w) => [w.label, String(w.shots), String(w.cards), String(w.days)])}
      />
    </div>
  )
}
