// Grenzen gegen präparierte PDFs (SF-48). Ein Meyton-Ausdruck hat rund 40 KB und ein bis drei Seiten;
// in Treffsicher belegte ein 3,2-MB-PDF 665 MB Speicher. Alle Grenzen greifen während des Parsens:
// Ein präpariertes PDF blockiert den Event-Loop, ein Timer würde dann gar nicht feuern.

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
