// Die Form vor einem Abend und der Abstand eines Eintrags zu ihr ([[spiegel-diary]], Auswertung). Rein: Die Scheiben
// kommen aus `resultFormCards`, die Werte in der Wertung der Familie.

import { pooledValue, type CardValue } from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { DELTA_WINDOW } from "@vereinsheim/shot-ui/period/model"

import type { FormCard } from "@/lib/results-read"

const MEAN = metricByKey("result.decimalMean") as MetricDefinition

/** der Ø je Schuss in der Wertung, über die Schüsse gemittelt (auf ihrem Raster) */
const meanIn = (scoring: Scoring) => inScoring(MEAN, scoring)

const valuesOf = (cards: readonly FormCard[]): CardValue[] =>
  cards.flatMap((card) =>
    card.mean ? [{ id: card.id, atMs: card.startedAtMs, ...card.mean }] : []
  )

/**
 * Die Form vor einem Abend: Schnitt über die Schüsse der fünf letzten gezählten Scheiben mit Wert vor diesem Abend
 * (`DELTA_WINDOW`, `pooledValue` wie der Abstand in der Liste und der Schnitt der letzten fünf im Fortschritt). Scheiben
 * desselben Abends zählen nie. null unter fünf.
 */
export function formBefore(
  counted: readonly FormCard[],
  day: string,
  scoring: Scoring
): number | null {
  const before = valuesOf(counted.filter((card) => card.day < day))
  if (before.length < DELTA_WINDOW) return null
  return pooledValue(before.slice(-DELTA_WINDOW), meanIn(scoring))
}

/**
 * Der Wert eines Eintrags: Ø je Schuss über die Schüsse seiner gezählten Scheiben (`pooledValue`), die Schüsse und die
 * Streuung der Schusswerte um das Mittel des Eintrags, zusammengesetzt aus Streuung und Mittel je Scheibe:
 * s² = (Σ (nᵢ − 1) sdᵢ² + Σ nᵢ (mᵢ − m)²) / (N − 1). Fehlt sie an einer Scheibe (nur aus Summen), fehlt sie. null ohne
 * Scheibe mit Wert.
 */
export function entryValue(
  cards: readonly FormCard[],
  scoring: Scoring
): { value: number; n: number; sd?: number | null } | null {
  const values = valuesOf(cards)
  const value = pooledValue(values, meanIn(scoring))
  if (value === null) return null
  const n = values.reduce((sum, v) => sum + v.n, 0)
  const result: { value: number; n: number; sd?: number | null } = { value, n }
  if (values.every((v) => v.sd !== undefined)) {
    if (n < 2 || values.some((v) => v.n > 1 && v.sd === null)) result.sd = null
    else {
      const inner = values.reduce((sum, v) => sum + (v.n - 1) * (v.sd ?? 0) ** 2, 0)
      const between = values.reduce((sum, v) => sum + v.n * (v.value - value) ** 2, 0)
      result.sd = Math.sqrt((inner + between) / (n - 1))
    }
  }
  return result
}

/**
 * Der Abstand zur Form als Wert für `compareValues`: Wert − Form, mit den Schüssen und der Streuung des Eintrags (eine
 * feste Zahl abzuziehen ändert die Streuung nicht)
 */
export function formDistance(
  entry: { id: string; startedAtMs: number },
  value: NonNullable<ReturnType<typeof entryValue>>,
  form: number
): CardValue {
  const distance: CardValue = {
    id: entry.id,
    atMs: entry.startedAtMs,
    value: value.value - form,
    n: value.n,
  }
  if (value.sd !== undefined) distance.sd = value.sd
  return distance
}
