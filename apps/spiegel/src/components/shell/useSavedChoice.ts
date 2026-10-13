"use client"

import { useOptimistic, useState, useTransition } from "react"

import { inScope, saveChoice, type Scoped } from "@/lib/save-choice"
import type { ActionResult } from "@/lib/types"

/**
 * Eine Wahl umschalten und automatisch speichern (Wertung, Art): gezeigt sofort (`shown`), gespeichert über `save`, ein
 * Fehler als Text (`error`). Ein Tippen auf die schon gezeigte speichert nichts, sonst stünde die Vorgabe als Wahl fest
 * (Review). `onShow` meldet die neue Wahl, wo die Seite sie selbst führt (die Wertung auf der Seite einer Scheibe).
 * `scope` ist das, wofür gewählt wird (Scheibe, Familie): Wechselt die Familie, bleibt die Hülle stehen (Next hängt sie
 * bei neuen Suchparametern nicht neu ein); gezeigte Wahl und Fehler gelten dann nur für ihre Familie (Review, 13. Oktober
 * 2026).
 */
export function useSavedChoice<T extends string>({
  value,
  scope,
  save,
  notSaved,
  onShow,
}: {
  value: T
  scope: string
  save: (value: T) => Promise<ActionResult>
  notSaved: string
  onShow?: (value: T) => void
}): { shown: T; change: (next: T) => void; error: string | null } {
  const [, startSaving] = useTransition()
  const [optimistic, show] = useOptimistic<Scoped<T>>({ scope, value })
  const [error, setError] = useState<Scoped<string | null> | null>(null)
  const shown = inScope(optimistic, scope, value)
  const change = (next: T) => {
    if (next === shown) return
    onShow?.(next)
    setError(null)
    startSaving(async () => {
      show({ scope, value: next })
      setError({ scope, value: await saveChoice(save, next, notSaved) })
    })
  }
  return { shown, change, error: inScope(error, scope, null) }
}
