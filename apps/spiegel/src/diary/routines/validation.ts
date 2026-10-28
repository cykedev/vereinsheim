// Eingaben eines Ablaufs aus dem Browser, geprüft mit zod: Name, Disziplin oder keine, die Schritte als ein Text.

import { z } from "zod"

import {
  STEP_DESCRIPTION_MAX,
  STEP_TITLE_MAX,
  STEPS_MAX,
  textToSteps,
  type RoutineStep,
} from "./steps"
import { ROUTINE_ERRORS } from "./texts"

export const NAME_MAX = 200

export const routineInput = z.object({
  name: z.string().max(NAME_MAX + 200),
  familyId: z.number().int().positive().nullable(),
  text: z.string().max(STEPS_MAX * (STEP_TITLE_MAX + STEP_DESCRIPTION_MAX)),
})

export type RoutineInput = z.input<typeof routineInput>

/** ein Ablauf, wie er gespeichert wird */
export interface RoutineData {
  name: string
  familyId: number | null
  steps: RoutineStep[]
}

export type RoutineFieldErrors = Partial<Record<"name" | "text", string[]>>

/** die gespeicherten Schritte, geprüft; Unbekanntes fällt weg */
export const routineSteps = z.array(
  z.object({ title: z.string(), description: z.string().optional() })
)

/** prüft einen Ablauf; eine Disziplin, die es für das Konto nicht gibt, ist ungültig */
export function parseRoutine(
  raw: unknown,
  families: ReadonlySet<number>
): { data: RoutineData } | { fieldErrors: RoutineFieldErrors } | { invalid: true } {
  const parsed = routineInput.safeParse(raw)
  if (!parsed.success) return { invalid: true }
  const { familyId, text } = parsed.data
  if (familyId !== null && !families.has(familyId)) return { invalid: true }
  const errors: RoutineFieldErrors = {}
  const name = parsed.data.name.replace(/\s+/g, " ").trim()
  if (!name) errors.name = [ROUTINE_ERRORS.name]
  else if (name.length > NAME_MAX) errors.name = [ROUTINE_ERRORS.nameLong]
  const steps = textToSteps(text)
  if (!steps.length) errors.text = [ROUTINE_ERRORS.steps]
  else if (steps.length > STEPS_MAX) errors.text = [ROUTINE_ERRORS.tooMany]
  else if (
    steps.some(
      (step) =>
        step.title.length > STEP_TITLE_MAX || (step.description?.length ?? 0) > STEP_DESCRIPTION_MAX
    )
  )
    errors.text = [ROUTINE_ERRORS.stepLong]
  if (Object.keys(errors).length) return { fieldErrors: errors }
  return { data: { name, familyId, steps } }
}
