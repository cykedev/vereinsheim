// Geteilte Anzeige-Formatierung für beide Apps.
//
// Bewusst OHNE `server-only`: die Formatter werden auch in Client-Komponenten und
// Chart-Hooks gebraucht. Die Anzeige-Zeitzone kommt deshalb immer als Parameter
// herein (auf dem Server aus `getDisplayTimeZone()` in `./dateTime`, das die
// Env-Variable liest und `server-only` bleibt).
//
// Regel (vault/conventions.md §6): kein inline `new Intl.…` in Seiten oder
// Komponenten — jedes benötigte Format bekommt hier eine Funktion.

/** Eine Locale für beide Apps. Zeitzonen-Default ist Europe/Berlin (siehe ./dateTime). */
export const APP_LOCALE = "de-DE"

function dateTimeFormat(
  options: Intl.DateTimeFormatOptions,
  timeZone: string
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone })
}

/** "08.09.2026" */
export function formatDateOnly(date: Date, timeZone: string): string {
  return dateTimeFormat({ day: "2-digit", month: "2-digit", year: "numeric" }, timeZone).format(
    date
  )
}

/** "08.09.2026, 14:05" */
export function formatDateTime(date: Date, timeZone: string): string {
  return dateTimeFormat(
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
    timeZone
  ).format(date)
}

/** "08.09.2026, 14:05:09" — für Protokolle und Rate-Limit-Fenster. */
export function formatDateTimeSeconds(date: Date, timeZone: string): string {
  return dateTimeFormat(
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
    timeZone
  ).format(date)
}

/** "Mittwoch, 9. September 2026, 00:30" — Kopf einer Detailseite. */
export function formatLongDateTime(date: Date, timeZone: string): string {
  return dateTimeFormat(
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    timeZone
  ).format(date)
}

/** "09.09." — Diagramm-Achse mit Tagesauflösung. */
export function formatShortDay(date: Date, timeZone: string): string {
  return dateTimeFormat({ day: "2-digit", month: "2-digit" }, timeZone).format(date)
}

/** "08.09.26" — Diagramm-Achse mit Tagesauflösung, kurzes Jahr. */
export function formatShortDate(date: Date, timeZone: string): string {
  return dateTimeFormat({ day: "2-digit", month: "2-digit", year: "2-digit" }, timeZone).format(
    date
  )
}

/**
 * "09.26" — Diagramm-Achse mit Monatsauflösung.
 *
 * Aus Teilen zusammengesetzt statt direkt formatiert: `de-DE` setzt bei
 * Monat+Jahr einen Schrägstrich ("09/26"), `de-CH` einen Punkt. Die Achse soll
 * unabhängig von der Locale wie das Tagesformat aussehen.
 */
export function formatCompactMonthYear(date: Date, timeZone: string): string {
  const parts = dateTimeFormat({ month: "2-digit", year: "2-digit" }, timeZone).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  return `${part("month")}.${part("year")}`
}

/** "2026-09-09" — sortierbar, für Dateinamen. */
export function formatIsoDate(date: Date, timeZone: string): string {
  const parts = dateTimeFormat(
    { year: "numeric", month: "2-digit", day: "2-digit" },
    timeZone
  ).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

/** Ganzzahl mit deutschem Tausenderpunkt: 1234 → "1.234". */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 }).format(value)
}

/**
 * Zahl mit vorhandenen Dezimalstellen: 1234.5 → "1.234,5".
 *
 * Ersetzt `value.toLocaleString()` — das formatiert in der Locale des
 * *Browsers*, sodass dieselbe Zahl je nach Systemsprache "1,234.5" oder
 * "1.234,5" anzeigt.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE).format(value)
}
