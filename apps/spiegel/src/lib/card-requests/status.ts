import type { CardRequestStatus } from "@/generated/prisma/client"

// Welche Aufträge per ID der Schütze im Profil entfernen kann: eine reine Regel für Liste und Abfrage.

/** Zustände, in denen ein Auftrag ohne Erfolg endete */
export const REMOVABLE_STATUSES = [
  "missing",
  "mismatch",
  "expired",
  "held",
  "taken",
  "withdrawn",
] as const satisfies readonly CardRequestStatus[]

/**
 * beendet und ohne Scheibe: Der Schütze kann den Auftrag aus der Liste entfernen. Hängt eine Scheibe daran, bleibt er,
 * auch wenn er ohne Erfolg endete (etwa zurückgezogen, während die geholte Scheibe im Papierkorb lag, oder gehalten,
 * nachdem schon Stände kamen); `closeRequest` lässt die Scheibe stehen.
 */
export const isRemovable = (status: CardRequestStatus, hasCard: boolean): boolean =>
  !hasCard && (REMOVABLE_STATUSES as readonly CardRequestStatus[]).includes(status)
