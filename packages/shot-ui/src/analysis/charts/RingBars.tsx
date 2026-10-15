import type { RingDistribution } from "@vereinsheim/shot-core/analysis"

import { percentText } from "../../format"
import { scoreColor } from "../../geometry"

/** Ringe, die eine Zeile bekommen: 10 abwärts bis zum tiefsten Treffer, mindestens bis 8; 0 nur bei Fehlern */
export function ringRows(dist: RingDistribution): number[] {
  let lowest = 10
  dist.counts.forEach((count, ring) => {
    if (count && ring > 0 && ring < lowest) lowest = ring
  })
  const rows: number[] = []
  for (let ring = 10; ring >= Math.min(lowest, 8); ring--) rows.push(ring)
  if (dist.counts[0]) rows.push(0)
  return rows
}

/** Ringverteilung als Balken je Ring: Länge nach Anzahl, Farbe nach Ring */
export function RingBars({ dist }: { dist: RingDistribution }) {
  const top = Math.max(1, ...dist.counts)
  return (
    <div className="grid gap-1.5">
      {ringRows(dist).map((ring) => {
        const count = dist.counts[ring]
        return (
          <div
            key={ring}
            data-ring-row={ring}
            className="grid grid-cols-[2ch_minmax(0,1fr)_max-content] items-center gap-3 text-[13px]"
          >
            <span className="text-right font-mono font-semibold text-muted-foreground">{ring}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(count / top) * 100}%`, background: scoreColor(ring) }}
              />
            </span>
            <span className="min-w-[9ch] text-right font-semibold tabular-nums">
              {count}
              <small className="ml-1 text-xs font-normal text-muted-foreground">
                {`· ${dist.n ? percentText(count / dist.n) : "–"}`}
              </small>
            </span>
          </div>
        )
      })}
    </div>
  )
}
