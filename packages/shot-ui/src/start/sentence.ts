// Der Satz über dem letzten Abend und der Bezug unter seiner großen Zahl (Plan N5, D3, D4; U5, D2). Der Satz ordnet ein wie
// die Ablesung im Fortschritt (im, über, unter dem Formband) und wertet nicht: Ein Band von ± einer typischen
// Schwankung lässt jeden dritten gewöhnlichen Abend draußen, „stark“ wäre dafür kein ehrliches Wort (Review N5,
// Regel „Ehrlich statt scheingenau“ des Fachkerns). Ohne Band nur der Abstand.

import { formatValue } from "../format"
import type { EveningBlock } from "./model"

/** unter diesem Abstand zeigten zwei Stellen 0,00: „genau dein Schnitt“ */
const LEVEL = 0.005

const before = (n: number) => (n === 1 ? "der Scheibe davor" : `der ${n} Scheiben davor`)

/** ohne Wertung: wo der Abend im Band liegt, wie die Ablesung im Fortschritt (User, 9. Oktober 2026) */
const LEAD: Readonly<Record<NonNullable<EveningBlock["verdict"]>, string>> = {
  within: "Im Formband",
  above: "Über dem Formband",
  below: "Unter dem Formband",
}

/**
 * „Im Formband: 0,09 über deinem Schnitt.“; null ohne Wert des Abends oder wenn Scheiben davor keinen Wert haben.
 * „Dein erster Abend“ nur, wenn wirklich keine Scheibe der Familie davor liegt.
 */
export function eveningSentence(block: EveningBlock, familyLabel: string): string | null {
  if (block.mean === null) return null
  if (!block.average)
    return block.cardsBefore === 0 ? `Dein erster Abend mit ${familyLabel}.` : null
  const delta = block.mean - block.average.value
  const distance = formatValue(Math.abs(delta), 2)
  const side = delta >= 0 ? "über" : "unter"
  if (!block.verdict) {
    return Math.abs(delta) < LEVEL
      ? `Genau auf dem Schnitt ${before(block.average.n)}.`
      : `${distance} ${side} dem Schnitt ${before(block.average.n)}.`
  }
  const lead = LEAD[block.verdict]
  return Math.abs(delta) < LEVEL
    ? `${lead}: genau dein Schnitt.`
    : `${lead}: ${distance} ${side} deinem Schnitt.`
}

/**
 * „Schnitt der 5 Scheiben davor: 9,05“ unter der großen Zahl (U5, D2): der Bezug des Satzes; den Abstand und das Band
 * sagt schon der Satz. Null ohne Schnitt
 */
export function eveningReferenceText(block: EveningBlock): string | null {
  if (!block.average) return null
  return `Schnitt ${before(block.average.n)}: ${formatValue(block.average.value, 2)}`
}
