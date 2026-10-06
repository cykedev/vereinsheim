// Wert eines Schusses in der gewählten Wertung, für die Auswertungen. Ganze Ringe brauchen nur den
// Ring, Zehntel den Zehntelwert (SF-18). Schwellen stehen in Zehnteln (100 = 10,0), damit der Vergleich
// ganzzahlig bleibt; in ganzen Ringen zählt Ring 10 als 100, eine Schwelle wie 10,5 erreicht dann keiner.

import type { MetricNeed, MetricShot, Scoring } from "../metrics"

export const valueNeed = (scoring: Scoring): MetricNeed =>
  scoring === "rings" ? "ring" : "decimal"

/** Wert in Zehnteln: Ring 10 → 100, 10,4 → 104 */
export const valueTenths = (shot: MetricShot, scoring: Scoring) =>
  scoring === "rings" ? (shot.ring as number) * 10 : (shot.decimalTenths as number)

/** Wert in Ringen: 10 bzw. 10,4 */
export const valueRings = (shot: MetricShot, scoring: Scoring) => valueTenths(shot, scoring) / 10
