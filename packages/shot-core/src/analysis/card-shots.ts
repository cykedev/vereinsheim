// Welche Schüsse einer Scheibe in Auswertungen über viele Scheiben zählen, und die Folge der Scheiben.
// Nicht über `./index` exportiert: eine Hilfe für `period.ts` und `records.ts`, keine Auswertung.

import { asOnPrintout, sumsShots, type CardSums, type MetricShot } from "../metrics"

export interface CardShots {
  /** die Wertungsschüsse: für Kennzahlen der Registry und die Schusszahl */
  match: readonly MetricShot[]
  /**
   * die ganze Karte für Auswertungen, die selbst auswählen und nummerieren (`shotExtremes`, `longestRun`,
   * `seriesCurve`): erst die ganze Karte ordnen, dann auswählen, damit „Schuss 8“ derselbe ist wie auf
   * der Seite der Scheibe
   */
  whole: readonly MetricShot[]
}

/**
 * Die Schüsse einer Scheibe, die zählen, wie am Ausdruck (`asOnPrintout`): mit Wertung nur die Wertung. Die ganze Karte
 * bleibt dabei Kontext für Abstände und Nummern, damit eine Probe zwischen Wertung keine Lücke reißt (SF-04). Hat sie
 * nur Probe, mit `includeProbeOnly` die Probe wie Wertung (dieselbe Regel wie auf der Seite einer Scheibe, SF-01);
 * sonst null, die Scheibe zählt nicht. Eine Scheibe ohne Schüsse zählt nie, ohne Schüsse zählt die Scheibe nur über
 * ihre Summen (`shotCountOf`, `summaryValue`).
 */
export function cardShots(
  shots: readonly MetricShot[],
  includeProbeOnly = false
): CardShots | null {
  if (!shots.length) return null
  const printed = asOnPrintout(shots)
  if (shots.some((shot) => shot.kind === "match")) return { match: printed, whole: shots }
  return includeProbeOnly ? { match: printed, whole: printed } : null
}

/** Schusszahl einer Scheibe: die Schüsse wie am Ausdruck, ohne sie die Schusszahl ihrer Summen */
export function shotCountOf(card: { shots: readonly MetricShot[]; sums?: CardSums }): number {
  return asOnPrintout(card.shots).length || sumsShots(card.sums)
}

/** Scheiben in ihrer Folge: nach Beginn, bei Gleichstand nach Kennung */
export function byStart<T extends { id: string; startedAtMs: number }>(cards: readonly T[]): T[] {
  return [...cards].sort(
    (a, b) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
