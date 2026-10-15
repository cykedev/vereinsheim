// Grenzen für das Lesen (SF-48). Ein Meyton-Ausdruck hat rund 40 KB und ein bis drei Seiten. Geprüft wird
// zwischen den Schritten von pdf.js gegen eine Uhr; einen Timer gäbe es während eines Schritts nicht.
//
// Was sie NICHT leisten: Dekomprimieren, Metadaten und Glyphen baut pdf.js im selben Prozess, ohne dass
// eine Prüfung dazwischenkommt. Gemessen: ein 3-KB-PDF mit einem riesigen Tj
// 294 MB, ein 128-KB-XMP 1,36 GB, 256 KB Operatoren 21,5 s, ohne dass eine Grenze anschlug. Gegen
// präparierte PDFs hilft nur ein kurzlebiger Kindprozess mit Speichergrenze, der nach der Zeitgrenze
// hart beendet wird; den braucht der Server. Ein Worker-Thread reicht nicht.

export interface PrintoutLimits {
  maxBytes: number
  maxPages: number
  maxTextItems: number
  maxChars: number
  maxParseMs: number
}

export const DEFAULT_LIMITS: Readonly<PrintoutLimits> = Object.freeze({
  maxBytes: 1024 * 1024,
  maxPages: 10,
  maxTextItems: 20_000,
  maxChars: 100_000,
  maxParseMs: 5_000,
})
