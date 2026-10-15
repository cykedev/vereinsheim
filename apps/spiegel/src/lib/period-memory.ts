import { cookies } from "next/headers"

import type { PeriodChoice } from "@vereinsheim/shot-ui/period/calendar"

import { parseRememberedChoice, PERIOD_COOKIE } from "@/lib/period-memory-cookie"

/** der zuletzt im Blatt „Filter“ übernommene Zeitraum des Fortschritts; null ohne (dann die Vorgabe) */
export async function rememberedChoice(
  named: readonly { id: string }[]
): Promise<PeriodChoice | null> {
  return parseRememberedChoice((await cookies()).get(PERIOD_COOKIE)?.value, named)
}
