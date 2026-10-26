import type { CardRequestStatus } from "@/generated/prisma/client"

// Welche Aufträge per ID der Schütze im Profil entfernen kann: eine reine Regel für Liste und Abfrage.

/** beendet ohne Scheibe: Der Schütze kann den Auftrag aus der Liste entfernen. Mit Scheibe ist er `open` oder `done` */
export const REMOVABLE_STATUSES = [
  "missing",
  "mismatch",
  "expired",
  "held",
  "taken",
  "withdrawn",
] as const satisfies readonly CardRequestStatus[]

export const isRemovable = (status: CardRequestStatus): boolean =>
  (REMOVABLE_STATUSES as readonly CardRequestStatus[]).includes(status)
