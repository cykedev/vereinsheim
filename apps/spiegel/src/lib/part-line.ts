import type { ActionResult } from "@/lib/types"

/**
 * Eine Zeile, die ein anderer Teil der App an eine Stelle des Ergebnisteils setzt (das Tagebuch, [[adr-033]]): Titel,
 * Zustand, Ziel und das Wort der Aktion. Der Ergebnisteil zeigt sie, ohne zu wissen, woher sie kommt.
 */
export interface PartLine {
  key: string
  title: string
  state: string
  href: string
  action: string
  /**
   * statt des Links eine Server Action, die etwas anlegt und das Ziel nennt (mit Toast danach); `href` bleibt der Weg
   * ohne Skript
   */
  run?: () => Promise<ActionResult<{ href: string; toast?: string }>>
}
