"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { cn } from "@vereinsheim/lib/utils"

import type { ActionResult } from "@/lib/types"

import { ERRORS } from "../texts"

/**
 * Ein Text im Eintrag, direkt bearbeitbar und gesteuert (`value` + `onChange`, conventions §9). Ist etwas geändert,
 * stehen „Speichern“ und „Verwerfen“ darunter; `onDirty` meldet das der Seite für den Wächter beim Verlassen.
 */
export function EntryText({
  name,
  label,
  placeholder,
  value: saved,
  rows = 2,
  save,
  savedText,
  onDirty,
  className,
  inputMode,
}: {
  /** Kennzeichen für Prüfung und Wächter (`data-entry-text`) */
  name: string
  /** sichtbare Überschrift; ohne nur für Screenreader der Platzhalter */
  label?: string
  placeholder: string
  value: string | null
  rows?: number
  save: (value: string) => Promise<ActionResult>
  /** der Toast nach dem Speichern */
  savedText: string
  onDirty: (name: string, dirty: boolean) => void
  className?: string
  inputMode?: "decimal"
}) {
  const router = useRouter()
  const id = useId()
  const [text, setText] = useState(saved ?? "")
  const [base, setBase] = useState(saved ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // ein neuer Stand vom Server gilt, solange hier nichts geändert ist
  if ((saved ?? "") !== base && text === base) {
    setBase(saved ?? "")
    setText(saved ?? "")
  }
  const dirty = text !== base
  useEffect(() => onDirty(name, dirty), [name, dirty, onDirty])

  const field = cn(
    "w-full rounded-xl border bg-background px-3 py-2 text-[15px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    dirty ? "border-ring" : "border-border"
  )
  return (
    <div data-entry-text={name} className={cn("grid gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
      ) : null}
      {inputMode ? (
        <input
          id={id}
          value={text}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          className={cn(field, "h-9 w-24 py-1 tabular-nums")}
        />
      ) : (
        <textarea
          id={id}
          value={text}
          rows={rows}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          className={cn(field, "field-sizing-content resize-none")}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {dirty && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                const result = await save(text)
                if ("error" in result) {
                  setError(getErrorMessage(result) ?? ERRORS.failed)
                  return
                }
                setBase(text)
                toast.success(savedText)
                router.refresh()
              })
            }
            className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            {pending ? "Speichern…" : "Speichern"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setText(base)
              setError(null)
            }}
            className="inline-flex h-10 cursor-pointer items-center rounded-md px-4 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
          >
            Verwerfen
          </button>
        </div>
      )}
    </div>
  )
}
