import type { GoalWithAssignments } from "@/lib/goals/types"

const ACTIVE_GOAL_LIMIT = 3
const RECENT_WINDOW_DAYS = 30

/** Anzahl der Einheiten, die das Dashboard als Vorschau zeigt. */
export const RECENT_SESSION_LIMIT = 5

/**
 * Beginn des „letzte 30 Tage"-Fensters. Eigene Funktion, damit die Grenze
 * testbar bleibt — sie geht als `where`-Bedingung in die Zählung ein.
 */
export function recentWindowStart(now: Date): Date {
  const start = new Date(now)
  start.setDate(start.getDate() - RECENT_WINDOW_DAYS)
  return start
}

/**
 * Ziele, deren Zeitraum jetzt läuft — das am nächsten endende zuerst, maximal
 * drei. Grenzen sind inklusiv: ein Ziel gilt an seinem ersten und an seinem
 * letzten Tag als laufend.
 *
 * `now` wird übergeben statt intern gelesen, damit die Grenzen prüfbar sind.
 */
export function selectActiveGoals(goals: GoalWithAssignments[], now: Date): GoalWithAssignments[] {
  const nowMs = now.getTime()
  return goals
    .filter((goal) => {
      const from = new Date(goal.dateFrom).getTime()
      const to = new Date(goal.dateTo).getTime()
      return from <= nowMs && nowMs <= to
    })
    .sort((a, b) => new Date(a.dateTo).getTime() - new Date(b.dateTo).getTime())
    .slice(0, ACTIVE_GOAL_LIMIT)
}
