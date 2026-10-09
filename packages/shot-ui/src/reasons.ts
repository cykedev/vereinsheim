// Gründe ohne Wert und der Ø, wenn es kein Ergebnis gibt: gleich in Ergebnis-Box, Kachel und Reiter
// (Prüfung, 9. Oktober 2026). Rechnet nur über die Registry des Fachkerns.

import {
  computeMetric,
  eligibleShots,
  inScoring,
  metricByKey,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

/**
 * Warum es kein Ergebnis gibt: ohne Wertungsschuss die Mindestzahl; fehlen nur Zehntel, gibt es das Ergebnis
 * in ganzen Ringen (SF-18), darum der Rat zum Umschalten statt „ohne Wert“.
 */
export function noResultReason(shots: readonly MetricShot[], scoring: Scoring): string {
  if (!shots.some((shot) => shot.kind === "match")) return "ab 1 Schuss"
  if (scoring === "decimal" && computeMetric(metricByKey("result.rings")!, shots) !== null) {
    return "nicht jeder Schuss mit Zehntel · auf ganze Ringe schalten"
  }
  return "nicht jeder Schuss mit Wert"
}

/** Ø je Schuss über die Wertungsschüsse mit Wert und ihre Zahl; den Ø gibt es auch ohne Ergebnis */
export function meanWithCount(
  shots: readonly MetricShot[],
  scoring: Scoring
): { mean: number; n: number } | null {
  const metric = inScoring(metricByKey("result.decimalMean")!, scoring)
  const mean = computeMetric(metric, shots)
  return mean === null ? null : { mean, n: eligibleShots(metric, shots).length }
}

/** Ohne Schwerpunkt und Test: unter drei Schuss mit Lage oder alle auf einer Linie (`mpiConfidence` ist null) */
export const NO_CENTER = "ab 3 Schuss mit Lage (nicht alle auf einer Linie)"

/** ohne Prüfung auf Ausreißer: der Fachkern (`outliers`) braucht fünf Schüsse mit Lage; Kachel und Reiter gleich */
export const NO_OUTLIERS = "ab 5 Schuss mit Lage"

/** Wie die Schüsse heißen, über die der Ø ohne Ergebnis rechnet: in Zehnteln die mit Zehntel, sonst mit Ring */
export const valuedWord = (scoring: Scoring) => (scoring === "decimal" ? "mit Zehntel" : "mit Ring")

/** Ringverlust ohne Summe: Einem Wertungsschuss fehlt die Lage, oder er ist verdächtig und zählt nicht (SF-15) */
export const NO_FULL_POSITION =
  "nicht jeder Wertungsschuss mit gültiger Lage (fehlt oder verdächtig)"
