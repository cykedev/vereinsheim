/** Fester Grund eines Fehlers; ein Aufrufer, etwa ein Kindprozess, gibt nur ihn weiter. */
export const MEYTON_PDF_ERROR_CODES = [
  "tooLarge",
  "notPdf",
  "tooManyPages",
  "tooMuchText",
  "timeout",
  "unreadable",
] as const

export type MeytonPdfErrorCode = (typeof MEYTON_PDF_ERROR_CODES)[number]

/**
 * Fehler mit einer Meldung, die der Nutzer sehen darf. Grenzt die eigenen Grenz- und Formatmeldungen
 * von pdf.js-Interna ab: Nur dieser Fehler wird durchgereicht, damit aus einem fremden PDF nichts
 * Internes nach außen gelangt.
 */
export class MeytonPdfError extends Error {
  readonly code: MeytonPdfErrorCode

  /** `cause` behält den ursprünglichen Fehler fürs Server-Log; die Meldung bleibt zeigbar. */
  constructor(message: string, options?: { cause?: unknown; code?: MeytonPdfErrorCode }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause })
    this.name = "MeytonPdfError"
    this.code = options?.code ?? "unreadable"
  }
}
