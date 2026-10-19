import { cookies } from "next/headers"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { db } from "@/lib/db"
import { getHiddenDisciplineIds } from "@/lib/disciplines/actions"
import {
  parseRememberedChoice,
  parseScorings,
  PERIOD_COOKIE,
  SCORING_COOKIE,
} from "@/lib/statistics/memory"
import { statisticsPage, type StatisticsPage } from "@/lib/statistics/page"
import { statisticsSessions } from "@/lib/statistics/sessions"

/**
 * Die Statistik eines Kontos zur Abfrage der Adresse und dem auf dem Gerät Gemerkten (Cookies), gerechnet auf dem
 * Server mit „jetzt“ und der Anzeige-Zeitzone; null ohne Einheit mit Ergebnis.
 */
export async function loadStatisticsPage(
  userId: string,
  search: URLSearchParams
): Promise<{ page: StatisticsPage | null; timeZone: string }> {
  const [sessions, hidden, jar] = await Promise.all([
    statisticsSessions(db, userId),
    getHiddenDisciplineIds(),
    cookies(),
  ])
  const memory = {
    choice: parseRememberedChoice(jar.get(PERIOD_COOKIE)?.value),
    scorings: parseScorings(jar.get(SCORING_COOKIE)?.value),
  }
  const timeZone = getDisplayTimeZone()
  return {
    page: statisticsPage({ sessions, search, hidden, memory, nowMs: Date.now(), timeZone }),
    timeZone,
  }
}
