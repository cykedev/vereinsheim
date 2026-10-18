"use client"

import { HelpSheet as Sheet } from "@vereinsheim/ui/design2/help-sheet"

import { helpEntry } from "./HelpDetails"

export interface HelpSheetProps {
  /** Erklärung, die offen ist: Thema (`helpTopic`, für Kennzahlen über `helpForMetric(key).id`) oder
   * Oberfläche (`VIEW_HELP`); null: Blatt zu */
  helpId: string | null
  onClose: () => void
}

/**
 * Eine Erklärung aus `shot-help` als Blatt, für Kacheln, Karten der Analyse und die Scheibe; das Blatt selbst ist der
 * Baustein aus Design 2.
 */
export function HelpSheet({ helpId, onClose }: HelpSheetProps) {
  return <Sheet entry={helpId ? helpEntry(helpId) : null} onClose={onClose} />
}
