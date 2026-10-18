"use client"

import { createContext, useContext, type ReactNode } from "react"

import { HelpBody, type HelpText } from "./help"
import { Sheet } from "./sheet"

export interface HelpSheetProps {
  /** die offene Erklärung; null: Blatt zu */
  entry: HelpText | null
  onClose: () => void
}

/**
 * Eine Erklärung als Blatt (auf dem Handy von unten, auf dem Desktop als Karte daneben). Das Blatt bleibt eingehängt,
 * damit der Browser den Fokus beim Schließen zurückgibt.
 */
export function HelpSheet({ entry, onClose }: HelpSheetProps) {
  return (
    <Sheet open={!!entry} title={entry?.title ?? ""} onClose={onClose}>
      {entry && <HelpBody topic={entry} />}
    </Sheet>
  )
}

const HelpContext = createContext<(helpId: string) => void>(() => {})

/** öffnet das Blatt der Hilfe zu einem Thema; das Blatt liegt einmal im Rahmen der App */
export function HelpProvider({
  onHelp,
  children,
}: {
  onHelp: (helpId: string) => void
  children: ReactNode
}) {
  return <HelpContext.Provider value={onHelp}>{children}</HelpContext.Provider>
}

export const useHelp = () => useContext(HelpContext)
