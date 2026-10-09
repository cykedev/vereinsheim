// Zeiträume der Seite eines Zeitraums (Plan L3, D4, D6, D15, D16): rollend, alles, benannt, frei; der
// Vergleichszeitraum; ISO-Wochen ohne `Intl`. Tage beginnen in der Anzeige-Zeitzone (`zonedDayStartMs`).

import { formatDateOnly, formatShortDay, zonedDayStartMs } from "@vereinsheim/lib/format"

export const DAY_MS = 86_400_000

export type PeriodChoice =
  | { type: "rolling"; days: 30 | 90 | 365 }
  | { type: "all" }
  | { type: "named"; id: string }
  /** ISO-Tage („2026-07-01“), beide eingeschlossen */
  | { type: "free"; from: string; to: string }

export type CompareChoice = { type: "none" } | { type: "previous" } | { type: "named"; id: string }

/** ein benannter Zeitraum des Schützen; ohne Ende läuft er noch */
export interface NamedPeriod {
  id: string
  name: string
  from: string
  to: string | null
}

/** von `fromMs` (eingeschlossen) bis `toMs` (ausgeschlossen) */
export interface DateRange {
  fromMs: number
  toMs: number
  label: string
}

export const DEFAULT_CHOICE: PeriodChoice = { type: "rolling", days: 90 }

/** Name des gleich langen Zeitraums direkt davor */
export const PREVIOUS_LABEL = "Zeitraum davor"

export const ROLLING_CHOICES: readonly { choice: PeriodChoice; label: string }[] = [
  { choice: { type: "rolling", days: 30 }, label: "Letzte 30 Tage" },
  { choice: { type: "rolling", days: 90 }, label: "Letzte 90 Tage" },
  { choice: { type: "rolling", days: 365 }, label: "Letzte 12 Monate" },
  { choice: { type: "all" }, label: "Alles" },
]

interface Context {
  nowMs: number
  timeZone: string
  named: readonly NamedPeriod[]
}

/** vom Beginn des Tags `from` bis zum Beginn des Tags nach `to`; ohne `to` bis jetzt */
function dayRange(from: string, to: string | null, context: Context, label: string): DateRange {
  return {
    fromMs: zonedDayStartMs(from, context.timeZone),
    // nicht „+ 24 h“: ein Tag mit Zeitumstellung ist 23 oder 25 Stunden lang
    toMs: to === null ? context.nowMs + 1 : nextDayStart(to, context.timeZone),
    label,
  }
}

/** Beginn des Tags nach `isoDate` in der Zone, auch über eine Zeitumstellung */
function nextDayStart(isoDate: string, timeZone: string): number {
  const [y, m, d] = isoDate.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const iso = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`
  return zonedDayStartMs(iso, timeZone)
}

const labelOf = (choice: PeriodChoice) =>
  ROLLING_CHOICES.find((c) => JSON.stringify(c.choice) === JSON.stringify(choice))?.label ?? ""

/**
 * Der Zeitraum einer Wahl (D4): rollend heißt Beginn nach `now − N Tage` bis jetzt, „Alles“ ab der ersten
 * Scheibe (`firstMs`), frei und benannt vom Beginn des ersten bis zum Ende des letzten Tags in der Zeitzone;
 * ein benannter Zeitraum ohne Ende läuft bis jetzt. Ein unbekannter benannter Zeitraum gilt als 90 Tage.
 */
export function resolveRange(
  choice: PeriodChoice,
  context: Context & { firstMs: number | null }
): DateRange {
  const { nowMs } = context
  if (choice.type === "rolling") {
    return { fromMs: nowMs - choice.days * DAY_MS, toMs: nowMs + 1, label: labelOf(choice) }
  }
  if (choice.type === "all") {
    return { fromMs: context.firstMs ?? nowMs, toMs: nowMs + 1, label: "Alles" }
  }
  if (choice.type === "free") {
    const day = (iso: string) =>
      formatDateOnly(new Date(zonedDayStartMs(iso, context.timeZone)), context.timeZone)
    return dayRange(choice.from, choice.to, context, `${day(choice.from)} – ${day(choice.to)}`)
  }
  const named = context.named.find((p) => p.id === choice.id)
  if (!named) return resolveRange(DEFAULT_CHOICE, context)
  return dayRange(named.from, named.to, context, named.name)
}

/**
 * Der Vergleichszeitraum (D6): „Zeitraum davor“ ist gleich lang und endet am Beginn des Zeitraums; ein
 * benannter wie oben. Ohne Vergleich oder mit unbekanntem Namen null.
 */
export function compareRange(
  compare: CompareChoice,
  range: DateRange,
  context: Context
): DateRange | null {
  if (compare.type === "none") return null
  if (compare.type === "previous") {
    const length = range.toMs - range.fromMs
    return { fromMs: range.fromMs - length, toMs: range.fromMs, label: PREVIOUS_LABEL }
  }
  const named = context.named.find((p) => p.id === compare.id)
  return named ? dayRange(named.from, named.to, context, named.name) : null
}

/** liegt der Zeitpunkt im Zeitraum? Anfang eingeschlossen, Ende nicht */
export const inRange = (atMs: number, range: DateRange) => atMs >= range.fromMs && atMs < range.toMs

/**
 * ISO-Woche eines Tags („2026-W29“): Montag bis Sonntag, Woche 1 ist die mit dem ersten Donnerstag des Jahres;
 * das Jahr ist das des Donnerstags der Woche. Ohne `Intl`, den Tag liefert der Aufrufer in seiner Zeitzone.
 */
export function isoWeekKey(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const day = Date.UTC(y, m - 1, d)
  const weekday = ((new Date(day).getUTCDay() + 6) % 7) + 1
  const thursday = new Date(day + (4 - weekday) * DAY_MS)
  const year = thursday.getUTCFullYear()
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY_MS))
  return `${year}-W${String(week).padStart(2, "0")}`
}

/** Montag einer ISO-Woche („2026-W27“ → „2026-06-29“): Der 4. Januar liegt immer in Woche 1 */
export function weekStartIso(key: string): string {
  const year = Number(key.slice(0, 4))
  const week = Number(key.slice(6))
  const jan4 = Date.UTC(year, 0, 4)
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS + (week - 1) * 7 * DAY_MS
  return new Date(monday).toISOString().slice(0, 10)
}

/** Name einer Woche ist ihr Montag („29.06.“), keine Kalenderwoche (U3, D6) */
export function weekLabel(key: string): string {
  const [y, m, d] = weekStartIso(key).split("-").map(Number)
  // ein Kalendertag ohne Zone: Mittag in UTC, in UTC formatiert
  return formatShortDay(new Date(Date.UTC(y, m - 1, d, 12)), "UTC")
}

/** „02.07.2026 – 30.09.2026“: erster und letzter Tag des Zeitraums in der Zeitzone */
export function rangeDays(range: DateRange, timeZone: string): string {
  const day = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  return `${day(range.fromMs)} – ${day(range.toMs - 1)}`
}
