// Der Satz über dem letzten Abend und der Bezug unter seiner großen Zahl. Der Satz ordnet ein wie
// die Ablesung im Fortschritt (im, über, unter dem Formband) und wertet nicht: Ein Band von ± einer typischen
// Schwankung lässt jeden dritten gewöhnlichen Abend draußen, „stark“ wäre dafür kein ehrliches Wort (Regel
// „Ehrlich statt scheingenau“ des Fachkerns). Ohne Band nur der Abstand. Dazu die Legende unter dem Verlauf.

import { formatValue } from "../format"
import type { EveningBlock } from "./model"

/** unter diesem Abstand zeigten zwei Stellen 0,00: „genau dein Schnitt“ */
const LEVEL = 0.005

const before = (n: number) => (n === 1 ? "der Scheibe davor" : `der ${n} Scheiben davor`)

/** ohne Wertung: wo der Abend im Band liegt, wie die Ablesung im Fortschritt */
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
 * „Schnitt der 5 Scheiben davor: 9,05“ unter der großen Zahl: der Bezug des Satzes; den Abstand und das Band
 * sagt schon der Satz. Null ohne Schnitt und ohne Wert des Abends (dann steht ein Strich, kein Bezug)
 */
export function eveningReferenceText(block: EveningBlock): string | null {
  if (!block.average || block.mean === null) return null
  return `Schnitt ${before(block.average.n)}: ${formatValue(block.average.value, 2)}`
}

/**
 * Was der Verlauf darüber zeigt, nur was zu sehen ist: die grauen Punkte und die Linie nur
 * mit Scheiben vor dem Abend, „gestrichelt“ nur mit einem gestrichelten Stück, das Band nur mit Band. Null, wenn es
 * nichts zu erklären gibt (nur der Abend)
 */
export function formLegend(block: Pick<EveningBlock, "strip" | "band">): string | null {
  const { strip } = block
  const earlier = strip.length > 1 && strip.some((s) => !s.tonight)
  // gestrichelt ist die Linie bis zum ersten vollen Punkt; sichtbar ab zwei Punkten
  const firstFull = strip.findIndex((s) => !s.partial)
  const dashed = strip.length > 1 && firstFull !== 0
  const parts = [
    earlier
      ? `Grau: deine letzten Scheiben. Die Linie ist der Schnitt der jeweils letzten fünf${dashed ? " (gestrichelt, solange es weniger sind)" : ""}.`
      : null,
    block.band ? "Das Band zeigt deine übliche Schwankung." : null,
  ].filter(Boolean)
  return parts.length ? parts.join(" ") : null
}
