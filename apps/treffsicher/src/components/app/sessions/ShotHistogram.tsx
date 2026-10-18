"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { scoreVar } from "@/lib/scoreColors"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface ShotHistogramProps {
  shots: string[] // Schüsse aus Wertungsserien — Probeschüsse werden nicht dargestellt
  isDecimal: boolean // TENTH-Wertung: Schusswerte flooren (9.5 → Bucket „9")
}

interface BucketData {
  ring: number
  count: number
  label: string
}

// ChartConfig für die shadcn/ui ChartContainer-Komponente
const chartConfig = {
  count: { label: "Schüsse" },
} satisfies ChartConfig

/**
 * Schüsse einer Einheit in Ring-Buckets zählen.
 * Bei Zehntelwertung wird auf den nächsttieferen ganzen Ring gefloort.
 */
function bucketize(shots: string[], isDecimal: boolean): number[] {
  const counts = new Array(11).fill(0)
  for (const shot of shots) {
    const value = parseFloat(shot)
    if (isNaN(value)) continue
    const bucket = isDecimal ? Math.floor(value) : Math.round(value)
    counts[Math.max(0, Math.min(10, bucket))]++
  }
  return counts
}

/**
 * Schuss-Histogramm für eine Einheit.
 * Zeigt nur Wertungsschüsse — Probeschüsse sind nicht Teil der Auswertung.
 * Ringwert 10 links, 0 rechts — alle 11 Buckets immer sichtbar.
 */
export function ShotHistogram({ shots, isDecimal }: ShotHistogramProps) {
  const counts = bucketize(shots, isDecimal)

  // Daten absteigend (10 links, 0 rechts) — beste Werte links
  const data: BucketData[] = Array.from({ length: 11 }, (_, i) => {
    const ring = 10 - i
    return {
      ring,
      count: counts[ring],
      label: String(ring),
    }
  })

  const total = shots.length

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{total} Schüsse</p>
      <ChartContainer config={chartConfig} className="h-44 w-full">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  if (value === 0) return null
                  return (
                    <span>
                      Ring {item.payload.ring}: <strong>{value}</strong> Schuss
                    </span>
                  )
                }}
                hideLabel
              />
            }
          />
          {/* Ringwert-Farben wie Spiegel (10 rot, 9 gold, 8 türkis, ≤ 7 violett) mit dunklem Rand */}
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={`cell-${entry.ring}`}
                fill={scoreVar(entry.ring)}
                stroke="var(--shot-edge)"
                strokeWidth={1}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
