import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import { db } from "@/lib/db"
import { namedPeriods } from "@/lib/db/reads"

/**
 * was jede Seite über Zeiträume braucht: Anzeige-Zone, „jetzt“ (vom Server, gleich beim Hydrieren), Zeiträume. Eine
 * Wertung des Geräts gibt es nicht: Jede Scheibe und jede Familie hat ihre.
 */
export interface PageContext {
  timeZone: string
  nowMs: number
  named: NamedPeriod[]
}

export async function pageContext(ownerId: string): Promise<PageContext> {
  return {
    timeZone: getDisplayTimeZone(),
    nowMs: Date.now(),
    named: await namedPeriods(db, ownerId),
  }
}
