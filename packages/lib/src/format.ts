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

/**
 * je Format und Zeitzone ein Formatter: ein `Intl.DateTimeFormat` zu bauen kostet rund 70 µs, und Listen über viele
 * Scheiben formatieren je Zeile (Spiegel, 1.564 Scheiben: 107 ms nur für den Abend jeder Scheibe, Oktober 2026)
 */
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()

function dateTimeFormat(
  options: Intl.DateTimeFormatOptions,
  timeZone: string
): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let format = dateTimeFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone })
    dateTimeFormats.set(key, format)
  }
  return format
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

/** "Di 29.09.2026" — Kopf eines Abends in der Scheiben-Liste (Spiegel); Wochentag ohne Punkt. */
export function formatWeekdayDate(date: Date, timeZone: string): string {
  const weekday = dateTimeFormat({ weekday: "short" }, timeZone).format(date).replace(/\.$/, "")
  return `${weekday} ${formatDateOnly(date, timeZone)}`
}

/** "18:30" — Uhrzeit einer Scheibe in der Scheiben-Liste (Spiegel). */
export function formatTimeOfDay(date: Date, timeZone: string): string {
  return dateTimeFormat({ hour: "2-digit", minute: "2-digit" }, timeZone).format(date)
}

/** "Sa 26.09." — Wochentag mit Tag und Monat, unter einem Monatskopf (Spiegel, Scheiben-Liste). */
export function formatWeekdayDay(date: Date, timeZone: string): string {
  const weekday = dateTimeFormat({ weekday: "short" }, timeZone).format(date).replace(/\.$/, "")
  return `${weekday} ${formatShortDay(date, timeZone)}`
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

/** "Jul" — Diagramm-Achse mit Monatsauflösung. */
export function formatMonthShort(date: Date, timeZone: string): string {
  return dateTimeFormat({ month: "short" }, timeZone).format(date)
}

/** "Juli 2026" */
export function formatMonthYear(date: Date, timeZone: string): string {
  return dateTimeFormat({ month: "long", year: "numeric" }, timeZone).format(date)
}

/** je Zeitzone ein Formatter für die Wanduhr: ein `Intl.DateTimeFormat` je Aufruf wäre teuer */
const wallClocks = new Map<string, Intl.DateTimeFormat>()

/** Versatz der Zone zu UTC in ms zum Zeitpunkt `ms` (Wanduhr der Zone minus UTC). */
function zoneOffsetMs(ms: number, timeZone: string): number {
  let clock = wallClocks.get(timeZone)
  if (!clock) {
    clock = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    wallClocks.set(timeZone, clock)
  }
  const parts = clock.formatToParts(new Date(ms))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  )
  return wall - Math.floor(ms / 1000) * 1000
}

/**
 * Beginn des Kalendertags `isoDate` ("2026-07-15") in der Zone, in ms (UTC). Der Versatz wird an der
 * gefundenen Zeit nachgeprüft, damit es auch am Tag der Zeitumstellung stimmt, wenn sie wie in Mitteleuropa
 * nachts nach Mitternacht liegt (der Tag beginnt dann noch in der Zeit davor). In Zonen, die genau um
 * Mitternacht umstellen (etwa America/Santiago), kann der Beginn an diesem Tag um die Verschiebung abweichen.
 */
export function zonedDayStartMs(isoDate: string, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) throw new RangeError(`${isoDate} ist kein Tag der Form JJJJ-MM-TT`)
  const midnightUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const first = midnightUtc - zoneOffsetMs(midnightUtc, timeZone)
  return midnightUtc - zoneOffsetMs(first, timeZone)
}

/**
 * Eine Wanduhrzeit der Zone ohne Angabe der Zone (etwa Meytons `datetime`, [[meyton-ssmdb2]]) als Zeitpunkt in ms (UTC).
 * `wallMs` sind die Felder der Wanduhr, als wären sie UTC (`Date.UTC(jahr, monat, tag, …)`). Doppelt vorhandene Zeiten
 * (Umstellung im Herbst) gelten als die frühere, ausgefallene (im Frühjahr) mit dem Versatz davor, landen also hinter der
 * Lücke: 02:30 am 29. März 2026 in Berlin ist 03:30 MESZ.
 */
export function zonedWallTimeMs(wallMs: number, timeZone: string): number {
  const before = zoneOffsetMs(wallMs - 86_400_000, timeZone)
  const after = zoneOffsetMs(wallMs + 86_400_000, timeZone)
  const fits = [wallMs - before, wallMs - after].filter(
    (candidate) => zoneOffsetMs(candidate, timeZone) === wallMs - candidate
  )
  return fits.length ? Math.min(...fits) : wallMs - before
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

const integerFormat = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 })
const numberFormat = new Intl.NumberFormat(APP_LOCALE)

/** Ganzzahl mit deutschem Tausenderpunkt: 1234 → "1.234". */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}

/**
 * Zahl mit vorhandenen Dezimalstellen: 1234.5 → "1.234,5".
 *
 * Ersetzt `value.toLocaleString()` — das formatiert in der Locale des
 * *Browsers*, sodass dieselbe Zahl je nach Systemsprache "1,234.5" oder
 * "1.234,5" anzeigt.
 */
export function formatNumber(value: number): string {
  return numberFormat.format(value)
}
