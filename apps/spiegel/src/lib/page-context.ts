import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import { db } from "@/lib/db"
import { namedPeriods } from "@/lib/db/reads"
import { deviceScoring } from "@/lib/device"

/** was jede Seite über Zeiträume braucht: Anzeige-Zone, „jetzt“ (vom Server, gleich beim Hydrieren), Wertung, Zeiträume */
export interface PageContext {
  timeZone: string
  nowMs: number
  scoring: Scoring
  named: NamedPeriod[]
}

export async function pageContext(ownerId: string): Promise<PageContext> {
  const [scoring, named] = await Promise.all([deviceScoring(), namedPeriods(db, ownerId)])
  return { timeZone: getDisplayTimeZone(), nowMs: Date.now(), scoring, named }
}
