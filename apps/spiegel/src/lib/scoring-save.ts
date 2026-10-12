import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { ActionResult } from "@/lib/types"

const NOT_SAVED = "Die Wertung ließ sich nicht speichern."

/**
 * Eine Wertung über ihre Server Action speichern; der Fehler als Text, null wenn gespeichert. Auch ein abgelehnter Aufruf
 * (kein Netz, nach einem Deploy eine unbekannte Action) wird zur Meldung: aus einer Transition geworfen, landete er im
 * Error-Boundary und ersetzte die ganze Seite (Review, 12. Oktober 2026).
 */
export async function saveScoring(
  save: (scoring: Scoring) => Promise<ActionResult>,
  scoring: Scoring
): Promise<string | null> {
  try {
    const result = await save(scoring)
    return "error" in result ? (getErrorMessage(result) ?? NOT_SAVED) : null
  } catch {
    return NOT_SAVED
  }
}
