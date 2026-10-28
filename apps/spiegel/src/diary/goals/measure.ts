// Die Messung eines Ziels: welche Scheiben oder Serien zählen, wie viele die Schwelle erreichen, wie es zuletzt lief,
// das Beste und der Schnitt. Rein, ohne Datenbank; die Scheiben kommen aus `resultGoalCards`. Spiegel zeigt Zahlen und
// urteilt nicht ([[spiegel-diary]]).

import type { GoalCard } from "@/lib/results-read"

export type GoalMeasure = "card" | "series" | "average"
export type GoalScoring = "rings" | "decimal"
export type GoalCards = "all" | "training" | "competition"

export interface GoalRule {
  measure: GoalMeasure
  threshold: number
  scoring: GoalScoring
  /** Schusszahl einer Scheibe (`card`, `average`) oder einer Serie (`series`), die zählt */
  shots: number
  cards: GoalCards
  /** ISO-Tage, beide eingeschlossen */
  from: string
  to: string
}

/** eine gezählte Scheibe oder Serie */
export interface GoalPoint {
  cardId: string
  day: string
  startedAtMs: number
  /** die Nummer der Serie; bei Scheiben null */
  series: number | null
  value: number
  hit: boolean
}

export interface GoalStand {
  /** gezählte Scheiben (`card`, `average`) oder Serien (`series`) */
  counted: number
  hits: number
  /** die letzten zehn gezählten */
  recent: { counted: number; hits: number }
  best: GoalPoint | null
  /** Schnitt der gezählten Scheiben, nur bei `average` */
  mean: number | null
  /** in zeitlicher Folge */
  points: GoalPoint[]
  /** Scheiben im Zeitraum und in der Art, ohne nur Probe */
  cards: number
  /** Scheiben davon, die nicht zählen, nach Grund */
  left: { noValue: number; otherShots: number; noSeries: number }
}

export const RECENT = 10

/** ein Wert in Zehnteln auf eine Stelle, damit 355,0000001 und 354,9999999 nicht über die Schwelle kippen */
const rounded = (value: number, scoring: GoalScoring) =>
  scoring === "decimal" ? Math.round(value * 10) / 10 : Math.round(value)

const inKind = (card: GoalCard, cards: GoalCards) => cards === "all" || card.kind === cards

export function measureGoal(rule: GoalRule, cards: readonly GoalCard[]): GoalStand {
  const left = { noValue: 0, otherShots: 0, noSeries: 0 }
  const points: GoalPoint[] = []
  const inPeriod = cards
    .filter((card) => card.day >= rule.from && card.day <= rule.to)
    .filter((card) => inKind(card, rule.cards) && !card.probeOnly)
    .sort((a, b) => a.startedAtMs - b.startedAtMs)
  const point = (card: GoalCard, series: number | null, raw: number): GoalPoint => {
    const value = rounded(raw, rule.scoring)
    return {
      cardId: card.id,
      day: card.day,
      startedAtMs: card.startedAtMs,
      series,
      value,
      hit: value >= rule.threshold,
    }
  }
  for (const card of inPeriod) {
    if (rule.measure === "series") {
      // ohne Serien: nur ein Gesamtergebnis, oder die Projektion ist älter als Version 7 und wird nachgerechnet
      if (!card.series?.length) {
        left.noSeries++
        continue
      }
      for (const series of card.series) {
        const value = series[rule.scoring]
        if (series.shots === rule.shots && value !== null)
          points.push(point(card, series.series, value))
      }
      continue
    }
    if (card.shots !== rule.shots) {
      left.otherShots++
      continue
    }
    const value = card[rule.scoring]
    if (value === null) {
      left.noValue++
      continue
    }
    points.push(point(card, null, value))
  }
  const recent = points.slice(-RECENT)
  const best = points.reduce<GoalPoint | null>(
    (top, p) => (top === null || p.value > top.value ? p : top),
    null
  )
  return {
    counted: points.length,
    hits: points.filter((p) => p.hit).length,
    recent: { counted: recent.length, hits: recent.filter((p) => p.hit).length },
    best,
    mean:
      rule.measure === "average" && points.length
        ? points.reduce((sum, p) => sum + p.value, 0) / points.length
        : null,
    points,
    cards: inPeriod.length,
    left,
  }
}
