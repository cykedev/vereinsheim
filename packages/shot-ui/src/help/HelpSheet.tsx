"use client"

import { Sheet } from "@vereinsheim/ui/design2/sheet"

import { HelpBody } from "./HelpBody"
import { helpEntry } from "./HelpDetails"

export interface HelpSheetProps {
  /** Erklärung, die offen ist: Thema (`helpTopic`, für Kennzahlen über `helpForMetric(key).id`) oder
   * Oberfläche (`VIEW_HELP`); null: Blatt zu */
  helpId: string | null
  onClose: () => void
}

/**
 * Eine Erklärung als Blatt (spiegel-ui-design: auf dem Handy von unten, auf dem Desktop als Karte daneben),
 * für Kacheln, Karten der Analyse und die Scheibe. Das Blatt bleibt eingehängt, damit der
 * Browser den Fokus beim Schließen zurückgibt.
 */
export function HelpSheet({ helpId, onClose }: HelpSheetProps) {
  const entry = helpId ? helpEntry(helpId) : undefined
  return (
    <Sheet open={!!entry} title={entry?.title ?? ""} onClose={onClose}>
      {entry && <HelpBody topic={entry} />}
    </Sheet>
  )
}
