import { getServerSession, type Session } from "next-auth"
import { redirect } from "next/navigation"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * Die Sitzung des angemeldeten Schützen oder null. Prüft gegen die Datenbank, wie Ringwerk: Konto vorhanden und aktiv,
 * `sessionVersion` gleich (Passwortwechsel und Reset beenden ältere Sitzungen); Name und Rolle aus der Datenbank.
 */
export async function getAuthSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, isActive: true, sessionVersion: true },
  })
  if (!user || !user.isActive) return null
  if (session.user.sessionVersion !== user.sessionVersion) return null

  session.user.name = user.name
  session.user.role = user.role
  return session
}

/** Seiten mit Anmeldepflicht: die Sitzung oder Umleitung zur Anmeldung (zweite Schicht hinter `proxy.ts`) */
export async function requireSession(): Promise<Session> {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  return session
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN"
}
