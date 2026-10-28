"use client"

import type { ReactNode } from "react"

import { saveScale } from "../actions"
import { ASPECT_LABELS, SCALE_ASPECTS, stageWords, type ScalePart } from "../scales"

import { EntrySection } from "./EntrySection"
import { StageRow } from "./StageRow"
import { useStages } from "./useStages"

export const SCALE_TITLES: Readonly<Record<ScalePart, { title: string; hint: string }>> = {
  wellbeing: { title: "Befinden", hint: "1 wenig · 5 viel, beim Schlaf 1 schlecht · 5 gut" },
  prognosis: { title: "Prognose", hint: "Wie gut bist du heute? Gut vor einem Wettkampf." },
  feedback: { title: "Feedback", hint: "Wie gut warst du wirklich? Gestrichelt deine Prognose." },
}

/**
 * Befinden, Prognose oder Feedback als Abschnitt mit einer Zeile je Aspekt. Gefüllt ist er, sobald ein Wert steht;
 * die Prognose auch mit erwartetem Ergebnis (`filledBy`). Im Feedback steht die Prognose gestrichelt (`marks`).
 */
export function ScaleSection({
  entryId,
  day,
  part,
  values,
  marks,
  filledBy = false,
  children,
}: {
  entryId: string
  day: string
  part: ScalePart
  values: Readonly<Record<string, number | null>>
  marks?: Readonly<Record<string, number | null>>
  /** gefüllt auch ohne Wert (das erwartete Ergebnis der Prognose) */
  filledBy?: boolean
  children?: ReactNode
}) {
  const { shown, select, error } = useStages(values, (aspect, stage) =>
    saveScale(entryId, part, aspect, stage)
  )
  const filled = filledBy || Object.values(values).some((value) => value !== null)
  const { title, hint } = SCALE_TITLES[part]
  return (
    <EntrySection
      entryId={entryId}
      section={part}
      title={title}
      hint={hint}
      day={day}
      filled={filled}
    >
      <div className="grid divide-y divide-border">
        {SCALE_ASPECTS[part].map((aspect) => (
          <StageRow
            key={aspect}
            label={ASPECT_LABELS[aspect]}
            words={stageWords(part, aspect)}
            value={shown[aspect] ?? null}
            mark={marks?.[aspect] ?? null}
            onSelect={(stage) => select(aspect, stage)}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {children}
    </EntrySection>
  )
}
