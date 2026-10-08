// Gemeinsame Begriffe der Bausteine: Serien, Auswahl, Ausschnitt.

/** eine Serie der Wertung (1, 2, …) oder die Probe */
export type SeriesKey = number | "probe"

/**
 * Auswahl auf der Scheibe: alle Schüsse oder genau eine Serie (auch die Probe). Mehrere Serien zugleich
 * sind bewusst nicht wählbar, das ist einfacher zu bedienen (Wunsch des Users, 8. Oktober 2026).
 */
export type Selection = "all" | SeriesKey

/** Ausschnitt in Millimetern, quadratisch: linke obere Ecke und Breite (SVG-Koordinaten, y nach unten) */
export interface ViewBox {
  x: number
  y: number
  w: number
}
