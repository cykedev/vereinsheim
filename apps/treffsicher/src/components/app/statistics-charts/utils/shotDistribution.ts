import type { ShotDistributionPoint } from "@/lib/stats/actions"
import type { ShotDistributionTimelinePoint } from "@/components/app/statistics-charts/types"
import { formatDateTime, formatShortDate } from "@vereinsheim/lib/format"

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Ein Punkt je Einheit, chronologisch — bewusst ohne zeitliche Bündelung, damit Veränderungen
 * von Einheit zu Einheit sichtbar bleiben. Gebündelt wird nur der Ringbereich 0–6.
 */
export function buildShotDistributionTimeline(
  points: ShotDistributionPoint[],
  displayTimeZone: string
): ShotDistributionTimelinePoint[] {
  return points
    .filter((point) => point.totalShots > 0)
    .map((point) => ({ point, date: new Date(point.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ point, date }, index) => {
      const r7 = round1(point.r7)
      const r8 = round1(point.r8)
      const r9 = round1(point.r9)
      const r10 = round1(point.r10)
      return {
        i: index,
        sessionId: point.sessionId,
        date,
        dateLabel: formatShortDate(date, displayTimeZone),
        tooltipLabel: `${formatDateTime(date, displayTimeZone)} · ${point.totalShots} Schuss`,
        totalShots: point.totalShots,
        // Rest auf 100 %, damit der Stapel trotz Rundung genau voll ist.
        r0to6: round1(Math.max(0, 100 - r7 - r8 - r9 - r10)),
        r7,
        r8,
        r9,
        r10,
      }
    })
}
