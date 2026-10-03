/**
 * Generiert einen Doppelrunden-Spielplan (Hin- + Rückrunde).
 *
 * - Hinrunde: `roundRobinRounds` (Berger-Tabelle) — jede Runde für sich mit ausgeglichener
 *   A/B-Verteilung; bei ungerader Teilnehmerzahl je Teilnehmer genau ein Freilos.
 * - Rückrunde: Hinrunde gespiegelt (Heimrecht getauscht, gleicher Spieltag); Freilose bleiben.
 *   Über die Saison spielt so jedes Paar genau einmal je Seite.
 */

import { roundRobinRounds } from "./roundRobin"

export interface ScheduledMatchup {
  homeId: string
  awayId: string | null // null = Freilos (BYE)
  round: "FIRST_LEG" | "SECOND_LEG"
  roundIndex: number // 1-basiert innerhalb der Runde (= Spieltag)
}

export function generateSchedule(participantIds: string[]): ScheduledMatchup[] {
  const firstLeg: ScheduledMatchup[] = roundRobinRounds(participantIds).map((m) => ({
    ...m,
    round: "FIRST_LEG",
  }))

  const secondLeg: ScheduledMatchup[] = firstLeg.map((m) =>
    m.awayId === null
      ? // Freilos: kein Heimrecht-Tausch sinnvoll
        { ...m, round: "SECOND_LEG" }
      : { homeId: m.awayId, awayId: m.homeId, round: "SECOND_LEG", roundIndex: m.roundIndex }
  )

  return [...firstLeg, ...secondLeg]
}
