// Wann ein Liga-Spielplan (neu) generiert werden darf. Rein, damit Seite (Button sichtbar? Hinweis?) und Action
// (Abbruch) dieselbe Regel nutzen. Die Texte der Bestätigung stehen in `lib/consequences.ts`.

export interface ScheduleResultCounts {
  /** Paarungen mit Status COMPLETED */
  completed: number
  /** Paarungen mit Status WALKOVER (Kampflos-Sieg) */
  walkover: number
  /** Serien an Paarungen der Liga — auch an offenen (halb gespielte Best-of-Begegnungen) */
  series: number
  /** Playoff-Paarungen */
  playoffs: number
}

/**
 * Begründung, warum der Spielplan nicht (neu) generiert werden darf — oder `null`.
 *
 * Gesperrt, sobald irgendein Ergebnis existiert: eine Best-of-Paarung bleibt PENDING, bis alle
 * Duelle entschieden sind, und `Series.matchupId` steht auf ON DELETE SET NULL — das Löschen der
 * Paarung ließe erfasste Serien still verwaisen.
 */
export function scheduleRegenerationBlocker(c: ScheduleResultCounts): string | null {
  if (c.playoffs > 0) {
    return "Spielplan kann nicht neu generiert werden — die Playoffs wurden bereits gestartet."
  }
  const decided = c.completed + c.walkover
  if (decided > 0) {
    return `Spielplan kann nicht neu generiert werden — ${decided} Paarung(en) bereits entschieden.`
  }
  if (c.series > 0) {
    return "Spielplan kann nicht neu generiert werden — es sind bereits Ergebnisse erfasst."
  }
  return null
}
