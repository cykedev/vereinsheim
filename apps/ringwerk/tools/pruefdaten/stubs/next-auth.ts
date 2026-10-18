// Stellvertreter für `next-auth` im Werkzeug: `getServerSession` liefert die Sitzung, die `build.ts` vor jeder Action
// setzt. `getAuthSession` aus `@/lib/auth-helpers` läuft unverändert und prüft das Konto in der Datenbank (aktiv,
// Rolle, Sitzungsversion) wie in der App.

import type { Session } from "next-auth"

const state = globalThis as unknown as { __pruefSession?: Session | null }

export function setPruefSession(session: Session | null): void {
  state.__pruefSession = session
}

export async function getServerSession(): Promise<Session | null> {
  return state.__pruefSession ?? null
}
