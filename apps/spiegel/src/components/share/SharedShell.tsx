"use client"

import { useState } from "react"

import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { HelpProvider } from "@vereinsheim/ui/design2/help-sheet"

/**
 * Rahmen einer geteilten Scheibe: ohne `AppFrame`, ohne Links und Bereiche, nur eine Kopfzeile als Text und das Blatt
 * der Hilfe, das die Seite über `useHelp` öffnet.
 */
export function SharedShell({ children }: { children: React.ReactNode }) {
  const [helpId, setHelpId] = useState<string | null>(null)
  return (
    <HelpProvider onHelp={setHelpId}>
      <header data-shared-header className="mx-auto max-w-7xl px-4 pt-4">
        <p className="text-sm text-muted-foreground">Geteilte Scheibe · Spiegel</p>
      </header>
      <main>{children}</main>
      <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
    </HelpProvider>
  )
}
