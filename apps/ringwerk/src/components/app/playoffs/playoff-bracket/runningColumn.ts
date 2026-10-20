import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"

/**
 * Die Spalte des Turnierbaums, in der gerade geschossen wird: die erste Runde mit einer offenen Paarung, in der
 * Reihenfolge der gezeigten Spalten (Achtel-, Viertel-, Halbfinale, Finale). Ist alles entschieden, die letzte Runde
 * mit Paarungen; ohne Paarung die erste Spalte.
 */
export function runningColumn(bracket: PlayoffBracketData, isAF: boolean, isVF: boolean): number {
  const columns: PlayoffMatchItem[][] = [
    ...(isAF ? [bracket.eighthFinals] : []),
    ...(isAF || isVF ? [bracket.quarterFinals] : []),
    bracket.semiFinals,
    bracket.final ? [bracket.final] : [],
  ]
  const open = columns.findIndex((matches) => matches.some((m) => m.status !== "COMPLETED"))
  if (open >= 0) return open
  let last = 0
  columns.forEach((matches, i) => {
    if (matches.length > 0) last = i
  })
  return last
}
