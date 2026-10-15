/** steht für die eigene Herkunft, wenn keine bekannt ist (lokal ohne NEXTAUTH_URL) */
const PLACEHOLDER = "http://spiegel.invalid"

/**
 * Wohin nach der Anmeldung: nur ein Pfad dieser App. NextAuth hängt die ursprüngliche Adresse als `callbackUrl` an,
 * auch als volle URL. Aufgelöst wird wie im Browser (`new URL`), sonst schlüpft „/\t/evil.com“ durch: Der Parser
 * entfernt Tab und Zeilenumbruch, übrig bleibt „//evil.com“ (Open Redirect). Nur dieselbe Herkunft bleibt.
 */
export function safeCallback(raw: string | undefined | null, origin: string | undefined): string {
  if (!raw) return "/"
  let base: URL
  try {
    base = new URL(origin ?? PLACEHOLDER)
  } catch {
    base = new URL(PLACEHOLDER)
  }
  try {
    const url = new URL(raw, base)
    return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : "/"
  } catch {
    return "/"
  }
}
