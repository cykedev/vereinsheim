---
id: pdf-public-urls
type: subsystem
title: "pdf-public-urls"
keywords: [öffentliche PDF, public URL, Veröffentlichung, Webseiten-Verlinkung, publicSlug, öffentlicher Link, PDF-Export, caching, 24h-Cache, Cache-Tag, publicPdfCache, revalidatePublicPdf, bcrypt-Passwort]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Öffentliche PDF-URL (Website-Verlinkung)]]"]
---

**TL;DR** isPublic→publicSlug für /api/public/c/<slug>/pdf (unauth); partieller Unique-Index, optional bcrypt-PW, 24h-Cache (getaggt über die Wettbewerbs-**ID**, nicht über den Slug).

Der Render-Cache (`unstable_cache`, Key `["public-pdf-buffer-v2", competitionId, phaseTag]`) hängt
an `publicPdfCacheTag(competitionId)` aus `lib/competitions/publicPdfCache.ts`. Tag und Key teilen
damit **eine** Identität, und eine Slug-Umbenennung kann den Eintrag nicht verwaisen lassen
(siehe [[public-pdf-cache-tag-orphaning]]). Schreibende Actions invalidieren über
`revalidatePublicPdf(competitionId)` — ohne `isPublic`-Gate, weil der Aufruf ohne Eintrag ein
No-op ist. Die Route selbst ist `force-dynamic` (Passwortprüfung pro Request), hat also keinen
Full-Route-Cache, den ein `revalidatePath` treffen könnte.
