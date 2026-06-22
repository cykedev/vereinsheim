// Server-only: this module imports the Prisma client. Do NOT import from Client Components.
// Pure helpers (slugify, SLUG_REGEX) live in ./publicSlug.ts and are safe to share.
import type { Competition } from "@/generated/prisma/client"
import { db } from "@/lib/db"

/**
 * Resolve a public slug to a Competition.
 * 1. Prefer the ACTIVE+isPublic claimant if any.
 * 2. Otherwise fall back to the most recently created (createdAt DESC) COMPLETED/ARCHIVED+isPublic holder.
 * 3. Return null if no isPublic competition has this slug.
 */
export async function resolveSlug(slug: string): Promise<Competition | null> {
  const active = await db.competition.findFirst({
    where: { publicSlug: slug, isPublic: true, status: "ACTIVE" },
  })
  if (active) return active

  return db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: { in: ["COMPLETED", "ARCHIVED"] },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Check whether another ACTIVE+isPublic competition already holds this slug.
 * `excludeId` is the competition currently being edited (excluded from the check).
 * Returns { id, name } of the conflicting competition, or null if none.
 */
export async function findActiveSlugConflict(
  slug: string,
  excludeId: string | null
): Promise<{ id: string; name: string } | null> {
  const conflict = await db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: "ACTIVE",
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  })
  return conflict
}
