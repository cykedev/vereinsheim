import { CHART_TIME_AXIS_MAX_TICKS } from "@/components/app/statistics-charts/constants"
import {
  useShotDistributionTimeline,
  useHitLocationChartState,
  useResultTrendChartState,
  useStatisticsChartPresentationState,
  useStatisticsFilteredData,
  useStatisticsFilterState,
  useWellbeingQualityChartState,
} from "@/components/app/statistics-charts/hooks"
import type { StatisticsChartsDataBundle } from "@/components/app/statistics-charts/types"
import type { DisciplineForStats } from "@/lib/stats/actions"

interface Params {
  data: StatisticsChartsDataBundle
  availableDisciplines: DisciplineForStats[]
  displayTimeZone: string
  showCloudTrail: boolean
  showHitLocationTrendX: boolean
  showHitLocationTrendY: boolean
}

// Buendelt die abgeleitete Chart-Datenaufbereitung (Filter, Aggregation,
// Trend-/Praesentationszustand) als reine Datenebene fuer die Modellzusammenstellung.
export function useStatisticsChartData({
  data,
  availableDisciplines,
  displayTimeZone,
  showCloudTrail,
  showHitLocationTrendX,
  showHitLocationTrendY,
}: Params) {
  const { sessions, wellbeingData, qualityData, shotDistributionData, radarData } = data

  const filterState = useStatisticsFilterState({ availableDisciplines })
  const {
    typeFilter,
    disciplineFilter,
    fromDate,
    toDate,
    effectiveDisplayMode,
    selectedDiscipline,
  } = filterState

  const filteredData = useStatisticsFilteredData({
    sessions,
    wellbeingData,
    qualityData,
    shotDistributionData,
    radarData,
    typeFilter,
    disciplineFilter,
    fromDate,
    toDate,
  })
  const {
    filteredForTrend,
    filtered,
    filteredWellbeing,
    filteredQuality,
    filteredShotDistribution,
    filteredRadarSessions,
  } = filteredData

  // Aufbereitung vor der Praesentation:
  // Die Tabs bekommen fertige Reihen (ein Punkt je Einheit), damit die
  // Komponenten keine doppelte Transform-Logik enthalten.
  const shotDistributionTimeline = useShotDistributionTimeline({
    filteredShotDistribution,
    displayTimeZone,
  })

  const hitLocationState = useHitLocationChartState({
    filteredForTrend,
    filtered,
    displayTimeZone,
    showCloudTrail,
    showHitLocationTrendX,
    showHitLocationTrendY,
  })

  const resultTrendState = useResultTrendChartState({
    filteredForTrend,
    filtered,
    effectiveDisplayMode,
    selectedDiscipline,
    displayTimeZone,
    maxTicks: CHART_TIME_AXIS_MAX_TICKS,
  })
  const { totalDisciplineShots, metricLabel } = resultTrendState

  const wellbeingQualityState = useWellbeingQualityChartState({
    filteredWellbeing,
    filteredQuality,
    effectiveDisplayMode,
    selectedDiscipline,
    totalDisciplineShots,
  })

  const presentationState = useStatisticsChartPresentationState({
    filtered,
    filteredRadarSessions,
    shotDistributionTimeline,
    hitLocationTrendData: hitLocationState.hitLocationTrendData,
    metricLabel,
    wellbeingScoreLabel: wellbeingQualityState.wellbeingScoreLabel,
    qualityScoreLabel: wellbeingQualityState.qualityScoreLabel,
    displayTimeZone,
    maxTicks: CHART_TIME_AXIS_MAX_TICKS,
  })

  return {
    filterState,
    filteredData,
    shotDistributionTimeline,
    hitLocationState,
    resultTrendState,
    wellbeingQualityState,
    presentationState,
  }
}
