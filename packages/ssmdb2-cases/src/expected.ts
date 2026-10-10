// Das erwartete Ergebnis eines Falls: von Hand geschrieben, als Vorgabe für die Brücke (SP-1.4) und das Einlesen
// (SP-1.6), nicht aus deren Logik gerechnet. Ein Test hält es gegen die erzeugten Daten (Nummern, Vollständigkeit).
// Angenommen ist: Der erfundene Sportpass 12345678 („Muster“) hat zugestimmt (Opt-in, ADR-028), kein anderer.

import type { Completeness } from "@vereinsheim/shot-core/discipline"
import type { Scoring } from "@vereinsheim/shot-core/metrics"

/** was die Brücke mit einer Scheibe tut */
export type BridgeAction =
  /** schicken, sobald zwei Lesungen hintereinander gleich sind (SF-71) */
  | "senden"
  /** ab dem ersten verdeckten Wertungsschuss (Anzeigeart 5, 10) oder Modus 0 in der Brücke lassen, bis der Admin freigibt */
  | "zurueckhalten"
  /** nie schicken: ohne Treffer */
  | "auslassen"
  /** nicht von selbst: ohne Sportpass mit Zustimmung; nur über den QR-Code oder „Scheibe holen“ */
  | "nur-qr"

export interface ExpectedCard {
  scheibenId: number
  bridge: BridgeAction
  /** warum zurückgehalten oder ausgelassen */
  reason?: string
  /**
   * die Lesungen (ab 1), deren Snapshot die Brücke schickt: jede nicht flüchtige Lesung mit neuem Stand; bei
   * „zurueckhalten“ nur die vor dem ersten verdeckten Schuss, sonst keine
   */
  sentReadings: readonly number[]
  /** amtliche Wertung aus der Disziplin, wo der Fall sie festhält (nie aus `Treffer.Wertung`, SF-74) */
  official?: Scoring
  /** Probe und Wertung in jeder Lesung (Zahl der Zeilen in `Treffer`); null, wo die Scheibe nicht in der Ablage steht */
  shots: readonly (readonly [probe: number, match: number] | null)[]
  /** Merkmale der Scheibe nach dem Einlesen, im Stand der letzten Lesung, in der sie steht */
  flags: readonly string[]
  completeness: Completeness
  /** wie am Ausdruck: die zählenden Schüsse (Stellung und Nummern) in der letzten Lesung, in der sie steht */
  counted: { stellung: 0 | 1; numbers: readonly number[] }
  /** Merkmale je Schuss, nach Stellung und Nummer („1/41“) */
  shotFlags?: Readonly<Record<string, readonly string[]>>
  /** was der Fall sonst festhält, in einem Satz je Punkt */
  notes?: readonly string[]
}

/** die Nummern von `from` bis `to` */
export const numbers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
