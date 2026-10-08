// Welche Schüsse einer Scheibe in Auswertungen über viele Scheiben zählen (Plan L2, D8), und die Folge
// der Scheiben. Nicht über `./index` exportiert: eine Hilfe für `period.ts` und `records.ts`, keine
// Auswertung.

import { probeOnlyAsMatch, type MetricShot } from "../metrics"

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
 * Die Schüsse einer Scheibe, die zählen. Hat sie nur Probe, mit `includeProbeOnly` die Probe wie Wertung
 * (`probeOnlyAsMatch`, dieselbe Regel wie auf der Seite einer Scheibe, SF-01); sonst null, die Scheibe zählt
 * nicht. Eine Scheibe ohne Schüsse zählt nie.
 */
export function cardShots(
  shots: readonly MetricShot[],
  includeProbeOnly = false
): CardShots | null {
  const match = shots.filter((shot) => shot.kind === "match")
  if (match.length) return { match, whole: shots }
  if (!includeProbeOnly || !shots.length) return null
  const converted = probeOnlyAsMatch(shots)
  return { match: converted, whole: converted }
}

/** Scheiben in ihrer Folge: nach Beginn, bei Gleichstand nach Kennung */
export function byStart<T extends { id: string; startedAtMs: number }>(cards: readonly T[]): T[] {
  return [...cards].sort(
    (a, b) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
