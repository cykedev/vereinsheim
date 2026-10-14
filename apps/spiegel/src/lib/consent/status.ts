// Zustände einer Zustimmung (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D1): der Schütze stimmt zu, ein Admin
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
 * das Einlesen nehmen ihn beide (Review: eine Stelle statt zwei Kopien).
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
      return "wartet auf den Admin"
    case "active":
      return confirmedAt ? `aktiv seit ${confirmedAt}` : "aktiv"
    case "rejected":
      return "abgelehnt"
    case "returned":
      return "zurück beim Admin"
  }
}

/** was der Schütze mit seiner Zustimmung tun kann: widerrufen, solange sie zählt oder zählen kann, sonst entfernen */
export function ownerActionOf(status: ConsentStatus): "revoke" | "remove" {
  return status === "rejected" ? "remove" : "revoke"
}

/** wartet auf eine Entscheidung des Admins */
export function isOpenConsent(status: ConsentStatus): boolean {
  return status === "requested" || status === "returned"
}

/** SportpassIDs je Konto: SF-39 braucht mehrere (neuer Ausweis), mehr als drei ist kein Anwendungsfall */
export const MAX_CONSENTS_PER_ACCOUNT = 3

/**
 * Der Stand des Sportpasses eines Kontos in einem Wort für die Kontenliste (P2c, D5): Was auf den Admin wartet, geht
 * vor; dann aktiv, dann abgelehnt; ohne Zustimmung „kein Sportpass“.
 */
export function sportpassSummary(statuses: readonly ConsentStatus[]): string {
  if (statuses.includes("requested")) return "Sportpass wartet auf dich"
  if (statuses.includes("returned")) return "Sportpass zurück beim Admin"
  if (statuses.includes("active")) return "Sportpass aktiv"
  if (statuses.includes("rejected")) return "Sportpass abgelehnt"
  return "kein Sportpass"
}
