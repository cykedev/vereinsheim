/**
 * Fehler mit einer Meldung, die der Nutzer sehen darf. Grenzt die eigenen Grenz- und Formatmeldungen
 * von pdf.js-Interna ab: Nur dieser Fehler wird durchgereicht, damit aus einem fremden PDF nichts
 * Internes nach außen gelangt.
 */
export class MeytonPdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MeytonPdfError"
  }
}
