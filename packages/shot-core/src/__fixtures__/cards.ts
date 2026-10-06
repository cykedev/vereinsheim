// Gemeinsame Test-Scheiben für Registry und Auswertungen. Erfunden bzw. aus dem Ausdruck vom 2. Oktober
// 2026 ohne Namen übernommen (nur Werte und Teiler).

import type { MetricShot } from "../metrics"

// Die sechs Wertungsschüsse vom Ausdruck des 2. Oktober 2026, auf die Achsen gelegt wie in der
// Spielwiese, im Abstand von 50 s; davor fünf Probeschüsse um (1000, −1000) µm.
export const MATCH: MetricShot[] = (
  [
    [0, 3318, 105, true],
    [-3964, 0, 105, true],
    [5474, 0, 103, false],
    [0, -26560, 76, false],
    [33690, 0, 67, false],
    [-38310, 0, 62, false],
  ] as const
).map(([xUm, yUm, decimalTenths, innerTen], i) => ({
  xUm,
  yUm,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen,
  firedAtMs: 300_000 + i * 50_000,
  kind: "match",
  series: 1,
}))

export const PROBE: MetricShot[] = (
  [
    [1000, -1000],
    [1200, -900],
    [900, -1100],
    [1100, -1000],
    [1000, -1200],
  ] as const
).map(([xUm, yUm], i) => ({
  xUm,
  yUm,
  decimalTenths: 104,
  ring: 10,
  innerTen: false,
  firedAtMs: i * 50_000,
  kind: "probe",
  series: null,
}))

// Sechs Schuss um (0 | 0), in x weiter gestreut als in y, gerade Zahl: Abstände 1, 1, 2, 3, 3, 4 mm
// (Median 2,5, Mittel 2,33); der Streukreis spannt sich über (4 | 0) und (−3 | 0), also 7 mm.
export const SPREAD: MetricShot[] = (
  [
    [4000, 0],
    [-1000, 0],
    [-3000, 0],
    [0, 3000],
    [0, -1000],
    [0, -2000],
  ] as const
).map(([xUm, yUm], i) => ({ ...MATCH[0], xUm, yUm, firedAtMs: i * 10_000 }))

export const CARD = [...PROBE, ...MATCH]
