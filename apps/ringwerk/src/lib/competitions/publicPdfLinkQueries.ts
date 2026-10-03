// Server-only: this module imports the Prisma client. Do NOT import from Client Components.
// The pure helpers (requestOrigin, buildPublicPdfLink) live in ./publicPdfLink.ts.
import type { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { buildPublicPdfLink, requestOrigin, type PublicPdfLink } from "./publicPdfLink"
import { resolveSlug } from "./publicSlugQueries"

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
