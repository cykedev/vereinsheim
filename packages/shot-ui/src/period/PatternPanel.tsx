"use client"

import type { PeriodPattern } from "@vereinsheim/shot-core/analysis"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { Button } from "@vereinsheim/ui/button"
import type { ReactNode } from "react"

import { CornerButton, OUTLINES_ICON } from "../target/TargetControls"
import { HeatLegend, PatternTarget, type PatternView } from "./PatternTarget"
import {
  basisText,
  CENTER_NOTE,
  LEGEND_OUTLINES,
  LEGEND_POINTS,
  OUTLINES_LABEL,
  outsideText,
  PATTERN_FAILED,
  PATTERN_LOADING,
  pictureWords,
} from "./patternWords"

/** wie weit das Muster ist: holt der Browser es noch, ist es da, oder ging es schief */
export type PatternState =
  { status: "loading" } | { status: "ready"; pattern: PeriodPattern } | { status: "error" }

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
 * Das Trefferbild als Hauptbild der Seite eines Zeitraums: wo die Schüsse lagen, von 50 bis 3.000 Schuss in den
 * Farben der Dichte mit Legende oder, über den Knopf oben links, als Umrisse wie beim Vergleichen, darüber nur als
 * Umrisse; darunter die Antwort (Lage, dann Form) und die Grundlage. Lädt das Muster noch oder ging es schief, steht an
 * seiner Stelle ein Platz gleicher Größe. Die Wahl hält die App (`view`, `onView`), auch wo sie sie sich merkt; ohne
 * `onView` gibt es keinen Knopf.
 */
export function PatternPanel({
  state,
  target,
  onRetry,
  view = "density",
  onView,
}: {
  state: PatternState
  target: TargetImage
  onRetry: () => void
  /** gewählte Zeichnung, gilt nur von 50 bis 3.000 Schuss */
  view?: PatternView
  onView?: (view: PatternView) => void
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
        <Ready pattern={state.pattern} target={target} view={view} onView={onView} />
      )}
    </div>
  )
}

function Ready({
  pattern,
  target,
  view,
  onView,
}: {
  pattern: PeriodPattern
  target: TargetImage
  view: PatternView
  onView?: (view: PatternView) => void
}) {
  const words = pictureWords(pattern)
  const sentence = [words.lead, words.more].filter(Boolean).join(" ")
  const style = pattern.picture.style
  // die Wahl gibt es von 50 bis 3.000 Schuss; darunter zeigt das Bild jeden Treffer, darüber nur die Umrisse
  const canChoose = style === "shots" && pattern.picture.grid !== null
  const outlines = style === "outlines" || (canChoose && view === "outlines")
  return (
    <>
      <div className="relative">
        <PatternTarget
          layer={pattern.picture}
          target={target}
          label={sentence}
          view={outlines ? "outlines" : "density"}
        />
        {canChoose && onView && (
          <div className="pointer-events-none absolute top-2 left-2">
            <CornerButton
              label={OUTLINES_LABEL}
              pressed={outlines}
              onPress={() => onView(outlines ? "density" : "outlines")}
            >
              {OUTLINES_ICON}
            </CornerButton>
          </div>
        )}
      </div>
      {outlines ? (
        <p data-pattern-legend="outlines" className="text-[13px] text-muted-foreground">
          {LEGEND_OUTLINES}
        </p>
      ) : (
        <>
          <p className="text-[13px] text-muted-foreground">{LEGEND_POINTS}</p>
          {style === "shots" && <HeatLegend />}
        </>
      )}
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
