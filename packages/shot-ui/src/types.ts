// Gemeinsame Begriffe der Bausteine: Serien, Auswahl, Ausschnitt.

/**
 * eine Serie (1, 2, …). Eine Probe neben Wertung gibt es nicht: Eine Scheibe ist wie am Ausdruck
 * (`asOnPrintout`), ein Training nur aus Probe hat Serien wie Wertung
 */
export type SeriesKey = number

/** die ganze Scheibe */
export type Whole = "all"

/**
 * Auswahl auf der Scheibe: die ganze Scheibe oder genau eine Serie. Mehrere Serien zugleich sind bewusst nicht
 * wählbar, das ist einfacher zu bedienen.
 */
export type Selection = Whole | SeriesKey

/** Ausschnitt in Millimetern, quadratisch: linke obere Ecke und Breite (SVG-Koordinaten, y nach unten) */
export interface ViewBox {
  x: number
  y: number
  w: number
}
