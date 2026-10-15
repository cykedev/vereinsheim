import { encodeChoice } from "@vereinsheim/shot-ui/nav/routes"
import type { PeriodChoice } from "@vereinsheim/shot-ui/period/calendar"

import { PERIOD_COOKIE } from "@/lib/period-memory-cookie"

/** den Zeitraum des Fortschritts merken (ein Jahr); geschrieben, wenn der Schütze ihn übernimmt, nie beim Öffnen */
export function rememberPeriod(choice: PeriodChoice) {
  document.cookie = `${PERIOD_COOKIE}=${encodeURIComponent(encodeChoice(choice))}; path=/; max-age=31536000; samesite=lax`
}
