"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"

import { BOX } from "./styles"

/** ein Feldfehler unter dem Feld */
export function FieldText({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

/**
 * Eine Zeile mit „+“, die etwas festlegt (Disziplin, Messung, Notiz), gebaut wie ein leerer Abschnitt eines Eintrags;
 * mit `boxed` als eigener Kasten
 */
export function PlusRow({
  name,
  title,
  hint,
  href,
  onClick,
  boxed,
}: {
  name: string
  title: string
  hint: string
  href?: string
  onClick?: () => void
  boxed?: boolean
}) {
  const plus =
    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
  return (
    <div
      data-plus-row={name}
      className={`flex items-center justify-between gap-3 ${boxed ? `${BOX} py-3` : ""}`}
    >
      <span className="grid min-w-0">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </span>
      {href ? (
        <Link href={href} aria-label={title} className={plus}>
          <Plus aria-hidden className="size-4" />
        </Link>
      ) : (
        <button type="button" aria-label={title} onClick={onClick} className={plus}>
          <Plus aria-hidden className="size-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Die klebende Leiste eines Formulars über der unteren Leiste der App: ein Fehler, „Abbrechen“ als Rückweg und der
 * Knopf zum Speichern (conventions §9: Fehler an der Leiste, nicht als Toast)
 */
export function StickySaveBar({
  error,
  back,
  onBack,
  cancel,
  save,
  pending,
  name,
}: {
  error: string | null
  back: string
  onBack: (event: MouseEvent) => void
  cancel: string
  save: ReactNode
  pending: boolean
  /** Kennzeichen des Knopfs für die Prüfung (`data-<name>-save`) */
  name: "goal" | "routine"
}) {
  return (
    <div className="sticky bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-border bg-background px-4 py-3 after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-background">
      {error && (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Link
          href={back}
          onClick={onBack}
          className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {cancel}
        </Link>
        <button
          type="submit"
          {...{ [`data-${name}-save`]: true }}
          disabled={pending}
          className="inline-flex h-11 cursor-pointer items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          {pending ? "Speichern…" : save}
        </button>
      </div>
    </div>
  )
}
