// Selbstbild ohne Urteil: erwartet und geschossen, vorher und nachher. Rein; Zahlen, kein Test.

import type { ResultValue } from "@/lib/results-read"

import { SCALE_ASPECTS, type ScaleAspect, type ScalePart } from "../scales"
import { type EntryResultCard, shotResult } from "../summaries"

export interface ExpectedRow {
  entryId: string
  day: string
  expected: number
  shot: ResultValue
  /** geschossen − erwartet, in Ringen */
  delta: number
}

/**
 * Erwartet gegen geschossen: je Eintrag mit erwartetem und geschossenem Ergebnis (`shotResult`, die Regel der Seite
 * eines Eintrags) eine Zeile, neueste oben; dazu das Mittel der Abstände und wie viele fehlen
 */
export function expectedRows(
  entries: readonly {
    id: string
    day: string
    expectedScore: number | null
    cards: readonly EntryResultCard[]
  }[]
): { rows: ExpectedRow[]; mean: number | null; left: number } {
  const rows: ExpectedRow[] = []
  let left = 0
  for (const entry of entries) {
    if (entry.expectedScore === null) continue
    const shot = shotResult(entry.cards)
    if (!shot) {
      left += 1
      continue
    }
    rows.push({
      entryId: entry.id,
      day: entry.day,
      expected: entry.expectedScore,
      shot,
      delta: shot.value - entry.expectedScore,
    })
  }
  rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  const mean = rows.length ? rows.reduce((sum, row) => sum + row.delta, 0) / rows.length : null
  return { rows, mean, left }
}

/** die Lage eines Werts auf der Skala 1 bis 5: die Mitte einer Stufe ist ihre Zahl */
export function stagePosition(value: number): number {
  return Math.min(5, Math.max(1, (value + 10) / 20))
}

type PrognosisAspect = (typeof SCALE_ASPECTS.prognosis)[number]

/**
 * Vorher und nachher: je Bereich der Prognose das Mittel von Prognose und Feedback über die Einträge, die in diesem
 * Bereich beides haben (`pairs`); `n` sind die Einträge mit mindestens einem Paar
 */
export function beforeAfter(
  entries: readonly {
    scales: readonly { part: ScalePart; aspect: ScaleAspect | string; value: number }[]
  }[]
): {
  n: number
  rows: {
    aspect: PrognosisAspect
    prognosis: number | null
    feedback: number | null
    pairs: number
  }[]
} {
  let n = 0
  const sums = new Map<PrognosisAspect, { prognosis: number; feedback: number; pairs: number }>(
    SCALE_ASPECTS.prognosis.map((aspect) => [aspect, { prognosis: 0, feedback: 0, pairs: 0 }])
  )
  for (const entry of entries) {
    let paired = false
    for (const aspect of SCALE_ASPECTS.prognosis) {
      const before = entry.scales.find((s) => s.part === "prognosis" && s.aspect === aspect)
      const after = entry.scales.find((s) => s.part === "feedback" && s.aspect === aspect)
      if (!before || !after) continue
      const sum = sums.get(aspect)!
      sum.prognosis += before.value
      sum.feedback += after.value
      sum.pairs += 1
      paired = true
    }
    if (paired) n += 1
  }
  return {
    n,
    rows: SCALE_ASPECTS.prognosis.map((aspect) => {
      const sum = sums.get(aspect)!
      return {
        aspect,
        prognosis: sum.pairs ? sum.prognosis / sum.pairs : null,
        feedback: sum.pairs ? sum.feedback / sum.pairs : null,
        pairs: sum.pairs,
      }
    }),
  }
}
