// Pure helpers for the public PDF link on internal exports — safe to share (no Prisma import).
// The DB-backed lookup lives in ./publicPdfLinkQueries.ts (same split as publicSlug ↔ publicSlugQueries).

export type PublicPdfLink = {
  /** Gedruckter Text — nie mit Token. */
  displayUrl: string
  /** Inhalt des QR-Codes — mit `?k=<token>`, wenn der Passwort-Bypass aktiv ist. */
  qrUrl: string
}

// Hostname[:Port]. IPv6-Literale (`[::1]:3000`) fallen bewusst durch → schlicht kein QR-Code.
const HOST_REGEX = /^[a-z0-9.-]+(:\d{1,5})?$/i

/** Origin des Requests hinter Caddy; null bei unplausiblem Host. */
export function requestOrigin(headers: Headers, fallbackProtocol: string): string | null {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim()
  if (!host || !HOST_REGEX.test(host)) return null
  const rawProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? fallbackProtocol
  const proto = rawProto.replace(/:$/, "")
  if (proto !== "http" && proto !== "https") return null
  return `${proto}://${host}`
}

export function buildPublicPdfLink(input: {
  origin: string
  slug: string
  /** Nur übergeben, wenn ein Passwort gesetzt ist UND der Bypass aktiv ist. */
  accessToken: string | null
}): PublicPdfLink {
  const displayUrl = `${input.origin}/api/public/c/${input.slug}/pdf`
  const qrUrl = input.accessToken
    ? `${displayUrl}?k=${encodeURIComponent(input.accessToken)}`
    : displayUrl
  return { displayUrl, qrUrl }
}
