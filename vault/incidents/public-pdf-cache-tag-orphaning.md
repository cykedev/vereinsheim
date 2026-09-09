---
id: public-pdf-cache-tag-orphaning
type: incident
title: "Öffentliches PDF: Cache-Tag am Slug verwaist bei Umbenennung"
keywords: [unstable_cache, revalidateTag, Cache-Tag, verwaist, orphaned tag, stale PDF, öffentlicher Slug, publicPdfCacheTag, revalidatePublicSlug, SQL am Cache vorbei, no-store]
tags: [incident, ringwerk]
relates_to: ["[[ringwerk]]", "[[pdf-public-urls]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-09-09 (ringwerk): Die öffentliche PDF-Route cacht via `unstable_cache` mit der
**Wettbewerbs-ID als Key**, aber dem **Slug als Tag** (`publicPdfCacheTag(slug)` in
`lib/competitions/actions/_shared.ts`). Daraus folgen zwei Dinge, die beim Verifizieren der
Saison-Sortierung aufgefallen sind:

1. Eine Datenänderung **per SQL** (ohne Server-Action) invalidiert nichts — die Route liefert bis zu
   24 h das alte PDF. Das sah wie ein Fehler im Feature aus und war einer in der Prüfmethode.
2. Wird der **Slug geändert**, verwaist der Eintrag unter dem alten Tag: der neue Slug bildet einen
   anderen Tag, der Eintrag hängt aber weiter am alten und ist damit **gar nicht mehr**
   invalidierbar. Über die Action fällt das nicht auf, weil `update.ts` konservativ den alten **und**
   den neuen Slug revalidiert — per SQL umgeht man genau diesen Schutz.

**Offen (Empfehlung, nicht umgesetzt):** den Tag aus der unveränderlichen Wettbewerbs-ID bilden
(`publicPdfCacheTag(competitionId)`), dann kann eine Umbenennung nichts verwaisen lassen. Eigener
Change, weil die Route + `revalidatePublicSlug`/`revalidatePublicSlugForCompetition` betroffen sind.
Die Prüf-Regel („über die Action oder die `no-store`-Route verifizieren") steht in
[[ringwerk-code-conventions]].
