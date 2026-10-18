// Ringwert-Farben als Hex für Orte ohne CSS-Variablen (PDF). Dieselben Werte wie `--score-*` in design2.css,
// farbenblind geprüft ([[spiegel-ui-design]]); ein Test hält beide gleich.

/** 10 rot, 9 gold, 8 türkis, 7 und weniger violett */
export const SCORE_HEX = { 10: "#e5484d", 9: "#e9b10c", 8: "#1fa3c8", 7: "#7c5cd6" } as const

export type ScoreKey = keyof typeof SCORE_HEX

/** die Stufe eines Ringwerts, ganz oder in Zehnteln: ab 10 die Zehn, bis unter 8 die Sieben */
export function scoreKey(ring: number): ScoreKey {
  if (ring >= 10) return 10
  if (ring >= 9) return 9
  if (ring >= 8) return 8
  return 7
}
