import { isCardId } from "@vereinsheim/shot-ui/nav/routes"

import { getAuthSession } from "@/lib/auth-helpers"

// Prüfungen, die jede Server Action auf eigene Scheiben braucht, an einer Stelle (Review, 13. Oktober 2026). Kein
// "use server": Eine solche Datei dürfte nur Actions exportieren.

/** der angemeldete Schütze, der Daten sehen darf; ohne Sitzung oder mit Passwort vom Admin null */
export async function shooterId(): Promise<string | null> {
  const session = await getAuthSession()
  return session && !session.user.mustChangePassword ? session.user.id : null
}

/** eine Kennung einer Scheibe aus dem Browser: Text in der Form erzeugter Ids, nicht länger als 64 Zeichen */
export const isCardIdInput = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && isCardId(value)

/** ein Admin, der handeln darf (eigenes Passwort schon gesetzt); sonst der Grund als Text */
export async function adminActor(): Promise<{ id: string } | { error: string }> {
  const session = await getAuthSession()
  if (!session) return { error: "Du bist nicht mehr angemeldet. Bitte melde dich neu an." }
  if (session.user.role !== "ADMIN") return { error: "Das darf nur ein Admin." }
  if (session.user.mustChangePassword) return { error: "Bitte zuerst das eigene Passwort ändern." }
  return { id: session.user.id }
}
