"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"

import { cn } from "@vereinsheim/lib/utils"

interface SheetProps {
  open: boolean
  /** Schließen über den Knopf, Escape oder einen Tipp neben das Blatt */
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

/**
 * Blatt (Design 2) auf dem nativen `<dialog>`: Fokus, Escape und die Rückkehr des Fokus übernimmt der
 * Browser. Auf dem Handy kommt es von unten, ab 768 px steht es als Karte am rechten Rand. Für Erklärungen
 * und Details, die nie nur als Tooltip erscheinen sollen (spiegel-ui-design „Hilfe und Erklärungen“).
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  // ob der Zustand das Blatt offen will: ein „close“, das unser eigenes Schließen nachmeldet, zählt nicht
  const wantsOpen = useRef(open)
  const titleId = useId()
  useEffect(() => {
    wantsOpen.current = open
    const node = dialog.current
    if (!node) return
    if (open && !node.open) node.showModal()
    if (!open && node.open) node.close()
  }, [open])
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Escape kommt als „cancel“, synchron; das „close“ danach kommt später (im Headless-Chrome der
      // Prüfung gar nicht). Darum schließt der Zustand das Blatt, nicht der Browser.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // „close“ meldet nur, was der Browser selbst geschlossen hat (etwa Escape ohne „cancel“): nicht unser
      // eigenes Schließen noch einmal (onClose genau einmal) und nicht ein spätes, wenn es schon wieder offen ist
      onClose={(event) => {
        if (!event.currentTarget.open && wantsOpen.current) onClose()
      }}
      // ein Tipp auf den Hintergrund trifft das <dialog> selbst, nicht seinen Inhalt
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        "overflow-y-auto border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-scrim",
        "max-md:mx-0 max-md:mt-auto max-md:mb-0 max-md:max-h-[85dvh] max-md:w-full max-md:max-w-none max-md:rounded-t-2xl",
        "md:my-4 md:mr-4 md:ml-auto md:max-h-[calc(100dvh-2rem)] md:w-[26rem] md:rounded-2xl",
        className
      )}
    >
      <div className="grid gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg leading-tight font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="-mt-2 -mr-2 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
