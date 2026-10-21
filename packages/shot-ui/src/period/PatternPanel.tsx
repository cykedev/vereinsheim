"use client"

import type { PeriodPattern } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import type { ReactNode } from "react"

import { HeatLegend, PatternTarget } from "./PatternTarget"
import {
  basisText,
  CENTER_NOTE,
  LEGEND_POINTS,
  outsideText,
  PATTERN_FAILED,
  PATTERN_LOADING,
  pictureWords,
} from "./patternWords"

/** wie weit das Muster ist: holt der Browser es noch, ist es da, oder ging es schief */
export type PatternState =
  | { status: "loading" }
  | { status: "ready"; pattern: PeriodPattern }
  | { status: "error" }

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
 * Das Trefferbild als Hauptbild der Seite eines Zeitraums: wo die Schüsse lagen, ab 50 Schuss in den Farben der Dichte
 * mit Legende,
 * darunter die Antwort (Lage, dann Form) und die Grundlage. Lädt das Muster noch oder ging es schief, steht an seiner
 * Stelle ein Platz gleicher Größe.
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
  return (
    <div data-pattern-panel className="mx-auto grid w-full max-w-[34rem] gap-3">
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
        <Ready pattern={state.pattern} target={target} />
      )}
    </div>
  )
}

function Ready({ pattern, target }: { pattern: PeriodPattern; target: TargetImage }) {
  const words = pictureWords(pattern)
  const sentence = [words.lead, words.more].filter(Boolean).join(" ")
  const style = pattern.picture.style
  return (
    <>
      <PatternTarget layer={pattern.picture} target={target} label={sentence} />
      {style !== "bands" && <p className="text-[13px] text-muted-foreground">{LEGEND_POINTS}</p>}
      {style !== "rings" && <HeatLegend />}
      <div className="grid gap-1">
        <p data-pattern-sentence className="text-[14px]">
          <b className="font-semibold">{words.lead}</b>
          {words.more && <span className="text-foreground-2">{` ${words.more}`}</span>}
        </p>
        <p data-pattern-basis className="text-[13px] text-muted-foreground">
          {[
            basisText(pattern),
            pattern.picture.outside ? outsideText(pattern.picture.outside) : "",
            CENTER_NOTE,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      </div>
    </>
  )
}
