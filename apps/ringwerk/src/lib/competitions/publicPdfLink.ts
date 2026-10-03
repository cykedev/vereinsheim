// Server-only: getPublicPdfLink imports the Prisma client. Do NOT import from Client Components.
// The pure helpers (requestOrigin, buildPublicPdfLink) and the PublicPdfLink type are safe to share.
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { resolveSlug } from "./publicSlugQueries"

export type PublicPdfLink = {
  /** Gedruckter Text — nie mit Token. */
  displayUrl: string
  /** Inhalt des QR-Codes — mit `?k=<token>`, wenn der Passwort-Bypass aktiv ist. */
  qrUrl: string
}

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

/**
 * Link für den QR-Code eines intern exportierten PDFs — oder null, wenn der Wettbewerb nicht
 * veröffentlicht ist oder sein Slug auf einen anderen Wettbewerb auflöst (der QR-Code zeigte
 * sonst auf das PDF des Nachfolgers).
 */
export async function getPublicPdfLink(
  req: NextRequest,
  competitionId: string
): Promise<PublicPdfLink | null> {
  const row = await db.competition.findUnique({
    where: { id: competitionId },
    select: { isPublic: true, publicSlug: true, publicPasswordHash: true, publicAccessToken: true },
  })
  if (!row?.isPublic || !row.publicSlug) return null
  const holder = await resolveSlug(row.publicSlug)
  if (holder?.id !== competitionId) return null
  const origin = requestOrigin(req.headers, req.nextUrl.protocol)
  if (!origin) return null
  return buildPublicPdfLink({
    origin,
    slug: row.publicSlug,
    accessToken: row.publicPasswordHash ? row.publicAccessToken : null,
  })
}
