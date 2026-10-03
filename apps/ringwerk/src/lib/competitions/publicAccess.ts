// Zugangs-Token für den QR-Code auf intern exportierten PDFs (Passwort-Bypass). Rein — kein
// `db`, damit die öffentliche Route und die Actions es ohne Prisma-Import nutzen können.

import { timingSafeEqual } from "node:crypto"

/** Prüft das QR-Token aus `?k=` gegen das gespeicherte Token, ohne Timing-Leck. */
export function hasValidAccessToken(provided: string | null, stored: string | null): boolean {
  if (!provided || !stored) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(stored, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}
