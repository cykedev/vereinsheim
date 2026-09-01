/**
 * Fehler mit einer Meldung, die dem Nutzer direkt gezeigt werden darf.
 *
 * Grenzt unsere eigenen Limit-/Formatmeldungen von pdf.js-Interna ab: nur
 * MeytonPdfError wird durchgereicht, alles andere bekommt die generische
 * Meldung. So erfaehrt der Nutzer, *welche* Grenze gerissen hat, ohne dass
 * Parser-Interna aus untrusted Input nach aussen gelangen.
 */
export class MeytonPdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MeytonPdfError"
  }
}
