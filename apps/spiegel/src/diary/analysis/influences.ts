// Einflüsse: Lag ein Eintrag mit hohem Befinden anders zu seiner Form als einer mit niedrigem? Je Merkmal zwei Gruppen
// der Einträge, über und unter dem Median (`splitAtMedian`), verglichen wie zwei Zeiträume über den Abstand zur Form
// (`compareValues`, [[adr-034]], ab fünf je Seite). Rein.

import {
  compareValues,
  pooledValue,
  type CardValue,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"

import { SCALE_ASPECTS } from "../scales"

import { splitAtMedian } from "./split"

/** die Merkmale des Befindens vor dem Training */
export const WELLBEING_ASPECTS = SCALE_ASPECTS.wellbeing
export type WellbeingAspect = (typeof WELLBEING_ASPECTS)[number]

/**
 * Der Abstand zur Form als Kennzahl: Ø je Schuss ohne Wertung. So mittelt `pooledValue` genau (Σ vᵢnᵢ / Σ nᵢ), ohne
 * Raster, denn ein Abstand liegt nicht auf dem Raster der Zehntel.
 */
export const DISTANCE: MetricDefinition = {
  ...(metricByKey("result.decimalMean") as MetricDefinition),
  key: "diary.formDistance",
  scoring: undefined,
  counterpart: undefined,
}

export interface InfluenceInput {
  entryId: string
  day: string
  competition: boolean
  distance: CardValue
  wellbeing: Partial<Record<WellbeingAspect, number>>
}

export interface InfluencePoint {
  entryId: string
  day: string
  competition: boolean
  value: number
  distance: number
  side: "high" | "low" | "none"
}

export interface InfluenceRow {
  aspect: WellbeingAspect
  /** Einträge mit Wert in diesem Merkmal, die zählen */
  entered: number
  high: { n: number; mean: number | null }
  low: { n: number; mean: number | null }
  /** a die niedrige, b die hohe Gruppe; null, wenn eine Gruppe leer ist */
  comparison: PeriodComparison | null
  points: InfluencePoint[]
}

const groupOf = (values: readonly CardValue[]) => ({
  n: values.length,
  mean: pooledValue(values, DISTANCE),
})

/** je Merkmal des Befindens die beiden Gruppen, ihr Vergleich und die Punkte, in der Folge von `WELLBEING_ASPECTS` */
export function influenceRows(inputs: readonly InfluenceInput[]): InfluenceRow[] {
  return WELLBEING_ASPECTS.map((aspect) => {
    const entered = inputs.filter((input) => input.wellbeing[aspect] !== undefined)
    const valueOf = (input: InfluenceInput) => input.wellbeing[aspect] as number
    const { high, low } = splitAtMedian(entered, valueOf)
    const highIds = new Set(high.map((input) => input.entryId))
    const lowIds = new Set(low.map((input) => input.entryId))
    const highValues = high.map((input) => input.distance)
    const lowValues = low.map((input) => input.distance)
    return {
      aspect,
      entered: entered.length,
      high: groupOf(highValues),
      low: groupOf(lowValues),
      comparison: compareValues(lowValues, highValues, DISTANCE),
      points: entered.map((input) => ({
        entryId: input.entryId,
        day: input.day,
        competition: input.competition,
        value: valueOf(input),
        distance: input.distance.value,
        side: highIds.has(input.entryId) ? "high" : lowIds.has(input.entryId) ? "low" : "none",
      })),
    }
  })
}
