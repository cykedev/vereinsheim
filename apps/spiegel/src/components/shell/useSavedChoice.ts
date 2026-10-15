"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"

import { inScope, saveChoice, type Scoped } from "@/lib/save-choice"
import type { ActionResult } from "@/lib/types"

/**
 * Eine Wahl umschalten und automatisch speichern (Wertung, Art): gezeigt sofort (`shown`), gespeichert über `save`, ein
 * Fehler als Text (`error`). Ein Tippen auf die schon gezeigte speichert nichts, sonst stünde die Vorgabe als Wahl
 * fest. `onShow` meldet die neue Wahl, wo die Seite sie selbst führt (die Wertung auf der Seite einer Scheibe).
 * `scope` ist das, wofür gewählt wird (Scheibe, Familie): Wechselt die Familie, bleibt die Hülle stehen (Next hängt sie
 * bei neuen Suchparametern nicht neu ein); gezeigte Wahl und Fehler gelten dann nur für ihre Familie.
 *
 * Nach dem Speichern rechnet die Seite über `router.refresh()` neu, nicht über `revalidatePath` in der Action: Danach
 * scrollte Next zum Anker der Adresse (`#analysis`) oder an den Anfang der Seite. Bis die neue Seite da ist, bleibt die
 * gespeicherte Wahl stehen (`saved`), sonst spränge der Kreis kurz zurück.
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
  const router = useRouter()
  const [, startSaving] = useTransition()
  // gespeichert, aber die Seite noch nicht neu gerechnet; weg, sobald `value` sie zeigt oder die Familie wechselt
  const [saved, setSaved] = useState<Scoped<T> | null>(null)
  if (saved && (saved.scope !== scope || saved.value === value)) setSaved(null)
  const base = inScope(saved, scope, value)
  const [optimistic, show] = useOptimistic<Scoped<T>>({ scope, value: base })
  const [error, setError] = useState<Scoped<string | null> | null>(null)
  // ein Wechsel räumt die Meldung, auch für den Weg zurück; eine, die danach noch eintrifft, hält `inScope` fern
  const [seenScope, setSeenScope] = useState(scope)
  if (scope !== seenScope) {
    setSeenScope(scope)
    setError(null)
  }
  const shown = inScope(optimistic, scope, base)
  const change = (next: T) => {
    if (next === shown) return
    onShow?.(next)
    setError(null)
    startSaving(async () => {
      show({ scope, value: next })
      const failed = await saveChoice(save, next, notSaved)
      setError({ scope, value: failed })
      if (failed) return
      setSaved({ scope, value: next })
      router.refresh()
    })
  }
  return { shown, change, error: inScope(error, scope, null) }
}
