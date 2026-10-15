"use client"

import { formatValue } from "../../format"
import { scoreColor } from "../../geometry"
import { RULER_HINT, RulerMark, RulerReadout, useRuler, ValuesTable } from "./ChartRuler"
import { ChartSvg, crisp } from "./frame"

const HEIGHT = 150
const PAD = { left: 4, right: 4, top: 16, bottom: 22 }

/**
 * Zehntelverteilung: eine Säule je belegtem Zehntel ab dem Ring des tiefsten
 * Treffers bis 10,9, Farbe nach Ring, Beschriftung je Ring und „10,9“. Werte per Lineal über die belegten
 * Zehntel, darunter „Werte als Tabelle“.
 */
export function DecimalHistogram({
  width,
  hist,
}: {
  width: number
  hist: { n: number; counts: readonly number[] }
}) {
  const present = hist.counts.flatMap((count, tenth) => (count ? [tenth] : []))
  const lo = Math.max(0, Math.floor(Math.min(...present) / 10) * 10)
  const columns = 110 - lo
  const cw = (width - PAD.left - PAD.right) / columns
  const max = Math.max(...hist.counts)
  const base = HEIGHT - PAD.bottom
  const y = (count: number) => PAD.top + (base - PAD.top) * (1 - count / max)
  const gap = cw > 6 ? 2 : cw > 3 ? 1 : 0
  const ticks: number[] = []
  for (let t = lo; t <= 100; t += 10) ticks.push(t)
  const center = (t: number) => PAD.left + (t - lo + 0.5) * cw
  const ruler = useRuler(present.map(center), width)
  const chosen = ruler.index === null ? null : (present[ruler.index] ?? null)
  const text =
    chosen === null ? null : `${formatValue(chosen / 10, 1)}: ${hist.counts[chosen]} Schuss`

  return (
    <div className="grid gap-2">
      <RulerReadout text={text} />
      <ChartSvg
        width={width}
        height={HEIGHT}
        label={`Zehntelverteilung, ${hist.n} Schuss`}
        svgProps={{ ...ruler.svgProps, "aria-valuetext": text ?? RULER_HINT }}
      >
        {present.map((tenth) => {
          const count = hist.counts[tenth]
          const top = y(count)
          return (
            <rect
              key={tenth}
              data-tenth={tenth}
              data-chosen={tenth === chosen || undefined}
              stroke={tenth === chosen ? "var(--foreground-2)" : undefined}
              strokeWidth={tenth === chosen ? 1.5 : undefined}
              x={PAD.left + (tenth - lo) * cw + gap / 2}
              y={top}
              width={Math.max(1, cw - gap)}
              height={base - top}
              rx={Math.min(2, (cw - gap) / 2)}
              fill={scoreColor(Math.floor(tenth / 10))}
            />
          )
        })}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={crisp(base)}
          y2={crisp(base)}
          stroke="var(--line-strong)"
          strokeWidth={1}
        />
        {ticks.map((t) => (
          <text key={t} x={center(t)} y={HEIGHT - 6} textAnchor="middle">
            {t / 10}
          </text>
        ))}
        <text x={center(109)} y={HEIGHT - 6} textAnchor="middle">
          10,9
        </text>
        <text data-value x={PAD.left} y={10}>
          {`höchste Säule ${max}`}
        </text>
        {chosen !== null && <RulerMark x={center(chosen)} top={PAD.top - 4} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption={`Zehntelverteilung, ${hist.n} Schuss`}
        columns={["Zehntel", "Schuss"]}
        rows={present.map((tenth) => [formatValue(tenth / 10, 1), String(hist.counts[tenth])])}
      />
    </div>
  )
}
