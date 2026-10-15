// Zeitraum des Fortschritts gemerkt (User, 15. Oktober 2026: „letzten gewählten Zeitraum merken für die Zukunft“): als
// Cookie auf dem Gerät wie die Darstellung der Scheibe, ohne Importe aus Next, damit Server und Browser die Datei teilen.
// Der Wert hat die Form von `range` in der Adresse (`encodeChoice`).

import { decodeChoice, type ProgressQuery } from "@vereinsheim/shot-ui/nav/routes"
import type { PeriodChoice } from "@vereinsheim/shot-ui/period/calendar"

export const PERIOD_COOKIE = "spiegel-period"

/**
 * der gemerkte Zeitraum aus dem Wert des Cookies; ohne, kaputt oder ein benannter Zeitraum, den es nicht mehr gibt:
 * null (dann gilt die Vorgabe)
 */
export function parseRememberedChoice(
  value: string | undefined,
  named: readonly { id: string }[]
): PeriodChoice | null {
  const choice = decodeChoice(value ?? null, null)
  if (choice?.type === "named" && !named.some((period) => period.id === choice.id)) return null
  return choice
}

/**
 * Der Fortschritt ohne eigene Abfrage öffnet im gemerkten Zeitraum. Die Familie zählt nicht als eigene Abfrage: Die
 * Navigation hängt die zuletzt gewählte an (`areaLinks`). Ein Link mit eigener Abfrage (Start „Form“ mit Vergleich,
 * „Im Fortschritt zeigen“ mit Zeitraum, Rückweg einer Scheibe) gilt, wie er ist.
 */
export function withRememberedChoice(
  query: ProgressQuery,
  params: URLSearchParams,
  remembered: PeriodChoice | null
): ProgressQuery {
  const own = [...params.keys()].some((key) => key !== "family")
  return own || !remembered ? query : { ...query, choice: remembered }
}
