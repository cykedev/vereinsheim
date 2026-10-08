// Worüber die Analyse rechnet (Plan Schritt 3, D1): über alle Schüsse ohne Probe; gibt es nur Probe, über
// alle Probeschüsse (User, 8. Oktober 2026). Die Auswertungen des Fachkerns zählen meist nur Wertung; eine
// Karte nur mit Probe geht deshalb wie Wertung hinein (`probeOnlyAsMatch`), auch wenn die Seite das nicht
// schon getan hat.

import type { MetricShot, Scoring } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import { isProbeShot, probeOnlyAsMatch } from "../shots"

/** Grundlage der Analyse, für den Kopf */
export type AnalysisBasis = "ohne Probe" | "nur Probe" | "alle"

export interface AnalysisInput {
  /** alle Schüsse der Karte, wie die Seite sie gibt (für die Probe und die Datenlage) */
  all: readonly MetricShot[]
  /** die Schüsse, über die die Analyse rechnet: Wertung, bei nur Probe die Probe als Wertung */
  base: readonly MetricShot[]
  basis: AnalysisBasis
  scoring: Scoring
  target: TargetImage
}

export function analysisInput(
  shots: readonly MetricShot[],
  scoring: Scoring,
  target: TargetImage
): AnalysisInput {
  const probe = shots.filter(isProbeShot).length
  const basis: AnalysisBasis =
    probe > 0 && probe < shots.length ? "ohne Probe" : probe > 0 ? "nur Probe" : "alle"
  const match = shots.filter((shot) => shot.kind === "match")
  const base = match.length ? match : probeOnlyAsMatch(shots)
  return { all: shots, base, basis, scoring, target }
}
