// Worüber die Analyse rechnet: über die Scheibe wie am Ausdruck, also die Wertung; gibt es nur Probe, über alle
// Probeschüsse als Training. Die Auswertungen des Fachkerns zählen meist nur
// Wertung; die Karte geht deshalb durch `asOnPrintout`, auch wenn die Seite das nicht schon getan hat.

import type { MetricShot, Scoring } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import { asOnPrintout, isProbeShot } from "../shots"

/** Grundlage der Analyse, für den Kopf: die Scheibe oder ein Training nur aus Probe */
export type AnalysisBasis = "nur Probe" | "alle"

export interface AnalysisInput {
  /** die Schüsse der Karte wie am Ausdruck (für die Datenlage); gleich `base`, eigener Name für die Lesbarkeit */
  all: readonly MetricShot[]
  /** die Schüsse, über die die Analyse rechnet: Wertung, bei nur Probe die Probe als Wertung */
  base: readonly MetricShot[]
  /**
   * die ganze Karte für Abstände: die rohe Karte (`context`) mit einer Probe zwischen Wertung, damit sie keine Lücke
   * reißt (SF-04); ohne Wertung dieselbe wie `base`
   */
  card: readonly MetricShot[]
  basis: AnalysisBasis
  scoring: Scoring
  target: TargetImage
}

/**
 * `shots` wie die Seite sie zeigt (meist schon durch `asOnPrintout`), `context` die rohe Karte davor; ohne Angabe
 * dieselbe Liste
 */
export function analysisInput(
  shots: readonly MetricShot[],
  scoring: Scoring,
  target: TargetImage,
  context: readonly MetricShot[] = shots
): AnalysisInput {
  const base = asOnPrintout(shots)
  const basis: AnalysisBasis = base.length > 0 && base.every(isProbeShot) ? "nur Probe" : "alle"
  const card = context.some((shot) => shot.kind === "match") ? context : base
  return { all: base, base, card, basis, scoring, target }
}
