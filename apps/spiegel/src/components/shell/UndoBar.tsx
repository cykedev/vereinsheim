"use client"

import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import type { ActionResult } from "@/lib/types"

// „Gelöscht · Rückgängig“ gleich nach einer Aktion (P2b, Plan `plans/2026-10-14-spiegel-papierkorb.md`, D6;
// [[spiegel-navigation]] Entscheidung 15). Liegt im Rahmen der App, damit der Hinweis die Navigation der Aktion
// überlebt; wiederverwendbar für die Auswahl (N4).

export interface UndoEntry {
  text: string
  undo: () => Promise<ActionResult>
  /** die Aktion navigiert gleich danach: Diese eine Navigation schließt den Hinweis nicht */
  navigating?: boolean
}

const UNDO_MS = 10_000

const UndoContext = createContext<(entry: UndoEntry) => void>(() => {})

/** zeigt den Hinweis mit „Rückgängig“ */
export const useUndo = () => useContext(UndoContext)

/** die Anzeige allein (Markup-Test); `error` ersetzt den Text, wenn das Rückgängigmachen scheiterte */
export function UndoBar({
  text,
  error,
  busy,
  onUndo,
}: {
  text: string
  error: string | null
  busy: boolean
  onUndo: () => void
}) {
  return (
    <div
      data-undo-bar
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-4 lg:pl-60"
    >
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line-strong bg-card py-1 pr-1 pl-4 text-sm shadow-lg"
      >
        <span className={error ? "text-destructive" : "text-foreground"}>{error ?? text}</span>
        {!error && (
          <button
            type="button"
            disabled={busy}
            onClick={onUndo}
            className="h-10 rounded-full px-4 font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            {busy ? "Rückgängig…" : "Rückgängig"}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Stellt `useUndo` bereit und zeigt den Hinweis: zehn Sekunden lang, oder bis der User woanders hin navigiert. Nach
 * „Rückgängig“ verschwindet er; die Action lädt die Ansichten neu.
 */
export function UndoHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [entry, setEntry] = useState<UndoEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // die Navigation der Aktion selbst schließt den Hinweis nicht
  const skipNavigation = useRef(false)
  const seenPath = useRef(pathname)

  const show = useCallback((next: UndoEntry) => {
    skipNavigation.current = next.navigating === true
    setError(null)
    setBusy(false)
    setEntry(next)
  }, [])

  useEffect(() => {
    if (pathname === seenPath.current) return
    seenPath.current = pathname
    if (skipNavigation.current) skipNavigation.current = false
    else setEntry(null)
  }, [pathname])

  useEffect(() => {
    if (!entry) return
    const timer = setTimeout(() => setEntry(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [entry])

  return (
    <UndoContext.Provider value={show}>
      {children}
      {entry && (
        <UndoBar
          text={entry.text}
          error={error}
          busy={busy}
          onUndo={async () => {
            setBusy(true)
            const result = await entry.undo()
            setBusy(false)
            if ("error" in result)
              setError(getErrorMessage(result) ?? "Das ließ sich nicht rückgängig machen.")
            else setEntry(null)
          }}
        />
      )}
    </UndoContext.Provider>
  )
}
