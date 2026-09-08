import "server-only"

import { db } from "@/lib/db"
import type { GoalWithAssignments } from "@/lib/goals/types"
import type { SessionWithDiscipline } from "@/lib/sessions/actions/types"
import { mapGoalWithAssignments } from "@/lib/goals/actions/shared"

import { RECENT_SESSION_LIMIT, recentWindowStart, selectActiveGoals } from "./selectors"

export type DashboardData = {
  /** Die neuesten Einheiten, absteigend nach Datum. */
  recentSessions: SessionWithDiscipline[]
  /** Ziele, deren Zeitraum jetzt läuft — das am nächsten endende zuerst. */
  activeGoals: GoalWithAssignments[]
  sessionsLast30Days: number
  sessionsTotal: number
}

/**
 * Lädt genau das, was das Dashboard anzeigt.
 *
 * Bewusst nicht `getSessions()`: das lädt die vollständige Trainingshistorie
 * inklusive aller Schusswerte (gemessen: 91 KB / 30 ms bei 81 Einheiten gegen
 * 6 KB / 11 ms hier) und wirft davon fast alles weg. Da das Dashboard die
 * Seite nach dem Login ist und die Historie linear wächst, zählt die Datenbank
 * die Kennzahlen und liefert nur die Vorschauzeilen.
 */
export async function getDashboardData(userId: string, now: Date): Promise<DashboardData> {
  const [recentSessions, sessionsTotal, sessionsLast30Days, goalRows] = await Promise.all([
    db.trainingSession.findMany({
      where: { userId },
      include: {
        discipline: true,
        series: { select: { scoreTotal: true, isPractice: true, shots: true } },
        wellbeing: { select: { id: true } },
        reflection: { select: { id: true } },
        prognosis: { select: { id: true } },
        feedback: { select: { id: true } },
      },
      orderBy: { date: "desc" },
      take: RECENT_SESSION_LIMIT,
    }),
    db.trainingSession.count({ where: { userId } }),
    db.trainingSession.count({
      // Zukünftig datierte Einheiten zählen nicht zu den „letzten 30 Tagen".
      where: { userId, date: { gte: recentWindowStart(now), lte: now } },
    }),
    db.goal.findMany({
      where: { userId },
      include: {
        sessions: { select: { sessionId: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: [{ dateFrom: "asc" }, { createdAt: "asc" }],
    }),
  ])

  return {
    recentSessions,
    activeGoals: selectActiveGoals(goalRows.map(mapGoalWithAssignments), now),
    sessionsLast30Days,
    sessionsTotal,
  }
}
