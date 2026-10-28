"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import { takeThreadQuestion } from "../actions"
import { ERRORS } from "../texts"

/**
 * Der Faden im Eintrag: die letzte Frage derselben Disziplin aus einem früheren Eintrag, oben in Vorher. Solange das
 * Vorhaben leer ist, macht „Als Vorhaben nehmen“ sie zum Vorhaben des Abends.
 */
export function ThreadHint({
  entryId,
  thread,
  dayLabel,
  canTake,
}: {
  entryId: string
  thread: { entryId: string; question: string }
  /** der Tag der Frage („Di 09.06.“) */
  dayLabel: string
  canTake: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <div data-thread-hint className="grid gap-2 rounded-2xl border border-line-strong p-4">
      <Link
        href={`/diary/${thread.entryId}`}
        className="justify-self-start text-[13px] text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {`Deine Frage vom ${dayLabel}`}
      </Link>
      <span className="text-[15px] font-semibold">{`Wie schaffe ich es, ${thread.question}`}</span>
      {canTake && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await takeThreadQuestion(entryId)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? ERRORS.failed)
                return
              }
              router.refresh()
            })
          }
          className="inline-flex h-10 cursor-pointer items-center justify-self-start rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {pending ? "Als Vorhaben nehmen…" : "Als Vorhaben nehmen"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
