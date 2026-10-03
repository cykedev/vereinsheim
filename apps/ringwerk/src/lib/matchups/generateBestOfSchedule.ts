/**
 * Generiert einen Einfachrunden-Spielplan (Single Round-Robin) für BEST_OF_SINGLE.
 *
 * Konstruktion und A/B-Ausgleich: siehe `roundRobinRounds` (Berger-Tabelle). Bei ungerader
 * Teilnehmerzahl erhält jeder genau ein Freilos und ist genau gleich oft A wie B.
 * Nur eine Runde (kein Heimrecht-Tausch / Rückrunde).
 */

import { roundRobinRounds, type RoundRobinMatch } from "./roundRobin"

export type BestOfMatchup = RoundRobinMatch

export function generateBestOfSchedule(participantIds: string[]): BestOfMatchup[] {
  return roundRobinRounds(participantIds)
}
