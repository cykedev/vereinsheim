// Eingaben eines Ziels aus dem Browser, geprüft mit zod. Die Messung ist ganz oder gar nicht gesetzt: Schwelle,
// Wertung, Schusszahl und was zählt gehören zusammen, und nur ein Ergebnisziel mit Disziplin trägt sie.

import { z } from "zod"

import { dayInput } from "../validation"
import type { GoalCards, GoalMeasure, GoalScoring } from "./measure"
import { GOAL_ERRORS } from "./texts"

export const TITLE_MAX = 200
export const SHOTS_MAX = 200

/** die Messung, wie das Formular sie schickt; die Schwelle als Text („355“, „365,5“) */
const measureInput = z.object({
  measure: z.enum(["card", "series", "average"]),
  threshold: z.string().max(20),
  scoring: z.enum(["rings", "decimal"]),
  shots: z.number().int(),
  cards: z.enum(["all", "training", "competition"]),
})

export const goalInput = z.object({
  title: z.string().max(TITLE_MAX + 200),
  kind: z.enum(["result", "process"]),
  familyId: z.number().int().positive().nullable(),
  from: dayInput,
  to: dayInput,
  measure: measureInput.nullable(),
})

export type GoalInput = z.input<typeof goalInput>

/** ein Ziel, wie es gespeichert wird */
export interface GoalData {
  title: string
  kind: "result" | "process"
  familyId: number | null
  from: string
  to: string
  measure: {
    measure: GoalMeasure
    threshold: number
    scoring: GoalScoring
    shots: number
    cards: GoalCards
  } | null
}

export type GoalFieldErrors = Partial<
  Record<"title" | "familyId" | "to" | "threshold" | "shots", string[]>
>

/** die Schwelle in der Wertung: ganze Ringe ohne Stelle, Zehntel mit höchstens einer; ungültig → null */
export function parseThreshold(raw: string, scoring: GoalScoring): number | null {
  const text = raw.trim()
  const pattern = scoring === "rings" ? /^\d{1,4}$/ : /^\d{1,4}(?:[.,]\d)?$/
  if (!pattern.test(text)) return null
  const value = Number(text.replace(",", "."))
  return value > 0 ? value : null
}

/**
 * Prüft ein Ziel: Satz, Zeitraum, eine Disziplin aus `families` oder keine, die Messung ganz oder gar nicht (nur beim
 * Ergebnisziel und nur mit Disziplin), die Schwelle erreichbar auf die Schusszahl. Ein Prozessziel verliert eine
 * mitgeschickte Messung.
 */
export function parseGoal(
  raw: unknown,
  families: ReadonlySet<number>
): { data: GoalData } | { fieldErrors: GoalFieldErrors } | { invalid: true } {
  const parsed = goalInput.safeParse(raw)
  if (!parsed.success) return { invalid: true }
  const input = parsed.data
  const errors: GoalFieldErrors = {}
  const title = input.title.replace(/\s+/g, " ").trim()
  if (!title) errors.title = [GOAL_ERRORS.title]
  else if (title.length > TITLE_MAX) errors.title = [GOAL_ERRORS.titleLong]
  if (input.to < input.from) errors.to = [GOAL_ERRORS.range]
  if (input.familyId !== null && !families.has(input.familyId)) return { invalid: true }
  const wanted = input.kind === "result" ? input.measure : null
  let measure: GoalData["measure"] = null
  if (wanted) {
    if (input.familyId === null) errors.familyId = [GOAL_ERRORS.family]
    if (wanted.shots < 1 || wanted.shots > SHOTS_MAX) errors.shots = [GOAL_ERRORS.shots]
    const threshold = parseThreshold(wanted.threshold, wanted.scoring)
    const most = wanted.shots * (wanted.scoring === "rings" ? 10 : 10.9)
    if (threshold === null)
      errors.threshold = [
        wanted.scoring === "rings" ? GOAL_ERRORS.ringsThreshold : GOAL_ERRORS.tenthsThreshold,
      ]
    else if (!errors.shots && threshold > most + 1e-9)
      errors.threshold = [GOAL_ERRORS.tooHigh(wanted.shots)]
    if (threshold !== null)
      measure = {
        measure: wanted.measure,
        threshold,
        scoring: wanted.scoring,
        shots: wanted.shots,
        cards: wanted.cards,
      }
  }
  if (Object.keys(errors).length) return { fieldErrors: errors }
  return {
    data: {
      title,
      kind: input.kind,
      familyId: input.familyId,
      from: input.from,
      to: input.to,
      measure,
    },
  }
}

/** die Messung eines gespeicherten Ziels: alle vier Felder oder keine (sonst gilt sie als nicht gesetzt) */
export function storedMeasure(row: {
  measure: GoalMeasure | null
  threshold: { toString(): string } | number | null
  scoring: GoalScoring | null
  shots: number | null
  cards: GoalCards
}): GoalData["measure"] {
  if (row.measure === null || row.threshold === null || row.scoring === null || row.shots === null)
    return null
  return {
    measure: row.measure,
    threshold: Number(row.threshold.toString()),
    scoring: row.scoring,
    shots: row.shots,
    cards: row.cards,
  }
}
