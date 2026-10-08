// Schüsse so, wie die Bausteine sie brauchen: Serie, Beschriftung, Wert, Gruppe der Auswahl. Alles über
// den Fachkern (`shotNumbers`, `selectShots`), keine eigene Filterlogik.

import {
  selectShots,
  shotNumbers,
  stepsInOrder,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

import { formatValue } from "./format"
import type { SeriesKey, Selection } from "./types"
import { isSelected } from "./view-state"

/**
 * Serie eines Schusses: die Probe oder die Nummer der Serie. Ein Wertungsschuss ohne Serie gehört zu
 * keiner (null) und zählt nur bei „alle“, wie im Fachkern, wo `seriesCurve` ihn auslässt.
 */
export const seriesKeyOf = (shot: MetricShot): SeriesKey | null =>
  shot.kind === "probe" ? "probe" : shot.series

/** Beschriftung je Schuss: Probe „P1“, „P2“ …, Wertung „1“, „2“ …, in Abgabefolge je Art */
export function shotLabels(shots: readonly MetricShot[]): string[] {
  const numbers = shotNumbers(shots)
  return shots.map((shot) => `${shot.kind === "probe" ? "P" : ""}${numbers.get(shot) ?? "?"}`)
}

/** Wert in der gewählten Wertung („10,4“ bzw. „10“); ohne Wert ein Strich */
export function formatScore(shot: MetricShot, scoring: Scoring): string {
  if (scoring === "rings") return shot.ring === null ? "–" : formatValue(shot.ring, 0)
  return shot.decimalTenths === null ? "–" : formatValue(shot.decimalTenths / 10, 1)
}

/** Summe in der gewählten Wertung („105,3“ bzw. „100“); ohne Summe ein Strich */
export function formatTotal(total: number | null, scoring: Scoring): string {
  return total === null ? "–" : formatValue(total, scoring === "rings" ? 0 : 1)
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
 * Probeschüsse vor der letzten Visierverstellung, nach ihrer Nummer aus `shotNumbers` wie die Beschriftung
 * (nicht nach dem Platz in der Liste); werden gestrichelt gezeichnet.
 */
export function probesBeforeAdjust(
  shots: readonly MetricShot[],
  adjustAfter: readonly number[]
): ReadonlySet<MetricShot> {
  const cut = sightAdjustCut(shots, adjustAfter)
  const numbers = shotNumbers(shots)
  return new Set(
    shots.filter((shot) => shot.kind === "probe" && (numbers.get(shot) ?? Infinity) <= cut)
  )
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

/**
 * Die Schüsse der Auswahl für Kennzahlen: Wertungsschüsse, ohne Wertung in der Auswahl deren Probe.
 * Ohne Filter auf die Lage, denn jede Kennzahl wählt über `computeMetric` selbst, was sie braucht.
 */
export function selectionShots(shots: readonly MetricShot[], selection: Selection): MetricShot[] {
  const chosen = shots.filter((shot) => isSelected(selection, seriesKeyOf(shot)))
  const match = chosen.filter((shot) => shot.kind === "match")
  return match.length ? match : chosen.filter((shot) => shot.kind === "probe")
}

/**
 * Abstand jedes Schusses zum vorigen der Karte in ms, über `stepsInOrder` wie `analysis/timing`: null beim
 * ersten, nach einer Lücke in der Abgabefolge, ohne Zeit und bei einem Rücksprung der Uhr. Die Schüsse
 * stehen in Abgabefolge (`inShotOrder`); der Abstand gilt zum vorigen Schuss der Karte, auch bei Auswahl.
 */
export function shotIntervals(shots: readonly MetricShot[]): (number | null)[] {
  const steps = stepsInOrder(shots)
  const byShot = new Map<MetricShot, number | null>()
  steps.forEach((step, i) => {
    const now = step.shot.firedAtMs
    const then = steps[i - 1]?.shot.firedAtMs
    const gap =
      !step.gapBefore && Number.isFinite(now) && Number.isFinite(then)
        ? (now as number) - (then as number)
        : Number.NaN
    byShot.set(step.shot, gap >= 0 ? gap : null)
  })
  return shots.map((shot) => byShot.get(shot) ?? null)
}
