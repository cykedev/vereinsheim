import { getServerSession, type Session } from "next-auth"
import { redirect } from "next/navigation"
import { cache } from "react"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Die Sitzung des angemeldeten Schützen oder null. Prüft gegen die Datenbank, wie Ringwerk: Konto vorhanden und aktiv,
 * `sessionVersion` gleich (Passwortwechsel, Reset, neue Rolle und Status beenden ältere Sitzungen); Name, E-Mail und
 * Rolle aus der Datenbank. Einmal je Anfrage (`cache`), Layout und Seite teilen das Ergebnis.
 */
export const getAuthSession = cache(async (): Promise<Session | null> => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      mustChangePassword: true,
    },
  })
  if (!user || !user.isActive) return null
  if (session.user.sessionVersion !== user.sessionVersion) return null

  session.user.name = user.name
  session.user.email = user.email
  session.user.role = user.role
  session.user.mustChangePassword = user.mustChangePassword
  return session
})

/** die Seite, auf der ein Passwort vom Admin ersetzt wird */
export const PASSWORD_PAGE = "/profile/password"

/**
 * Seiten mit Anmeldepflicht: die Sitzung oder Umleitung zur Anmeldung (zweite Schicht hinter `proxy.ts`). Mit einem
 * Passwort vom Admin geht es erst zur Passwortseite, bevor eine Seite Daten lädt; nur sie selbst ruft mit
 * `passwordChange: true`.
 */
export async function requireSession(options: { passwordChange?: boolean } = {}): Promise<Session> {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  if (session.user.mustChangePassword && !options.passwordChange) redirect(PASSWORD_PAGE)
  return session
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN"
}

/**
 * Admin-Seiten und ihre Abfragen: die Sitzung eines Admins, sonst zur Anmeldung bzw. zum Start. Jede Seite und jede
 * Abfrage ruft das selbst: Ein Layout schützt die Daten einer Seite nicht (Next, bei Navigation im Client läuft es
 * nicht erneut).
 */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession()
  if (!isAdmin(session.user.role)) redirect("/")
  return session
}
