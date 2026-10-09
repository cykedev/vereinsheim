// Der Satz über dem letzten Abend und der Abstand unter seiner großen Zahl (Plan N5, D3, D4). Das Urteil folgt dem
// Formband: „stark“ und „schwächer“ nur außerhalb, ohne Band nur der Abstand; ein Urteil und die Zahl daneben
// widersprechen sich nie (Regel „Ehrlich statt scheingenau“ des Fachkerns).

import { formatSigned, formatValue } from "../format"
import type { EveningBlock } from "./model"

/** unter diesem Abstand zeigten zwei Stellen 0,00: „genau dein Schnitt“ */
const LEVEL = 0.005

const before = (n: number) => (n === 1 ? "der Scheibe davor" : `der ${n} Scheiben davor`)

const LEAD: Readonly<Record<NonNullable<EveningBlock["verdict"]>, string>> = {
  within: "Ein Abend in deiner Form",
  above: "Ein starker Abend",
  below: "Ein schwächerer Abend",
}

const BAND: Readonly<Record<NonNullable<EveningBlock["verdict"]>, string>> = {
  within: "im Formband",
  above: "über dem Formband",
  below: "unter dem Formband",
}

/** „Ein Abend in deiner Form: 0,09 über deinem Schnitt.“; null ohne Wert des Abends */
export function eveningSentence(block: EveningBlock, familyLabel: string): string | null {
  if (block.mean === null) return null
  if (!block.average) return `Dein erster Abend mit ${familyLabel}.`
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

/** „+0,09 zum Schnitt der 5 Scheiben davor · im Formband“; null ohne Schnitt oder Wert */
export function eveningDeltaText(block: EveningBlock): string | null {
  if (block.mean === null || !block.average) return null
  const text = `${formatSigned(block.mean - block.average.value, 2)} zum Schnitt ${before(block.average.n)}`
  return block.verdict ? `${text} · ${BAND[block.verdict]}` : text
}
