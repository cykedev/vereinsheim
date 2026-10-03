// Wann ein Liga-Spielplan (neu) generiert werden darf — und wie die Bestätigung es beschreibt.
// Rein, damit Seite (Button sichtbar? Hinweis?) und Action (Abbruch) dieselbe Regel nutzen.

import type { LeagueFormat } from "@/generated/prisma/client"

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
    return "Spielplan kann nicht neu generiert werden — die Playoffs laufen bereits."
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

/** Texte des Bestätigungsdialogs für „Spielplan (neu) generieren“. */
export function scheduleDialogText(input: { hasSchedule: boolean; leagueFormat: LeagueFormat }): {
  title: string
  description: string
  confirmLabel: string
} {
  if (input.hasSchedule) {
    return {
      title: "Spielplan neu generieren?",
      description:
        "Der bestehende Spielplan wird gelöscht und neu erstellt. Spieltage und Gegner ändern sich dabei. Bereits verteilte oder ausgedruckte Spielpläne sind danach veraltet.",
      confirmLabel: "Neu generieren",
    }
  }
  return {
    title: "Spielplan generieren?",
    description:
      input.leagueFormat === "BEST_OF_SINGLE"
        ? "Es wird ein Spielplan „Jeder gegen jeden“ (eine Runde) für alle aktiven Teilnehmer generiert."
        : "Es wird ein Doppelrunden-Spielplan (Hin- und Rückrunde) für alle aktiven Teilnehmer generiert.",
    confirmLabel: "Generieren",
  }
}
