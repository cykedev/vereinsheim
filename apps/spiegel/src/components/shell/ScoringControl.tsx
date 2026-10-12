"use client"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"

import type { ActionResult } from "@/lib/types"

import { useSavedChoice } from "./useSavedChoice"

/**
 * Wertung umschalten und automatisch speichern (Seite einer Scheibe, Liste, Fortschritt; Plan
 * `plans/2026-10-12-spiegel-wertung.md`), über `useSavedChoice`. `onShow` meldet die neue Wertung, wo die Seite sie
 * selbst führt (die Scheibe; dort bleibt sie auch, wenn das Speichern scheitert, die Meldung sagt es); Liste und
 * Fortschritt warten auf die Seite vom Server.
 */
export function ScoringControl({
  scoring,
  official,
  label,
  save,
  onShow,
}: {
  scoring: Scoring
  /** amtliche Wertung als Hinweis (Seite einer Scheibe) */
  official?: Scoring
  /** Name der Wahl, wenn sie nur einen Teil der Seite umstellt */
  label?: string
  save: (scoring: Scoring) => Promise<ActionResult>
  onShow?: (scoring: Scoring) => void
}) {
  const { shown, change, error } = useSavedChoice(
    scoring,
    save,
    "Die Wertung ließ sich nicht speichern.",
    onShow
  )
  return (
    <div className="grid gap-1.5">
      <ScoringSwitch scoring={shown} official={official} label={label} onChange={change} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
