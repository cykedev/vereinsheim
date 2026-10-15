// Schüsse so, wie die Bausteine sie brauchen: Serie, Beschriftung, Wert, Gruppe der Auswahl. Alles über
// den Fachkern (`shotNumbers`, `selectShots`), keine eigene Filterlogik.

import {
  asOnPrintout as asOnPrintoutInCore,
  contextOf,
  inShotOrder,
  pauseThresholdOf,
  selectShots,
  shotDistanceUm,
  shotNumbers,
  stepsInOrder,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

import { formatValue } from "./format"
import type { SeriesKey, Selection } from "./types"
import { isSelected } from "./view-state"

/**
 * Eine Scheibe wie am Ausdruck (ADR-027): mit Wertung nur die Wertungsschüsse, eine Karte nur mit Probe ist
 * Training und verhält sich genau wie Wertung, auch optisch. Die Regel kommt aus dem
 * Fachkern (`asOnPrintout` in `metrics`, dieselbe wie für Zeiträume): Reihenfolge der Liste und alle übrigen Angaben
 * bleiben. Hier kommt nur `fromProbe` dazu, das sich bei einem Training die Herkunft merkt (für das Probe-Eck, der
 * Fachkern kennt das Feld nicht). Die Seite wendet das einmal an, bevor sie die Bausteine füttert.
 */
export function asOnPrintout(shots: readonly MetricShot[]): readonly MetricShot[] {
  const printed = asOnPrintoutInCore(shots)
  if (printed === shots || shots.some((shot) => shot.kind === "match")) return printed
  return printed.map((shot) => ({ ...shot, fromProbe: true }))
}

/** die Wertungsschüsse einer Karte, bei nur Probe die Probe wie Wertung (Zeile, Ablesung, kleine Scheibe) */
export const matchShots = (shots: readonly MetricShot[]): readonly MetricShot[] =>
  asOnPrintout(shots)

/** ein Probeschuss, auch einer, den `asOnPrintout` als Training wie Wertung zeigt (für das Probe-Eck) */
export const isProbeShot = (shot: MetricShot) =>
  shot.kind === "probe" || (shot as { fromProbe?: boolean }).fromProbe === true

/**
 * Serie eines Schusses: ihre Nummer. Ein Schuss ohne Serie gehört zu keiner (null) und zählt nur bei „alle“, wie im
 * Fachkern, wo `seriesCurve` ihn auslässt.
 */
export const seriesKeyOf = (shot: MetricShot): SeriesKey | null => shot.series

/** Beschriftung je Schuss: „1“, „2“ … in Abgabefolge (nach `asOnPrintout` gibt es keine Probe neben Wertung) */
export function shotLabels(shots: readonly MetricShot[]): string[] {
  const numbers = shotNumbers(shots)
  return shots.map((shot) => `${numbers.get(shot) ?? "?"}`)
}

/**
 * Wert eines einzelnen Schusses, immer in Zehnteln („10,4“), gleich in welcher Wertung die Scheibe steht. Ohne Zehntel
 * (SF-18) der Ring („10“), ohne Wert ein Strich. Summen, Ø und Serien folgen weiter der Wertung (`formatTotal`).
 */
export function formatShotValue(shot: MetricShot): string {
  if (shot.decimalTenths !== null) return formatValue(shot.decimalTenths / 10, 1)
  return shot.ring === null ? "–" : formatValue(shot.ring, 0)
}

/** Summe in der gewählten Wertung („105,3“ bzw. „100“); ohne Summe ein Strich */
export function formatTotal(total: number | null, scoring: Scoring): string {
  return total === null ? "–" : formatValue(total, scoring === "rings" ? 0 : 1)
}

/** Lage aus endlichen Zahlen, für schon gefilterte Lagen (`MiniTarget`); gezeichnet wird über `isDrawn` (Fachkern) */
export const hasPosition = (shot: Pick<MetricShot, "xUm" | "yUm">) =>
  shot.xUm !== null && shot.yUm !== null && Number.isFinite(shot.xUm) && Number.isFinite(shot.yUm)

/**
 * Abstand zur Mitte in µm wie im Fachkern (`shotDistanceUm`): der gemessene vor dem aus der Lage, auch ohne
 * Lage (nur vom Ausdruck); ein verdächtiger Schuss hat keinen gültigen Abstand (SF-15), dann null.
 */
export function shotDistance(shot: MetricShot): number | null {
  return selectShots([shot], { need: "distance" }).length ? shotDistanceUm(shot) : null
}

/** Lage zum Ablesen: nur eine gültige, ein verdächtiger Platzhalter nicht (SF-15) */
export const hasValidPosition = (shot: MetricShot) =>
  selectShots([shot], { need: "position" }).length > 0

/**
 * Die Gruppe für Streukreis, Ellipse, Schwerpunkt und den Ausschnitt „Gruppe“: die Schüsse der Auswahl mit gültiger
 * Lage.
 */
export function groupShots(shots: readonly MetricShot[], selection: Selection): MetricShot[] {
  const chosen = shots.filter((shot) => isSelected(selection, seriesKeyOf(shot)))
  return selectShots(chosen, { kinds: ["probe", "match"], need: "position" })
}

/**
 * Die Schüsse der Auswahl für Kennzahlen. Ohne Filter auf die Lage, denn jede Kennzahl wählt über `computeMetric`
 * selbst, was sie braucht.
 */
export function selectionShots(shots: readonly MetricShot[], selection: Selection): MetricShot[] {
  return shots.filter((shot) => isSelected(selection, seriesKeyOf(shot)))
}

/**
 * Abstand jedes Schusses zum vorigen der Karte in ms, über `stepsInOrder` wie `analysis/timing`: null beim
 * ersten, nach einer Lücke in der Abgabefolge, ohne Zeit und bei einem Rücksprung der Uhr. Geordnet wird
 * selbst (`inShotOrder`); der Abstand gilt zum vorigen Schuss der Karte, auch bei Auswahl. `context` ist die rohe Karte
 * vor `asOnPrintout`: eine Probe zwischen Wertung reißt dann keine Lücke (SF-04).
 */
export function shotIntervals(
  shots: readonly MetricShot[],
  context?: readonly MetricShot[]
): (number | null)[] {
  // erst in Abgabefolge ordnen; das Ergebnis gehört je Schuss, also gilt es für jede Reihenfolge der Liste
  const steps = stepsInOrder(inShotOrder(shots), context ? contextOf(shots, context) : undefined)
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

/**
 * die Schwelle für Pausen, wie in der Analyse: aus dem Takt der ganzen Karte (`pauseThresholdOf`, `context` die rohe
 * Karte); eine Karte nur aus Probe, als Wertung gezeigt, nimmt der Fachkern selbst richtig
 */
export function shotPauseThreshold(
  shots: readonly MetricShot[],
  context?: readonly MetricShot[]
): number {
  return pauseThresholdOf(shots, context ? contextOf(shots, context) : undefined)
}
