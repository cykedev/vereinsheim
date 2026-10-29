"use client"

import { useCallback, useEffect, useState } from "react"

import { periodPattern } from "@vereinsheim/shot-core/analysis"
import type { PatternState } from "@vereinsheim/shot-ui/period/PatternPanel"

import { periodPatternAction } from "@/lib/pattern-actions"

/** das Muster ohne Scheiben: keine Schüsse, jedes Urteil „zu wenig“ */
const EMPTY: PatternState = { status: "ready", pattern: periodPattern([]) }

/**
 * Das Trefferbild des Zeitraums, geholt erst, wenn es gebraucht wird (`enabled`: Bild gezeigt oder Reiter Präzision
 * oder Lage offen), und gemerkt für dieselben Scheiben. Eine Antwort zu einer alten Menge Scheiben gilt nicht mehr;
 * „Noch einmal“ (`retry`) fragt neu.
 */
export function usePeriodPattern(
  ids: readonly string[],
  enabled: boolean
): { state: PatternState; retry: () => void } {
  const key = ids.join(",")
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    key: string
    attempt: number
    state: PatternState
  } | null>(null)
  const current = result?.key === key && result.attempt === attempt ? result.state : null
  const needed = enabled && current === null && key !== ""
  useEffect(() => {
    if (!needed) return
    let live = true
    const settle = (state: PatternState) => {
      if (live) setResult({ key, attempt, state })
    }
    periodPatternAction(key.split(","))
      .then((answer) =>
        settle(
          "success" in answer && answer.data
            ? { status: "ready", pattern: answer.data }
            : { status: "error" }
        )
      )
      .catch(() => settle({ status: "error" }))
    return () => {
      live = false
    }
  }, [needed, key, attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  // ohne Scheibe, die das Ergebnis zählt (etwa nur Einschießen, das nicht mitzählt), gibt es nichts zu holen
  if (key === "") return { state: EMPTY, retry }
  return { state: current ?? { status: "loading" }, retry }
}
