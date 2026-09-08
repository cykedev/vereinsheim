// Einzige erlaubte Rückgabestruktur für alle Server Actions.
// Kein throw aus Server Actions — immer strukturierte Rückgabe.
//
// Diskriminierte Union statt zweier optionaler Felder: ein Ergebnis ist
// entweder Erfolg oder Fehler, nie beides und nie keines von beidem
// (vault/conventions.md §6, gleiche Form wie in Ringwerk).
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[] | undefined> }
