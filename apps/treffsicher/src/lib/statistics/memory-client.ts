import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { encodeChoice } from "@vereinsheim/shot-ui/nav/routes"
import type { PeriodChoice } from "@vereinsheim/shot-ui/period/calendar"

import {
  parseScorings,
  PERIOD_COOKIE,
  SCORING_COOKIE,
  serializeScorings,
} from "@/lib/statistics/memory"

const YEAR = 31_536_000

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`
}

const readCookie = (name: string) =>
  document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/** den Zeitraum der Statistik merken (ein Jahr); geschrieben, wenn er übernommen wird, nie beim Öffnen */
export function rememberPeriod(choice: PeriodChoice) {
  setCookie(PERIOD_COOKIE, encodeChoice(choice))
}

/** die Wertung einer Disziplin merken (ein Jahr) */
export function rememberScoring(disciplineId: string, scoring: Scoring) {
  const stored = readCookie(SCORING_COOKIE)
  const scorings = parseScorings(stored === undefined ? undefined : decodeURIComponent(stored))
  setCookie(SCORING_COOKIE, serializeScorings({ ...scorings, [disciplineId]: scoring }))
}
