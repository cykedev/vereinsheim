// Zugangs-Token für den QR-Code auf intern exportierten PDFs (Passwort-Bypass). Rein — kein
// `db`, damit die öffentliche Route und die Actions es ohne Prisma-Import nutzen können.

import { randomUUID, timingSafeEqual } from "node:crypto"

/** Prüft das QR-Token aus `?k=` gegen das gespeicherte Token, ohne Timing-Leck. */
export function hasValidAccessToken(provided: string | null, stored: string | null): boolean {
  if (!provided || !stored) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(stored, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Drei-Wege-Update für `publicAccessToken`:
 * Block nicht gerendert → undefined (Spalte nicht anfassen); Passwort entfernt oder Bypass aus →
 * null; Bypass an → bestehendes Token behalten, außer es fehlt oder soll rotiert werden.
 *
 * Das Entfernen des Passworts löscht das Token mit: sonst machte ein später neu gesetztes Passwort
 * alle Ausdrucke mit dem alten Code still wieder wirksam.
 */
export function resolveAccessTokenUpdate(input: {
  fieldsPresent: boolean
  bypass: boolean
  rotate: boolean
  existing: string | null
  passwordRemoved?: boolean
}): string | null | undefined {
  if (!input.fieldsPresent) return undefined
  if (input.passwordRemoved || !input.bypass) return null
  if (input.existing && !input.rotate) return undefined
  return randomUUID()
}
