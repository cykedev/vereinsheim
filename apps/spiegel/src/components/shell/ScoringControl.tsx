"use client"

import { useOptimistic, useState, useTransition } from "react"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { ScoringSwitch } from "@vereinsheim/shot-ui/controls/ScoringSwitch"

import { saveScoring } from "@/lib/scoring-save"
import type { ActionResult } from "@/lib/types"

/**
 * Wertung umschalten und automatisch speichern (Seite einer Scheibe, Liste, Fortschritt; Plan
 * `plans/2026-10-12-spiegel-wertung.md`): gezeigt sofort, gespeichert über `save`, ein Fehler als Text darunter. Ein
 * Tippen auf die schon gezeigte speichert nichts, sonst stünde die Vorgabe als Wahl fest (Review). `onShow` meldet die
 * neue Wertung, wo die Seite sie selbst führt (die Scheibe; dort bleibt sie auch, wenn das Speichern scheitert, die
 * Meldung sagt es); Liste und Fortschritt warten auf die Seite vom Server.
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
  const [, startSaving] = useTransition()
  const [shown, show] = useOptimistic(scoring)
  const [error, setError] = useState<string | null>(null)
  const change = (next: Scoring) => {
    if (next === shown) return
    onShow?.(next)
    setError(null)
    startSaving(async () => {
      show(next)
      setError(await saveScoring(save, next))
    })
  }
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
