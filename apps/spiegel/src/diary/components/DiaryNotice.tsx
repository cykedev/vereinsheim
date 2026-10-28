"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import { markNoticeSeenAction } from "../settings-actions"
import { ERRORS, LIST_TEXTS } from "../texts"

/** der Hinweis beim ersten Öffnen ([[adr-033]] „Datenschutz des Tagebuchs“), bis „Verstanden“ */
export function DiaryNotice() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <section
      data-diary-notice
      aria-labelledby="diary-notice-title"
      className="grid gap-3 rounded-2xl border border-line-strong bg-accent-wash p-4"
    >
      <h2 id="diary-notice-title" className="font-display text-lg leading-tight font-bold">
        {LIST_TEXTS.noticeTitle}
      </h2>
      <div className="grid gap-1.5 text-sm text-foreground-2">
        {LIST_TEXTS.notice.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await markNoticeSeenAction()
            if ("error" in result) {
              setError(getErrorMessage(result) ?? ERRORS.failed)
              return
            }
            router.refresh()
          })
        }
        className="inline-flex h-10 cursor-pointer items-center justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        {LIST_TEXTS.noticeOk}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
