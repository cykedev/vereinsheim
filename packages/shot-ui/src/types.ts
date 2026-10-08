// Gemeinsame Begriffe der Bausteine: Serien, Auswahl, Ausschnitt.

/** eine Serie der Wertung (1, 2, …) oder die Probe */
export type SeriesKey = number | "probe"

/**
 * Die ganze Scheibe: alle Schüsse mit Probe („all“) oder ohne Probe, also nur die Wertung („match“).
 * Für richtige Zahlen wählbar (User, 8. Oktober 2026).
 */
export type Whole = "all" | "match"

/**
 * Auswahl auf der Scheibe: die ganze Scheibe (mit oder ohne Probe) oder genau eine Serie (auch die
 * Probe). Mehrere Serien zugleich sind bewusst nicht wählbar, das ist einfacher zu bedienen (Wunsch des
 * Users, 8. Oktober 2026).
 */
export type Selection = Whole | SeriesKey

/** Ausschnitt in Millimetern, quadratisch: linke obere Ecke und Breite (SVG-Koordinaten, y nach unten) */
export interface ViewBox {
  x: number
  y: number
  w: number
}
