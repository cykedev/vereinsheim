import type { GoalWithAssignments } from "@/lib/goals/types"
import type { SessionWithDiscipline } from "@/lib/sessions/actions/types"

const RECENT_SESSION_LIMIT = 5
const ACTIVE_GOAL_LIMIT = 3
const RECENT_WINDOW_DAYS = 30

export type DashboardData = {
  /** Die neuesten Einheiten, absteigend nach Datum. */
  recentSessions: SessionWithDiscipline[]
  /** Ziele, deren Zeitraum jetzt läuft — das am nächsten endende zuerst. */
  activeGoals: GoalWithAssignments[]
  sessionsLast30Days: number
  sessionsTotal: number
}

/**
 * Wählt aus, was das Dashboard zeigt. Reine Funktion: die Seite lädt die
 * vollständigen Listen (die sie ohnehin abfragt) und filtert hier im Speicher,
 * damit die Auswahlregeln testbar bleiben.
 *
 * `now` wird übergeben statt intern gelesen, damit die Fenstergrenzen prüfbar sind.
 */
export function selectDashboardData(
  sessions: SessionWithDiscipline[],
  goals: GoalWithAssignments[],
  now: Date
): DashboardData {
  const byDateDesc = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const windowStart = new Date(now)
  windowStart.setDate(windowStart.getDate() - RECENT_WINDOW_DAYS)

  const sessionsLast30Days = sessions.filter((session) => {
    const date = new Date(session.date).getTime()
    // Zukünftige Einheiten liegen nicht in den "letzten 30 Tagen".
    return date >= windowStart.getTime() && date <= now.getTime()
  }).length

  const nowMs = now.getTime()
  const activeGoals = goals
    .filter((goal) => {
      const from = new Date(goal.dateFrom).getTime()
      const to = new Date(goal.dateTo).getTime()
      return from <= nowMs && nowMs <= to
    })
    .sort((a, b) => new Date(a.dateTo).getTime() - new Date(b.dateTo).getTime())
    .slice(0, ACTIVE_GOAL_LIMIT)

  return {
    recentSessions: byDateDesc.slice(0, RECENT_SESSION_LIMIT),
    activeGoals,
    sessionsLast30Days,
    sessionsTotal: sessions.length,
  }
}
