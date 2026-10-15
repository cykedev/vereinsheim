// Zeichenreihenfolge der Treffer. Jeder Treffer wird mit seiner Nummer gezeichnet: Ein späterer Treffer
// verdeckt auch die Nummer eines früheren, so sieht man, zu welchem Schuss eine Nummer gehört.
// Streukreis, Ellipse und Schwerpunkt liegen darüber, nicht in dieser Liste.

export interface LayerShot {
  kind: "probe" | "match"
}

export interface LayerOptions {
  /** der angetippte Schuss: ganz oben */
  chosen?: number | null
  /** gehört der Schuss zur Auswahl? Schüsse außerhalb liegen blass darunter */
  selected?: (index: number) => boolean
}

/**
 * Indizes in Zeichenreihenfolge, von unten nach oben: erst die blassen Schüsse außerhalb der Auswahl, dann die
 * gewählten, jeweils in Abgabefolge (Reihenfolge der Liste), der angetippte Schuss zuletzt. Eine Probe neben Wertung
 * kommt nicht vor (`asOnPrintout`).
 */
export function layerOrder(shots: readonly LayerShot[], options: LayerOptions = {}): number[] {
  const { chosen = null, selected = () => true } = options
  const rank = (i: number) => (selected(i) ? 1 : 0)
  return shots
    .map((_, i) => i)
    .filter((i) => i !== chosen)
    .sort((a, b) => rank(a) - rank(b) || a - b)
    .concat(chosen !== null && chosen >= 0 && chosen < shots.length ? [chosen] : [])
}
