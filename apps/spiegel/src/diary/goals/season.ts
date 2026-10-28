// Zeiträume eines Ziels: die Saison vom 1. September bis 31. August und wo ein Ziel heute steht. Reine Funktionen auf
// ISO-Tagen („2026-09-01“), ohne Zeitzone: Welcher Tag heute ist, sagt der Aufrufer.

export interface Season {
  /** ISO-Tag, eingeschlossen */
  from: string
  /** ISO-Tag, eingeschlossen */
  to: string
  /** „Saison 26/27“ */
  label: string
}

const twoDigits = (year: number) => String(year % 100).padStart(2, "0")

const seasonStarting = (year: number): Season => ({
  from: `${year}-09-01`,
  to: `${year + 1}-08-31`,
  label: `Saison ${twoDigits(year)}/${twoDigits(year + 1)}`,
})

/** die Saison, in der ein Tag liegt: ab dem 1. September die neue */
export function seasonOf(day: string): Season {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  return seasonStarting(month >= 9 ? year : year - 1)
}

/** die Saison nach der, in der ein Tag liegt */
export function nextSeason(day: string): Season {
  return seasonStarting(Number(seasonOf(day).from.slice(0, 4)) + 1)
}

export type GoalPhase =
  { phase: "upcoming" } | { phase: "running"; months: number } | { phase: "past" }

const DAY_MS = 86_400_000
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)

/**
 * Wo ein Ziel heute steht: vor dem Beginn, läuft (mit den Monaten bis zum Ende, aufgerundet, mindestens einer) oder
 * vorbei. Erster und letzter Tag gehören dazu.
 */
export function goalPhase(goal: { from: string; to: string }, today: string): GoalPhase {
  if (today < goal.from) return { phase: "upcoming" }
  if (today > goal.to) return { phase: "past" }
  const daysLeft = (dayMs(goal.to) - dayMs(today)) / DAY_MS + 1
  return { phase: "running", months: Math.max(1, Math.ceil(daysLeft / 30.4375)) }
}
