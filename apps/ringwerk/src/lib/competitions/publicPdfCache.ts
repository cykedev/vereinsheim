// Cache-Identität des öffentlichen PDFs. Bewusst ein eigenes Modul: der Tag-Builder ist rein und
// wird von der öffentlichen Route gebraucht, die dafür kein `db`/`zod` aus actions/_shared.ts
// mitziehen soll (gleiche Trennung wie publicSlug.ts ↔ publicSlugQueries.ts).

import { revalidateTag } from "next/cache"

/**
 * Cache-Tag des gerenderten öffentlichen PDFs — aus der **unveränderlichen** Wettbewerbs-ID
 * gebildet, nicht aus dem umbenennbaren `publicSlug`.
 *
 * Der Tag muss an derselben Identität hängen wie der Cache-Key (`competitionId`), sonst verwaist
 * der Eintrag bei einer Slug-Umbenennung unter dem alten Tag und ist gar nicht mehr
 * invalidierbar (siehe vault/incidents/public-pdf-cache-tag-orphaning.md).
 */
export function publicPdfCacheTag(competitionId: string): string {
  return `public-pdf:${competitionId}`
}

/**
 * Invalidiert das gecachte öffentliche PDF eines Wettbewerbs.
 *
 * Aus jeder schreibenden Action aufrufen, die Daten im öffentlichen PDF verändert — Ergebnisse,
 * Serien, Playoff-Duelle, Teilnehmer-Ein-/Austritt, Slug- und Status-Wechsel. Das 24h-Fenster des
 * Render-Caches bleibt bestehen, wird aber bei jeder relevanten Änderung sofort verworfen;
 * anonyme Leser sehen höchstens bis zur nächsten mutierenden Action einen alten Stand.
 *
 * Kein `isPublic`-Gate nötig: existiert unter dem Tag kein Eintrag, ist der Aufruf ein No-op.
 * Genau deshalb ist die frühere DB-Auflösung des Slugs entfallen.
 */
export function revalidatePublicPdf(competitionId: string): void {
  // "max"-Profil: alle Einträge mit diesem Tag sofort verwerfen
  revalidateTag(publicPdfCacheTag(competitionId), "max")
}
