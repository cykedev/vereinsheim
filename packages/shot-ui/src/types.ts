// Gemeinsame Begriffe der Bausteine: Serien, Auswahl, Ausschnitt.

/** eine Serie der Wertung (1, 2, …) oder die Probe */
export type SeriesKey = number | "probe"

/** Auswahl auf der Scheibe: alle Schüsse oder bestimmte Serien und die Probe */
export type Selection = "all" | readonly SeriesKey[]

/** Ausschnitt in Millimetern, quadratisch: linke obere Ecke und Breite (SVG-Koordinaten, y nach unten) */
export interface ViewBox {
  x: number
  y: number
  w: number
}
