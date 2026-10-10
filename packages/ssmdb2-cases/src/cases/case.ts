// Ein Fall: Katalog-ID, ein Skript gegen den Baukasten, das nach jedem Schritt liest, und das erwartete Ergebnis.

import type { ExpectedCard } from "../expected"
import { readingSnapshots, stepSql, type ReadingOutput } from "../output"
import { scheibenIdAt, Sim } from "../stand"
import type { Ablage } from "../ablage"

export interface CaseDefinition {
  /** Katalog-ID aus `vault/spiegel/spiegel-edge-cases.md`, etwa „SF-03“ */
  id: string
  title: string
  /** was der Fall zeigt, in einem oder zwei Sätzen */
  description: string
  /** Beginn (UTC); die Fälle liegen in der Sommerzeit 2026 */
  start: number
  run: (sim: Sim) => void
  expected: readonly ExpectedCard[]
}

export const defineCase = (definition: CaseDefinition) => definition

export interface CaseOutput {
  id: string
  title: string
  description: string
  readings: ReadingOutput[]
  /** je Lesung die Anweisungen vom vorigen Stand (beim ersten: alles anlegen) */
  sql: string[]
  expected: readonly ExpectedCard[]
  /** die Ablage der letzten Lesung */
  last: Ablage
}

export function runCase(definition: CaseDefinition): CaseOutput {
  const sim = new Sim(definition.start)
  definition.run(sim)
  if (!sim.readings.length) throw new Error(`${definition.id}: keine Lesung`)
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    readings: readingSnapshots(sim.readings),
    sql: sim.readings.map((r, i) => stepSql(i ? sim.readings[i - 1].ablage : null, r.ablage)),
    expected: definition.expected,
    last: sim.readings.at(-1)!.ablage,
  }
}

/** erfundener Start des Zählers der ScheibenIDs: 20. September 2026; IDs der Fälle danach positiv und steigend */
export const BOOT = Date.UTC(2026, 8, 20, 4)
/** die ScheibenID, die Meyton zu dieser Zeit vergäbe */
export const idAt = (ms: number) => scheibenIdAt(BOOT, ms)
/** ein Abend der Fälle um 19:00 Uhr MESZ */
export const evening = (day: number, month = 10) => Date.UTC(2026, month - 1, day, 17)
