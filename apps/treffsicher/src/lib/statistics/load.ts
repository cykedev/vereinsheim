import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { db } from "@/lib/db"
import { getHiddenDisciplineIds } from "@/lib/disciplines/actions"
import { statisticsPage, type StatisticsPage } from "@/lib/statistics/page"
import { statisticsSessions } from "@/lib/statistics/sessions"

/**
 * Die Statistik eines Kontos zur Abfrage der Adresse, gerechnet auf dem Server mit „jetzt“ und der Anzeige-Zeitzone;
 * null ohne Einheit mit Ergebnis.
 */
export async function loadStatisticsPage(
  userId: string,
  search: URLSearchParams
): Promise<{ page: StatisticsPage | null; timeZone: string }> {
  const [sessions, hidden] = await Promise.all([
    statisticsSessions(db, userId),
    getHiddenDisciplineIds(),
  ])
  const timeZone = getDisplayTimeZone()
  return {
    page: statisticsPage({ sessions, search, hidden, nowMs: Date.now(), timeZone }),
    timeZone,
  }
}
