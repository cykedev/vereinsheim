// Einzige erlaubte Rückgabestruktur für alle Server Actions.
// Kein throw aus Server Actions — immer strukturierte Rückgabe.
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[] | undefined> }
