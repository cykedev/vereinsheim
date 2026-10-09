// Adressen von Spiegel (Plan N1, `vault/spiegel/spiegel-navigation.md`): reine Funktionen von der Adresse zum
// Zustand und zurück. Pfade und Schlüssel englisch, Anker deutsch; Vorgaben fallen weg, Ungültiges gilt als
// Vorgabe, nie ein Fehler (D2). Im Artifact kommt nur ein einfacher Anker an, das Labor zeigt die Adresse nur.

import type { CompareChoice, PeriodChoice } from "../period/calendar"

/** Id eines benannten Zeitraums, einer Familie oder eines Merkmals: klein, Ziffern, Bindestriche */
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** ein echter Kalendertag im Format JJJJ-MM-TT (kein 30. Februar) */
function isDay(text: string): boolean {
  const match = ISO_DAY.exec(text)
  if (!match) return false
  const [y, m, d] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

const ROLLING_CODES: readonly [30 | 90 | 365, string][] = [
  [30, "30d"],
  [90, "90d"],
  [365, "12m"],
]

/** ein Zeitraum als Wert von `range`: `30d`, `90d`, `12m`, `all`, `JJJJ-MM-TT..JJJJ-MM-TT` oder die Id */
export function encodeChoice(choice: PeriodChoice): string {
  switch (choice.type) {
    case "rolling":
      return ROLLING_CODES.find(([days]) => days === choice.days)?.[1] ?? "90d"
    case "all":
      return "all"
    case "free":
      return `${choice.from}..${choice.to}`
    case "named":
      return choice.id
  }
}

/** Wert von `range` als Zeitraum; die festen Werte gehen vor, Ungültiges ergibt `fallback` */
export function decodeChoice<F extends PeriodChoice | null>(
  value: string | null,
  fallback: F
): PeriodChoice | F {
  if (!value) return fallback
  const rolling = ROLLING_CODES.find(([, code]) => code === value)
  if (rolling) return { type: "rolling", days: rolling[0] }
  if (value === "all") return { type: "all" }
  const parts = value.split("..")
  if (parts.length === 2) {
    const [from, to] = parts
    return isDay(from) && isDay(to) && from <= to ? { type: "free", from, to } : fallback
  }
  return SLUG.test(value) ? { type: "named", id: value } : fallback
}

/** der Vergleich als Wert von `compare`; ohne Vergleich kein Schlüssel */
export function encodeCompare(compare: CompareChoice): string | null {
  return compare.type === "none" ? null : compare.type === "previous" ? "previous" : compare.id
}

export function decodeCompare(value: string | null): CompareChoice {
  if (value === "previous") return { type: "previous" }
  return value && SLUG.test(value) ? { type: "named", id: value } : { type: "none" }
}
