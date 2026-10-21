"use server"

import { periodPattern, type PeriodPattern } from "@vereinsheim/shot-core/analysis"
import { isCardIdInput, shooterId } from "@/lib/action-guards"
import { db } from "@/lib/db"
import { patternCardsOf } from "@/lib/db/reads"
import type { ActionResult } from "@/lib/types"

/** so viele Scheiben nimmt das Trefferbild höchstens: weit über „Alles“ eines sehr aktiven Schützen (1.564) */
const MAX_PATTERN_CARDS = 5_000

/**
 * Das Trefferbild eines Zeitraums im Fortschritt (L9, L10, L7): die Scheiben, die das Ergebnis des Zeitraums zählt,
 * gerechnet aus den gespeicherten Lagen. Erst geholt, wenn das Bild oder die Reiter Präzision und Lage es brauchen;
 * an den Browser gehen bis 3.000 Schuss die Treffer mit Band, darüber ein Raster, dazu Schwerpunkte und Urteile. Nur
 * eigene, nicht gelöschte Scheiben (auch für Admins);
 * fremde Kennungen fallen still weg. Ohne Sitzung, mit Passwort vom Admin oder mit ungültiger Eingabe ein Fehler.
 */
export async function periodPatternAction(ids: unknown): Promise<ActionResult<PeriodPattern>> {
  try {
    const ownerId = await shooterId()
    if (
      !ownerId ||
      !Array.isArray(ids) ||
      ids.length > MAX_PATTERN_CARDS ||
      !ids.every(isCardIdInput)
    )
      return { error: "Das geht gerade nicht. Lade die Seite neu." }
    return { success: true, data: periodPattern(await patternCardsOf(db, { ownerId, ids })) }
  } catch {
    return { error: "Das Trefferbild ließ sich nicht laden." }
  }
}
