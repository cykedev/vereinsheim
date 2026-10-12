"use client"

import { useOptimistic, useState, useTransition } from "react"

import { saveChoice } from "@/lib/save-choice"
import type { ActionResult } from "@/lib/types"

/**
 * Eine Wahl umschalten und automatisch speichern (Wertung, Art): gezeigt sofort (`shown`), gespeichert über `save`, ein
 * Fehler als Text (`error`). Ein Tippen auf die schon gezeigte speichert nichts, sonst stünde die Vorgabe als Wahl fest
 * (Review). `onShow` meldet die neue Wahl, wo die Seite sie selbst führt (die Wertung auf der Seite einer Scheibe).
 */
export function useSavedChoice<T extends string>(
  value: T,
  save: (value: T) => Promise<ActionResult>,
  notSaved: string,
  onShow?: (value: T) => void
): { shown: T; change: (next: T) => void; error: string | null } {
  const [, startSaving] = useTransition()
  const [shown, show] = useOptimistic(value)
  const [error, setError] = useState<string | null>(null)
  const change = (next: T) => {
    if (next === shown) return
    onShow?.(next)
    setError(null)
    startSaving(async () => {
      show(next)
      setError(await saveChoice(save, next, notSaved))
    })
  }
  return { shown, change, error }
}
