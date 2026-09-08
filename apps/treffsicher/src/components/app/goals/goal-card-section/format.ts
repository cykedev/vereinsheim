import { formatIsoDate } from "@vereinsheim/lib/format"

export const GOAL_TYPE_LABELS: Record<string, string> = {
  RESULT: "Ergebnisziel",
  PROCESS: "Prozessziel",
}

// `toISOString()` schneidet in UTC: ein auf 22:00 UTC gespeicherter Zielrand
// erschien im Datumsfeld einen Tag zu frueh.
export function toDateInputValue(date: Date, displayTimeZone: string): string {
  return formatIsoDate(new Date(date), displayTimeZone)
}
