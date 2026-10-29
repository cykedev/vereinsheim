// „Merkst du, wann eine Serie gut ist?“: Je Scheibe eines Eintrags werden ihre bewerteten Serien mit Wert am Median
// ihrer Bewertungen geteilt, und jede Serie zählt mit ihrem Ø je Schuss minus dem Ø je Schuss der bewerteten Serien
// derselben Scheibe. Innerhalb einer Scheibe fallen Tagesform und Fortschritt heraus. Rein.

import {
  compareValues,
  type CardValue,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"

import { DISTANCE } from "./influences"
import { splitAtMedian } from "./split"

export interface RatedCard {
  entryId: string
  day: string
  cardId: string
  /** Serien der Scheibe mit Ø je Schuss, wie `FormCard.series` */
  series: { series: number; shots: number; mean: number | null }[]
  /** Bewertung je Seriennummer, 0 bis 100 */
  ratings: ReadonlyMap<number, number>
}

export interface ExecutionResult {
  /** gezählte Serien und Abende (verschiedene Tage) */
  series: number
  evenings: number
  /** Scheiben mit bewerteten Serien, die alle gleich bewertet sind */
  sameRated: number
  high: number
  low: number
  /** a die schwächer, b die besser bewerteten; Δ in Ringen je Schuss */
  comparison: PeriodComparison | null
}

/**
 * Besser gegen schwächer bewertete Serien derselben Scheibe. Serien ohne Wert oder ohne Bewertung fallen weg, eine
 * Bewertung einer Seriennummer, die die Scheibe nicht hat, zählt nicht. Eine Scheibe mit gleich bewerteten Serien sagt
 * nichts und zählt nicht (`sameRated`). Ohne Streuung je Serie urteilt `compareValues` mit dem Rangtest über die Serien.
 */
export function executionCheck(cards: readonly RatedCard[]): ExecutionResult {
  const high: CardValue[] = []
  const low: CardValue[] = []
  const days = new Set<string>()
  let sameRated = 0
  for (const card of cards) {
    const rated = card.series.flatMap((s) => {
      const rating = card.ratings.get(s.series)
      return rating === undefined || s.mean === null || !s.shots
        ? []
        : [{ series: s.series, shots: s.shots, mean: s.mean, rating }]
    })
    // eine einzelne bewertete Serie hat nichts, wogegen sie stünde
    if (rated.length < 2) continue
    const split = splitAtMedian(rated, (s) => s.rating)
    if (!split.high.length && !split.low.length) {
      sameRated += 1
      continue
    }
    const shots = rated.reduce((sum, s) => sum + s.shots, 0)
    const center = rated.reduce((sum, s) => sum + s.mean * s.shots, 0) / shots
    const value = (s: (typeof rated)[number]): CardValue => ({
      id: `${card.cardId}:${s.series}`,
      atMs: 0,
      value: s.mean - center,
      n: s.shots,
    })
    high.push(...split.high.map(value))
    low.push(...split.low.map(value))
    days.add(card.day)
  }
  return {
    series: high.length + low.length,
    evenings: days.size,
    sameRated,
    high: high.length,
    low: low.length,
    comparison: compareValues(low, high, DISTANCE),
  }
}
