"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { cn } from "@vereinsheim/lib/utils"

import type { ActionResult } from "@/lib/types"

import { ERRORS } from "../texts"

type Outcome = "yes" | "partly" | "no"
const CHOICES: readonly [Outcome, string][] = [
  ["yes", "Ja"],
  ["partly", "Teilweise"],
  ["no", "Nein"],
]

/**
 * „Hat es geklappt?“ mit Ja, Teilweise, Nein, an einem Eintrag und an einem Ziel; speichert beim Tippen, ein Tipp auf
 * die gewählte nimmt sie zurück. `hint` steht leise darunter.
 */
export function OutcomeChoice({
  id,
  value,
  save,
  hint,
}: {
  id: string
  value: Outcome | null
  save: (outcome: Outcome | null) => Promise<ActionResult>
  hint?: string
}) {
  const router = useRouter()
  const [shown, show] = useOptimistic(value)
  const [error, setError] = useState<string | null>(null)
  const [, startSaving] = useTransition()
  return (
    <div data-outcome className="grid gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={`outcome-${id}`} className="text-sm font-semibold">
          Hat es geklappt?
        </span>
        <span role="group" aria-labelledby={`outcome-${id}`} className="flex gap-1.5">
          {CHOICES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={shown === key}
              onClick={() => {
                const next = shown === key ? null : key
                setError(null)
                startSaving(async () => {
                  show(next)
                  const result = await save(next)
                  if ("error" in result) {
                    setError(getErrorMessage(result) ?? ERRORS.failed)
                    return
                  }
                  router.refresh()
                })
              }}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-ring",
                shown === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-line-strong text-foreground-2 hover:bg-surface-2"
              )}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
