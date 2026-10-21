"use client"

import type { PeriodPattern } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { useState, type ReactNode } from "react"

import { PatternTarget } from "./PatternTarget"
import {
  basisText,
  LEGEND_DENSITY,
  LEGEND_POINTS,
  PATTERN_FAILED,
  PATTERN_LOADING,
  positionWords,
  shapeWords,
  SIGHT_TEXT,
  type PatternSight,
} from "./patternWords"

/** wie weit das Muster ist: holt der Browser es noch, ist es da, oder ging es schief */
export type PatternState =
  | { status: "loading" }
  | { status: "ready"; pattern: PeriodPattern }
  | { status: "error" }

const SIGHTS = [
  { value: "form", label: "Form" },
  { value: "position", label: "Lage" },
] as const

/** Platz in der Größe des Bilds, solange es lädt oder fehlt: Die Seite springt nicht */
function Placeholder({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div
        aria-hidden="true"
        data-pattern-placeholder="true"
        className="aspect-square w-full rounded-xl border border-border bg-surface-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-[13px] text-muted-foreground">
          {text}
        </p>
        {action}
      </div>
    </div>
  )
}

/**
 * Das Trefferbild als Hauptbild der Seite eines Zeitraums: Sicht „Form | Lage“ (Vorgabe Form, nicht in der Adresse),
 * die Erklärzeile der Sicht, das Bild, darunter die Antwort als Satz, Legende und Grundlage. Lädt das Muster noch oder
 * ging es schief, steht an seiner Stelle ein Platz gleicher Größe.
 */
export function PatternPanel({
  state,
  target,
  onRetry,
}: {
  state: PatternState
  target: TargetImage
  onRetry: () => void
}) {
  const [sight, setSight] = useState<PatternSight>("form")
  return (
    <div data-pattern-panel={sight} className="grid gap-3">
      <div className="grid gap-1.5">
        <Segmented
          label="Sicht"
          options={SIGHTS}
          value={sight}
          onChange={setSight}
          className="w-fit"
        />
        <p className="text-[13px] text-muted-foreground">{SIGHT_TEXT[sight]}</p>
      </div>
      <div className="mx-auto grid w-full max-w-[34rem] gap-3">
        {state.status === "loading" ? (
          <Placeholder text={PATTERN_LOADING} />
        ) : state.status === "error" ? (
          <Placeholder
            text={PATTERN_FAILED}
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
                Noch einmal
              </Button>
            }
          />
        ) : (
          <Ready pattern={state.pattern} target={target} sight={sight} />
        )}
      </div>
    </div>
  )
}

function Ready({
  pattern,
  target,
  sight,
}: {
  pattern: PeriodPattern
  target: TargetImage
  sight: PatternSight
}) {
  const layer = sight === "form" ? pattern.form : pattern.position
  const words = sight === "form" ? shapeWords(pattern.shape) : positionWords(pattern.overTime)
  const sentence = [words.lead, words.more].filter(Boolean).join(" ")
  return (
    <>
      <PatternTarget
        layer={layer}
        target={target}
        center={sight === "position" ? pattern.overTime.mean : null}
        label={sentence}
      />
      <div className="grid gap-1">
        <p data-pattern-sentence className="text-[14px]">
          <b className="font-semibold">{words.lead}</b>
          {words.more && <span className="text-foreground-2">{` ${words.more}`}</span>}
        </p>
        <p className="text-[13px] text-muted-foreground">
          {layer.grid ? LEGEND_DENSITY : LEGEND_POINTS}
        </p>
        <p data-pattern-basis className="text-[13px] text-muted-foreground">
          {basisText(pattern)}
        </p>
      </div>
    </>
  )
}
