/**
 * Wohin nach der Anmeldung: nur ein Pfad dieser App. NextAuth hängt die ursprüngliche Adresse als `callbackUrl` an,
 * auch als volle URL; eine fremde Herkunft oder `//…` würde nach außen umleiten (Open Redirect).
 */
export function safeCallback(raw: string | undefined | null, origin: string | undefined): string {
  if (!raw) return "/"
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw
  try {
    const url = new URL(raw)
    if (origin && url.origin === new URL(origin).origin)
      return `${url.pathname}${url.search}${url.hash}`
  } catch {
    // keine gültige URL
  }
  return "/"
}
