import { formatDateOnly, formatShortDate } from "@vereinsheim/lib/format"
import { formatValue } from "@vereinsheim/shot-ui/format"

/** ein Ergebnis mit Komma: in Zehnteln immer mit Zehntel, in ganzen Ringen nur, wenn eingetragen */
export function formatScore(value: number, scoringType: string): string {
  if (scoringType === "TENTH") return formatValue(value, 1)
  return formatValue(value, Number.isInteger(value) ? 0 : 1)
}

/** Datum einer Einheit in der Anzeige-Zone, lang und kurz */
export function formatDate(date: Date, timeZone: string): { full: string; short: string } {
  return { full: formatDateOnly(date, timeZone), short: formatShortDate(date, timeZone) }
}

export function buildSeriesLabel(position: number): { full: string; short: string } {
  return { full: `Serie ${position}`, short: `S${position}` }
}
