import { revalidatePath, revalidateTag } from "next/cache"
import { db } from "@/lib/db"

// BaseSchema liegt in ./baseSchema; hier re-exportiert, damit Aufrufer weiter
// "./_shared" als stabilen Einstiegspunkt nutzen können.
export { BaseSchema } from "./baseSchema"

export function parseDate(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Datum-Semantik für UPDATES (drei Wege, analog zum publicPasswordHash):
 * 1. Feld gar nicht abgeschickt (null/undefined) -> undefined (Prisma: Spalte nicht anfassen)
 * 2. Feld abgeschickt, aber leer ("")           -> null (bewusst geleert)
 * 3. Feld mit Wert                              -> geparstes Datum
 *
 * Wichtig für bedingt gerenderte Felder: LeagueFieldsSection blendet die Stichtage bei
 * leagueFormat = BEST_OF_SINGLE (und fuer EVENT/SEASON die ganze Sektion) aus. Ausgeblendete
 * Inputs fehlen in der FormData — ohne Fall 1 würde ein Speichern in diesem Zustand
 * gespeicherte Stichtage lautlos löschen.
 */
export function parseDateForUpdate(value: string | null | undefined): Date | null | undefined {
  if (value == null) return undefined
  return parseDate(value)
}

export function revalidateCompetitionPaths(): void {
  revalidatePath("/competitions")
  revalidatePath("/competitions", "layout")
}

export function publicPdfCacheTag(slug: string): string {
  return `public-pdf:${slug}`
}

export function revalidatePublicSlug(slug: string | null | undefined): void {
  if (!slug) return
  // "max" profile: evict all cached entries with this tag immediately
  revalidateTag(publicPdfCacheTag(slug), "max")
}

/**
 * Invalidate the public PDF cache for the given competition, if it currently holds an active
 * public slug. No-op for competitions that are not published.
 *
 * Call this from any write action that mutates data appearing in the public PDF — results,
 * series, playoff duels, participant enrollment/withdrawal, etc. The 24h render cache stays in
 * place but is forcibly evicted on each meaningful change, so anonymous readers see a stale
 * view at most until the next mutating action.
 */
export async function revalidatePublicSlugForCompetition(competitionId: string): Promise<void> {
  const c = await db.competition.findUnique({
    where: { id: competitionId },
    select: { isPublic: true, publicSlug: true },
  })
  if (c?.isPublic && c.publicSlug) {
    revalidatePublicSlug(c.publicSlug)
  }
}
