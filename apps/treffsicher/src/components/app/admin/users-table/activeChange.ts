/** was ein Klick auf „Deaktivieren“ oder „Aktivieren“ auslöst */
export type ActiveChange<U> =
  { kind: "confirm"; user: U } | { kind: "run"; userId: string; isActive: boolean }

/** Deaktivieren fragt erst nach, Aktivieren läuft sofort (es hat keine Folgen außer der Anmeldung) */
export function requestActiveChange<U extends { id: string }>(
  user: U,
  nextIsActive: boolean
): ActiveChange<U> {
  return nextIsActive ? { kind: "run", userId: user.id, isActive: true } : { kind: "confirm", user }
}

/** die Änderung, die die Bestätigung auslöst: das gewählte Konto wird deaktiviert; ohne Wahl nichts */
export function confirmedDeactivation(
  chosen: { id: string } | null
): { userId: string; isActive: false } | null {
  return chosen ? { userId: chosen.id, isActive: false } : null
}
