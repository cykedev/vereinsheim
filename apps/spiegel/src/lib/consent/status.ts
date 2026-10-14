// Zustände einer Zustimmung (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D1): der Schütze stimmt zu, ein Admin
// bestätigt oder lehnt ab, nach „Nicht meine“ bei der ersten Scheibe geht sie an ihn zurück. Nur `active` lädt die
// Brücke hoch (`GET /state` und das Einlesen filtern auf `confirmedAt`). Reine Funktionen.

export type ConsentStatus = "requested" | "active" | "rejected" | "returned"

export interface ConsentDecisions {
  confirmedAt: Date | null
  rejectedAt: Date | null
  returnedAt: Date | null
}

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
