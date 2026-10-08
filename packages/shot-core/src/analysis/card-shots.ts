// Welche Schüsse einer Scheibe in Auswertungen über viele Scheiben zählen (Plan L2, D8), und die Folge
// der Scheiben. Nicht über
// `./index` exportiert: eine Hilfe für `period.ts` und `records.ts`, keine Auswertung.

import { inShotOrder, type MetricShot } from "../metrics"

/** Serien zu zehn, wenn eine Scheibe nur Probe hat (wie `probeOnlyAsMatch` in shot-ui) */
const SERIES_SIZE = 10

/**
 * Die Wertungsschüsse einer Scheibe. Hat sie nur Probe, mit `includeProbeOnly` die Probe wie Wertung: in
 * Abgabefolge, Serien zu zehn (SF-01, wie `probeOnlyAsMatch` auf der Seite einer Scheibe); sonst null, die
 * Scheibe zählt nicht. Eine Scheibe ohne Schüsse zählt nie.
 */
export function cardShots(
  shots: readonly MetricShot[],
  includeProbeOnly = false
): readonly MetricShot[] | null {
  const match = shots.filter((shot) => shot.kind === "match")
  if (match.length) return match
  if (!includeProbeOnly || !shots.length) return null
  return inShotOrder(shots).map((shot, i) => ({
    ...shot,
    kind: "match" as const,
    series: Math.floor(i / SERIES_SIZE) + 1,
  }))
}

/** Scheiben in ihrer Folge: nach Beginn, bei Gleichstand nach Kennung */
export function byStart<T extends { id: string; startedAtMs: number }>(cards: readonly T[]): T[] {
  return [...cards].sort(
    (a, b) => a.startedAtMs - b.startedAtMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}
