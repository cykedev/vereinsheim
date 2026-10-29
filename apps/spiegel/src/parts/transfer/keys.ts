// Die Schlüssel der Übernahme aus Treffsicher ([[spiegel-account-transfer]]): `treffsicher:<Kennung in Treffsicher>` an
// Scheiben (`Card.importKey`), Einträgen, Zielen und Abläufen. Der Ergebnisteil kennt diese Datei nicht, er bekommt den
// Schlüssel vom Aufrufer.

/** Präfix der Schlüssel der Übernahme in Scheiben und Tagebuch */
export const TRANSFER_PREFIX = "treffsicher:"
/** Präfix der Vorschau aus 2c; ein Lauf bricht ab, solange es Zeilen damit gibt */
export const PREVIEW_CARD_PREFIX = "treffsicher:preview-"
export const PREVIEW_DIARY_PREFIX = "preview:"

export const transferKey = (id: string) => `${TRANSFER_PREFIX}${id}`

/** die Kennung aus Treffsicher in einem Schlüssel der Übernahme; null für andere und für die Vorschau */
export function sourceIdOf(key: string | null): string | null {
  if (!key?.startsWith(TRANSFER_PREFIX) || key.startsWith(PREVIEW_CARD_PREFIX)) return null
  return key.slice(TRANSFER_PREFIX.length)
}
