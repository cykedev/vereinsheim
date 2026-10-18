import { scoreKey } from "@vereinsheim/ui/design2/score-colors"

// Ringwert-Farben wie in Spiegel: 10 rot, 9 gold, 8 türkis, 7 und weniger violett (`--score-*` aus design2.css)

/** die Farbe eines Ringwerts als CSS-Variable, für Diagramme */
export const scoreVar = (ring: number) => `var(--score-${scoreKey(ring)})`

const SCORE_BG = {
  10: "bg-score-10",
  9: "bg-score-9",
  8: "bg-score-8",
  7: "bg-score-7",
} as const

/** die Farbe eines Ringwerts als Klasse für eine Fläche (Farbpunkt); null für keinen Wert */
export function scoreBgClass(value: string | number): string | null {
  const ring = typeof value === "number" ? value : parseFloat(value.replace(",", "."))
  return Number.isFinite(ring) ? SCORE_BG[scoreKey(ring)] : null
}
