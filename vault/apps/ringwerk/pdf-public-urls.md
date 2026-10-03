---
id: pdf-public-urls
type: subsystem
title: "pdf-public-urls"
keywords: [öffentliche PDF, public URL, Veröffentlichung, Webseiten-Verlinkung, publicSlug, öffentlicher Link, PDF-Export, caching, 24h-Cache, Cache-Tag, publicPdfCache, revalidatePublicPdf, bcrypt-Passwort, QR-Code, Aushang, Zugangscode, publicAccessToken, Passwort-Bypass]
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

## QR-Code auf internen Exporten (seit 2026-10-03)

Die **intern** heruntergeladenen Haupt-PDFs (`/api/competitions/[id]/pdf/{schedule,playoffs,ranking,
standings}`) eines veröffentlichten Wettbewerbs tragen rechts im Seitenkopf (Seite 1) einen QR-Code
und die öffentliche URL. Gedacht ist das für Aushänge im Vereinsheim. Die Kopfspalte rendert
`lib/pdf/HeaderMeta.tsx`, den Vektorpfad erzeugt `lib/pdf/qrMatrix.ts`, den Link baut
`lib/competitions/publicPdfLink.ts`.

- **Domain aus dem Request** (`x-forwarded-host`/`host`, `x-forwarded-proto`, Host-Regex). Ein
  unplausibler Host bedeutet: kein QR-Code.
- **Nur wenn der Slug auf diesen Wettbewerb auflöst** (`resolveSlug(slug)?.id === id`). Sonst zeigte
  der Code eines abgeschlossenen Wettbewerbs auf das PDF seines Nachfolgers.
- **Passwort-Bypass:** `Competition.publicAccessToken` (UUID, Klartext, `@unique`). Gesetzt heißt:
  Der QR-Code enthält `?k=<token>`, und die öffentliche Route lässt bei passendem Token
  (`hasValidAccessToken`, `timingSafeEqual`) die Basic-Auth weg. Ein falsches oder fehlendes Token
  führt in den normalen 401-Pfad. Klartext, weil der Export das Token in den QR-Code schreiben
  muss. Es geht nie an den Client (`CompetitionDetail.hasPublicAccessToken`). „Neuen Zugangscode
  erzeugen“ rotiert es und macht alte Ausdrucke wirkungslos.
- **Gedruckter Text = URL ohne Token**, nur der QR-Code trägt es.
- **Öffentliche PDFs tragen nie einen QR-Code.** Die Builder der öffentlichen Route übergeben kein
  `publicLink` (für alle vier Phasen getestet). Deshalb hängen Cache-Key und Tag weder vom Host noch
  vom Token ab.
- **Formular:** Die Checkboxen stehen im bedingt gerenderten `isPublic`-Block. Der Hidden-Marker
  `publicAccessFields=1` sorgt für die Drei-Wege-Semantik (`resolveAccessTokenUpdate`): Ist der
  Block nicht gerendert, bleibt das Token unberührt.

