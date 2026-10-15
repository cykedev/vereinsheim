// Zustände einer Zustimmung: der Schütze stimmt zu, ein Admin
// bestätigt oder lehnt ab, nach „Nicht meine“ bei der ersten Scheibe geht sie an ihn zurück. Nur `active` lädt die
// Brücke hoch (`GET /state` und das Einlesen filtern mit `ACTIVE_CONSENT`). Reine Funktionen.

export type ConsentStatus = "requested" | "active" | "rejected" | "returned"

export interface ConsentDecisions {
  confirmedAt: Date | null
  rejectedAt: Date | null
  returnedAt: Date | null
}

/**
 * Der Filter für `active` in Abfragen, dieselbe Regel wie `consentStatus`: bestätigt und nicht abgelehnt. `GET /state` und
 * das Einlesen nehmen ihn beide (eine Stelle statt zwei Kopien).
 */
export const ACTIVE_CONSENT = { confirmedAt: { not: null }, rejectedAt: null } as const

/** Vorrang: abgelehnt vor bestätigt vor zurückgegeben; ohne Entscheidung wartet sie */
export function consentStatus(row: ConsentDecisions): ConsentStatus {
  if (row.rejectedAt) return "rejected"
  if (row.confirmedAt) return "active"
  if (row.returnedAt) return "returned"
  return "requested"
}

/** in Worten; `confirmedAt` schon formatiert (Zone der Anzeige) */
export function consentStatusText(status: ConsentStatus, confirmedAt: string | null): string {
  switch (status) {
    case "requested":
      return "wartet auf Prüfung durch einen Admin"
    case "active":
      return confirmedAt ? `aktiv seit ${confirmedAt}` : "aktiv"
    case "rejected":
      return "von einem Admin abgelehnt"
    case "returned":
      return "wird nach „nicht meine“ wieder geprüft"
  }
}

/** was der Schütze mit seiner Zustimmung tun kann: widerrufen, solange sie zählt oder zählen kann, sonst entfernen */
export function ownerActionOf(status: ConsentStatus): "revoke" | "remove" {
  return status === "rejected" ? "remove" : "revoke"
}

/**
 * Es gibt nur Nummern, deren Knopf „Entfernen“ heißt (abgelehnte): Profil und Action sagen dann „entferne“ statt
 * „widerrufe“. Eine Regel für beide ([[conventions]] §9)
 */
export const onlyRemovable = (statuses: readonly ConsentStatus[]) =>
  statuses.length > 0 && statuses.every((status) => ownerActionOf(status) === "remove")

/** wartet auf eine Entscheidung des Admins */
export function isOpenConsent(status: ConsentStatus): boolean {
  return status === "requested" || status === "returned"
}

/**
 * Sportpassnummern je Konto: eine. Für einen neuen Ausweis (SF-39) widerruft der Schütze die alte Nummer und trägt
 * die neue ein, die Scheiben bleiben. Konten, die schon mehrere haben, bleiben, wie sie sind
 */
export const MAX_CONSENTS_PER_ACCOUNT = 1

/**
 * Der Stand des Sportpasses eines Kontos in einem Wort für die Kontenliste: Was auf den Admin wartet, geht
 * vor; dann aktiv, dann abgelehnt; ohne Zustimmung „kein Sportpass“.
 */
export function sportpassSummary(statuses: readonly ConsentStatus[]): string {
  if (statuses.includes("requested")) return "Sportpass: Nummer prüfen"
  if (statuses.includes("returned")) return "Sportpass: wieder prüfen"
  if (statuses.includes("active")) return "Sportpass aktiv"
  if (statuses.includes("rejected")) return "Sportpass abgelehnt"
  return "kein Sportpass"
}
