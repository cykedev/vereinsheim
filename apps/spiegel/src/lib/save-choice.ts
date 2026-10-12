import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import type { ActionResult } from "@/lib/types"

/**
 * Eine Wahl (Wertung, Art) über ihre Server Action speichern; der Fehler als Text, null wenn gespeichert. Auch ein
 * abgelehnter Aufruf (kein Netz, nach einem Deploy eine unbekannte Action) wird zur Meldung `notSaved`: aus einer
 * Transition geworfen, landete er im Error-Boundary und ersetzte die ganze Seite (Review, 12. Oktober 2026).
 */
export async function saveChoice<T>(
  save: (value: T) => Promise<ActionResult>,
  value: T,
  notSaved: string
): Promise<string | null> {
  try {
    const result = await save(value)
    return "error" in result ? (getErrorMessage(result) ?? notSaved) : null
  } catch {
    return notSaved
  }
}
