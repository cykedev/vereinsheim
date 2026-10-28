"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import type { ActionResult } from "@/lib/types"

import { valueOfStage, type Stage } from "../scales"
import { ERRORS } from "../texts"

/**
 * Stufen speichern beim Tippen, wie Art und Wertung an der Scheibe: gezeigt sofort, gespeichert über `save`, ein Fehler
 * als Text am Abschnitt, danach die Seite neu (`router.refresh()`). Schlüssel je Zeile (Aspekt oder Serie).
 */
export function useStages(
  values: Readonly<Record<string, number | null>>,
  save: (key: string, stage: Stage | null) => Promise<ActionResult>
): {
  shown: Readonly<Record<string, number | null>>
  select: (key: string, stage: Stage | null) => void
  error: string | null
} {
  const router = useRouter()
  const [, startSaving] = useTransition()
  const [shown, show] = useOptimistic(
    values,
    (current, change: { key: string; value: number | null }) => ({
      ...current,
      [change.key]: change.value,
    })
  )
  const [error, setError] = useState<string | null>(null)
  const select = (key: string, stage: Stage | null) => {
    setError(null)
    startSaving(async () => {
      show({ key, value: stage === null ? null : valueOfStage(stage) })
      const result = await save(key, stage)
      if ("error" in result) {
        setError(getErrorMessage(result) ?? ERRORS.failed)
        return
      }
      router.refresh()
    })
  }
  return { shown, select, error }
}
