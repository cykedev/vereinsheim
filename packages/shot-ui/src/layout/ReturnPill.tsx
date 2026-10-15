"use client"

/**
 * Pille „Zurück zu „Lage““: unten mittig über dem sicheren Rand des Telefons und über der
 * unteren Leiste des Rahmens (`--app-bar`), nachdem eine Aktion außerhalb der Scheibe zur Scheibe
 * gesprungen ist. Ein Tipp springt zurück, das Kreuz schließt.
 * Immer eingehängt: Der Bereich für Screenreader muss schon da sein, wenn der Sprung angesagt wird; ein
 * Bereich, der mit der Pille erst entsteht, wird oft nicht vorgelesen. Ohne `label` nur dieser Bereich, leer.
 */
export function ReturnPill({
  label,
  onReturn,
  onDismiss,
}: {
  label: string | null
  onReturn: () => void
  onDismiss: () => void
}) {
  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {label ? `Zur Scheibe gesprungen. „Zurück zu „${label}““ steht unten.` : ""}
      </div>
      {label && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(1rem+var(--app-bar,0px)+env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-card py-1 pr-1 pl-1 shadow-xl">
            <button
              type="button"
              onClick={onReturn}
              className="cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {`Zurück zu „${label}“`}
            </button>
            <button
              type="button"
              aria-label="Schließen"
              onClick={onDismiss}
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
                className="size-4"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
