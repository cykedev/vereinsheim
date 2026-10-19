// Was die Statistik auf dem Gerät merkt, wie Spiegels Fortschritt: den im Blatt „Filter“ übernommenen Zeitraum und je
// Disziplin die Wertung (Zehntel oder ganze Ringe). Beides als Cookie, ohne Importe aus Next, damit Server und Browser
// die Datei teilen. Der Zeitraum hat die Form von `range` in der Adresse (`encodeChoice`).

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { decodeChoice, type ProgressQuery } from "@vereinsheim/shot-ui/nav/routes"
import type { PeriodChoice } from "@vereinsheim/shot-ui/period/calendar"

export const PERIOD_COOKIE = "treffsicher-period"
export const SCORING_COOKIE = "treffsicher-scoring"

/**
 * Id einer Disziplin im Cookie: erzeugte Ids und die der Standarddisziplinen (mit Bindestrich), wie `family` in der
 * Adresse
 */
const DISCIPLINE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

/** der gemerkte Zeitraum aus dem Wert des Cookies; ohne oder kaputt null (dann gilt die Vorgabe) */
export function parseRememberedChoice(value: string | undefined): PeriodChoice | null {
  const choice = decodeChoice(value ?? null, null)
  // benannte Zeiträume kennt Treffsicher nicht
  return choice?.type === "named" ? null : choice
}

/**
 * Die Statistik ohne eigene Abfrage öffnet im gemerkten Zeitraum. Die Disziplin zählt nicht als eigene Abfrage. Ein
 * Link mit eigener Abfrage gilt, wie er ist.
 */
export function withRememberedChoice(
  query: ProgressQuery,
  params: URLSearchParams,
  remembered: PeriodChoice | null
): ProgressQuery {
  const own = [...params.keys()].some((key) => key !== "family")
  return own || !remembered ? query : { ...query, choice: remembered }
}

/** der Wert, wie der Browser ihn schreibt (`encodeURIComponent`); kaputt wie leer */
function decoded(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return ""
  }
}

/** die gemerkten Wertungen je Disziplin aus „id:rings,id:decimal“; Kaputtes fällt weg */
export function parseScorings(value: string | undefined): Record<string, Scoring> {
  const scorings: Record<string, Scoring> = {}
  for (const part of decoded(value ?? "").split(",")) {
    const [id, scoring] = part.split(":")
    if (DISCIPLINE_ID.test(id ?? "") && (scoring === "rings" || scoring === "decimal"))
      scorings[id] = scoring
  }
  return scorings
}

/** die Wertungen je Disziplin als Wert des Cookies; die Vorgabe Zehntel braucht keinen Eintrag */
export function serializeScorings(scorings: Readonly<Record<string, Scoring>>): string {
  return Object.entries(scorings)
    .filter(([id, scoring]) => DISCIPLINE_ID.test(id) && scoring === "rings")
    .map(([id, scoring]) => `${id}:${scoring}`)
    .join(",")
}
