// Ein Konto ohne E-Mail benennen: sha256 über die E-Mail in Kleinbuchstaben ohne Rand, wie in den SQL-Dateien des
// Betriebs (`encode(sha256(convert_to(lower(btrim(email)), 'UTF8')), 'hex')`). So verbindet `vereinsheim transfer status`
// die Zuordnungsdatei mit Treffsicher und Spiegel, ohne dass eine E-Mail über den Draht geht; Ausgabe, Logs und Namen
// der Berichte tragen nur die ersten acht Zeichen.

import { createHash } from "node:crypto"

/** sha256 hex (64 Zeichen) der normalisierten E-Mail */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex")
}

/** die ersten acht Zeichen von `emailHash`, für Ausgabe, Logs und Berichte */
export function accountHash(email: string): string {
  return emailHash(email).slice(0, 8)
}
