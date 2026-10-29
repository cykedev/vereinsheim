// Regeln für ein Konto, das nach Spiegel umgezogen ist ([[adr-033]], Stufe 3). Rein: Server und Seiten ziehen
// dieselben Prädikate, damit Knopf und Ablehnung nicht auseinanderlaufen.

/** Adresse von Spiegel außerhalb von Produktion, wenn `SPIEGEL_URL` fehlt (Dev-Server von Spiegel) */
export const DEV_SPIEGEL_URL = "http://localhost:3002"

/**
 * Darf das Konto diese Disziplin anlegen oder ändern? Ein umgezogenes Konto ändert keine eigenen Disziplinen mehr;
 * ein umgezogener Admin pflegt weiter die Disziplinen der Anlage, solange andere Konten in Treffsicher arbeiten.
 */
export function disciplineWritable(
  user: { moved: boolean; isAdmin: boolean },
  discipline: { isSystem: boolean }
): boolean {
  return !user.moved || (user.isAdmin && discipline.isSystem)
}

/**
 * Ziel des Knopfs „Zu Spiegel“: die Wurzel (`origin`) einer gültigen `http:`- oder `https:`-Adresse. Fehlt sie oder
 * ist sie ungültig, gilt außerhalb von Produktion der Dev-Server von Spiegel; in Produktion `null`, dann zeigt
 * Treffsicher keinen Knopf statt eines toten Links.
 */
export function spiegelUrl(value: string | undefined, production: boolean): string | null {
  const fallback = production ? null : DEV_SPIEGEL_URL
  if (!value) return fallback
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback
    return url.origin
  } catch {
    return fallback
  }
}
