import { useMemo } from "react"
import type { ShotDistributionTimelinePoint } from "@/components/app/statistics-charts/types"
import { buildShotDistributionTimeline } from "@/components/app/statistics-charts/utils"
import type { ShotDistributionPoint } from "@/lib/stats/actions"

interface Params {
  filteredShotDistribution: ShotDistributionPoint[]
  displayTimeZone: string
}

export function useAggregatedShotDistribution({
  filteredShotDistribution,
  displayTimeZone,
}: Params): ShotDistributionTimelinePoint[] {
  return useMemo(
    () => buildShotDistributionTimeline(filteredShotDistribution, displayTimeZone),
    [filteredShotDistribution, displayTimeZone]
  )
}
