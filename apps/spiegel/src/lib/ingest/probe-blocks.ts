// Blöcke einer ScheibenID ([[adr-027]], Änderung vom 17. Oktober 2026): Meyton löscht die Probe mit dem ersten
// Wertungsschuss (SF-03) und beim Neustart der Probe (SF-72), die ScheibenID bleibt. Jeder Block wird in Spiegel eine
// eigene Scheibe. Reine Funktionen für das Einlesen und das Neulesen aus den Rohdaten.

import { shotFingerprint, type ShotInput } from "../db/cards"

/**
 * Beginnt `next` einen neuen Block nach `current`? Nur nach einer Scheibe aus reiner Probe, und nur wenn der neue Stand
 * keinen ihrer Schüsse mehr zeigt (Fingerabdruck aus Zeit und Lage, nicht die Nummer: nach einem Neustart beginnen die
 * Nummern wieder bei 1). Eine zerrissene Lesung zeigt eine Teilmenge derselben Schüsse (SF-71), eine Korrektur trifft
 * eine Scheibe mit Wertung (SF-21); beide beginnen keinen Block.
 */
export function startsNewBlock(current: readonly ShotInput[], next: readonly ShotInput[]): boolean {
  if (!current.length || !next.length) return false
  if (current.some((shot) => shot.stellung !== 0)) return false
  const known = new Set(current.map(shotFingerprint))
  return !next.some((shot) => known.has(shotFingerprint(shot)))
}

export interface BlockEnd {
  /** Index des letzten Stands dieses Blocks in `states` */
  index: number
  /** ein neuer Block gegenüber `previous` bzw. dem Block davor; der erste ohne `previous` ist es nie */
  newBlock: boolean
}

/**
 * Die Blöcke einer Folge von Ständen derselben ScheibenID: je Block der Index seines letzten Stands. `previous` sind die
 * Schüsse der jüngsten Scheibe dieser ScheibenID (null: noch keine).
 */
export function blockEnds(
  previous: readonly ShotInput[] | null,
  states: readonly (readonly ShotInput[])[]
): BlockEnd[] {
  const ends: BlockEnd[] = []
  let current = previous
  let startsNew = false
  states.forEach((shots, index) => {
    if (current && startsNewBlock(current, shots)) {
      if (index > 0) ends.push({ index: index - 1, newBlock: startsNew })
      startsNew = true
    }
    current = shots
  })
  if (states.length) ends.push({ index: states.length - 1, newBlock: startsNew })
  return ends
}
