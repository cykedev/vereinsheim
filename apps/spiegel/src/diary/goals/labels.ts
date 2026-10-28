// Wie ein Ziel in Liste und Kopf heißt: Datum, Unterzeile, Zustand, Stand in einer Zeile. Reine Funktionen
// (Textbuch Spiegel, „Tagebuch (2b)“).

import { formatDateOnly, zonedDayStartMs } from "@vereinsheim/lib/format"

import type { GoalSummary } from "./queries"
import { standLine } from "./stand-text"
import { GOAL_TEXTS } from "./texts"

/** ein Tag als Datum („31.08.2027“) */
export const dateText = (day: string, timeZone: string) =>
  formatDateOnly(new Date(zonedDayStartMs(day, timeZone) + 12 * 3_600_000), timeZone)

/** die Unterzeile einer Karte in der Liste: Disziplin und Ende, vorbei der ganze Zeitraum */
export function goalListMeta(goal: GoalSummary, timeZone: string): string {
  const family = goal.family?.name ?? GOAL_TEXTS.noFamily
  if (goal.phase.phase === "past")
    return `${family} · ${dateText(goal.from, timeZone)} – ${dateText(goal.to, timeZone)}`
  return `${family} · ${GOAL_TEXTS.until(dateText(goal.to, timeZone))}`
}

/** der Stand in einer Zeile: gemessen, Ergebnisziel ohne Messung oder Prozessziel mit seinen Einträgen */
export function goalListStand(goal: GoalSummary): string {
  if (goal.rule && goal.stand) return standLine(goal.rule, goal.stand)
  if (goal.kind === "process") return GOAL_TEXTS.processEntries(goal.entries)
  return GOAL_TEXTS.unmeasured
}

const OUTCOME_WORDS = { yes: "Ja", partly: "Teilweise", no: "Nein" } as const

/** der Zustand rechts an der Karte: die Antwort, sonst läuft, beginnt am …, vorbei */
export function goalListState(goal: GoalSummary, timeZone: string): string {
  if (goal.outcome) return OUTCOME_WORDS[goal.outcome]
  if (goal.phase.phase === "running") return GOAL_TEXTS.stateRunning
  if (goal.phase.phase === "upcoming")
    return GOAL_TEXTS.stateUpcoming(dateText(goal.from, timeZone))
  return GOAL_TEXTS.statePast
}

/** der Zustand im Kopf von „Stand“: läuft · noch n Monate, beginnt am …, vorbei */
export function goalPhaseText(goal: GoalSummary, timeZone: string): string {
  if (goal.phase.phase === "running")
    return `${GOAL_TEXTS.stateRunning} · ${GOAL_TEXTS.monthsLeft(goal.phase.months)}`
  if (goal.phase.phase === "upcoming")
    return GOAL_TEXTS.stateUpcoming(dateText(goal.from, timeZone))
  return GOAL_TEXTS.statePast
}

/** die Unterzeile im Kopf eines Ziels: Disziplin, Art der Scheiben (nur wenn nicht alle), Zeitraum */
export function goalHeadMeta(goal: GoalSummary, timeZone: string): string {
  const parts = [goal.family?.name ?? GOAL_TEXTS.noFamily]
  if (goal.kind === "process") parts.push(GOAL_TEXTS.process)
  else if (goal.rule?.cards === "training") parts.push(GOAL_TEXTS.training)
  else if (goal.rule?.cards === "competition") parts.push(GOAL_TEXTS.competition)
  parts.push(`${dateText(goal.from, timeZone)} – ${dateText(goal.to, timeZone)}`)
  return parts.join(" · ")
}
