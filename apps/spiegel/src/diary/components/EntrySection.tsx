"use client"

import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { clearEntrySection } from "../actions"
import { diarySectionRemove } from "../consequences"
import type { DiarySection } from "../entries"
import { ERRORS, SECTION_NAMES } from "../texts"

const BOX = "rounded-2xl border border-border bg-card p-4"

/**
 * Ein Abschnitt nach fester Regel: leer eine Zeile mit „+“, gefüllt offen. Ein Tipp auf „+“ öffnet ihn hier im
 * Browser; bleibt er leer, ist er nach dem Neuladen wieder eine Zeile. Gefüllt steht unten „{Abschnitt} leeren“ mit
 * Rückfrage.
 * Die Seite hängt nicht davon ab, was jemand bisher genutzt hat.
 */
export function EntrySection({
  entryId,
  section,
  title,
  hint,
  day,
  filled,
  children,
}: {
  entryId: string
  section: DiarySection
  title: string
  hint: string
  /** der Tag des Eintrags für die Rückfrage („Fr 13.03.“) */
  day: string
  filled: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!filled && !opened)
    return (
      <div
        data-section={section}
        data-empty
        className={`${BOX} flex items-center justify-between gap-3 py-3`}
      >
        <span className="grid min-w-0">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className="text-[13px] text-muted-foreground">{hint}</span>
        </span>
        <button
          type="button"
          aria-label={`${title} eintragen`}
          onClick={() => setOpened(true)}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    )

  return (
    <div data-section={section} className={`${BOX} grid gap-1`}>
      <span className="grid min-w-0">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      {children}
      {filled && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          {error && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => setAsking(true)}
            className="inline-flex h-10 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-semibold text-foreground-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            {pending ? `${SECTION_NAMES[section]} leeren…` : `${SECTION_NAMES[section]} leeren`}
          </button>
        </div>
      )}
      <DecisionDialog
        decision={diarySectionRemove({ name: SECTION_NAMES[section], day })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const result = await clearEntrySection(entryId, section)
            if ("error" in result) {
              setError(getErrorMessage(result) ?? ERRORS.failed)
              return
            }
            setOpened(false)
            router.refresh()
          })
        }
      />
    </div>
  )
}
