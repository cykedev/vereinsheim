// Schüsse so, wie die Bausteine sie brauchen: Serie, Beschriftung, Wert, Gruppe der Auswahl. Alles über
// den Fachkern (`shotNumbers`, `selectShots`), keine eigene Filterlogik.

import {
  selectShots,
  shotNumbers,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

import type { SeriesKey, Selection } from "./types"
import { isSelected } from "./view-state"

/** Serie eines Schusses: die Probe oder die Nummer der Serie (ohne Angabe Serie 1) */
export const seriesKeyOf = (shot: MetricShot): SeriesKey =>
  shot.kind === "probe" ? "probe" : (shot.series ?? 1)

/** Beschriftung je Schuss: Probe „P1“, „P2“ …, Wertung „1“, „2“ …, in Abgabefolge je Art */
export function shotLabels(shots: readonly MetricShot[]): string[] {
  const numbers = shotNumbers(shots)
  return shots.map((shot) => `${shot.kind === "probe" ? "P" : ""}${numbers.get(shot) ?? "?"}`)
}

/** Wert in der gewählten Wertung („10,4“ bzw. „10“); ohne Wert ein Strich */
export function formatScore(shot: MetricShot, scoring: Scoring): string {
  if (scoring === "rings") return shot.ring === null ? "–" : String(shot.ring)
  return shot.decimalTenths === null ? "–" : (shot.decimalTenths / 10).toFixed(1).replace(".", ",")
}

/** Summe in der gewählten Wertung („105,3“ bzw. „100“); ohne Summe ein Strich */
export function formatTotal(total: number | null, scoring: Scoring): string {
  if (total === null) return "–"
  return scoring === "rings" ? String(Math.round(total)) : total.toFixed(1).replace(".", ",")
}

export const hasPosition = (shot: MetricShot) =>
  shot.xUm !== null && shot.yUm !== null && Number.isFinite(shot.xUm) && Number.isFinite(shot.yUm)

/**
 * Letzte Visierverstellung als Nummer des Probeschusses davor; 0 ohne Verstellung. Eine Verstellung
 * nach dem letzten Probeschuss zählt nicht, weil danach keine Probe mehr kommt.
 */
export function sightAdjustCut(
  shots: readonly MetricShot[],
  adjustAfter: readonly number[]
): number {
  const probes = shots.filter((shot) => shot.kind === "probe").length
  return Math.max(0, ...adjustAfter.filter((n) => n < probes))
}

/**
 * Die Gruppe für Streukreis, Ellipse, Schwerpunkt und den Ausschnitt „Gruppe“: die Wertungsschüsse der
 * Auswahl mit Lage, ohne Wertung in der Auswahl deren Probeschüsse.
 */
export function groupShots(shots: readonly MetricShot[], selection: Selection): MetricShot[] {
  const chosen = shots.filter((shot) => isSelected(selection, seriesKeyOf(shot)))
  const match = selectShots(chosen, { kinds: ["match"], need: "position" })
  return match.length ? match : selectShots(chosen, { kinds: ["probe"], need: "position" })
}
