"use client"

import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

// „Gelöscht · Rückgängig“ gleich nach einer Aktion ([[spiegel-navigation]], „Löschen und Papierkorb“). Liegt im Rahmen der
// App, damit der Hinweis die Navigation der Aktion überlebt; wiederverwendbar für die Auswahl.

/** was eine Server Action zum Rückgängigmachen liefert: die Form von `ActionResult` der Apps ([[conventions]] §6) */
export type UndoResult =
  | { success: true }
  | { error: string | Record<string, string[] | undefined> }

export interface UndoEntry {
  text: string
  undo: () => Promise<UndoResult>
  /** die Aktion navigiert gleich danach: Diese eine Navigation schließt den Hinweis nicht */
  navigating?: boolean
}

const UNDO_MS = 10_000

const UndoContext = createContext<(entry: UndoEntry) => void>(() => {})

/** zeigt den Hinweis mit „Rückgängig“ */
export const useUndo = () => useContext(UndoContext)

const UNDO_FAILED = "Das ließ sich nicht rückgängig machen."

export interface UndoView {
  text: string
  /** ersetzt Text und Knopf, wenn das Rückgängigmachen scheiterte */
  error: string | null
  busy: boolean
  onUndo: () => void
}

/**
 * die Anzeige allein (Markup-Test). Die Live-Region (`role="status"`) steht immer im DOM und füllt sich nur: Eine Region,
 * die mit fertigem Text eingehängt wird, lesen Screenreader oft nicht vor.
 */
export function UndoBar({ view }: { view: UndoView | null }) {
  return (
    <div
      data-undo-bar={view ? "" : undefined}
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-4 lg:pl-56"
    >
      {view && (
        <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line-strong bg-card py-1 pr-1 pl-4 text-sm shadow-lg">
          <span className={view.error ? "text-destructive" : "text-foreground"}>
            {view.error ?? view.text}
          </span>
          {!view.error && (
            <button
              type="button"
              disabled={view.busy}
              onClick={view.onUndo}
              className="h-10 rounded-full px-4 font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {view.busy ? "Rückgängig…" : "Rückgängig"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Stellt `useUndo` bereit und zeigt den Hinweis: zehn Sekunden lang, oder bis der User woanders hin navigiert. Nach
 * „Rückgängig“ verschwindet er; die Action lädt die Ansichten neu. Während des Rückgängigmachens läuft keine Zeit ab, und
 * ein Fehler bleibt bis zur nächsten Navigation stehen.
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
    if (!entry || busy || error) return
    const timer = setTimeout(() => setEntry(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [entry, busy, error])

  const undo = async (current: UndoEntry) => {
    setBusy(true)
    try {
      const result = await current.undo()
      if ("error" in result) setError(getErrorMessage(result) ?? UNDO_FAILED)
      else setEntry(null)
    } catch {
      // eine abgebrochene Verbindung wirft statt zu antworten
      setError(UNDO_FAILED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <UndoContext.Provider value={show}>
      {children}
      <UndoBar view={entry && { text: entry.text, error, busy, onUndo: () => void undo(entry) }} />
    </UndoContext.Provider>
  )
}
