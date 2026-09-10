---
id: public-pdf-cache-tag-orphaning
type: incident
title: "Öffentliches PDF: Cache-Tag am Slug verwaist bei Umbenennung"
keywords: [unstable_cache, revalidateTag, Cache-Tag, verwaist, orphaned tag, stale PDF, öffentlicher Slug, publicPdfCacheTag, publicPdfCache, revalidatePublicPdf, revalidatePublicSlug, SQL am Cache vorbei, no-store]
tags: [incident, ringwerk]
relates_to: ["[[ringwerk]]", "[[pdf-public-urls]]", "[[ringwerk-code-conventions]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-09-09 (ringwerk), **Punkt 2 behoben am 2026-09-10**: Die öffentliche PDF-Route
cachte via `unstable_cache` mit der **Wettbewerbs-ID als Key**, aber dem **Slug als Tag**
(`publicPdfCacheTag(slug)`, damals in `lib/competitions/actions/_shared.ts`). Daraus folgten zwei
Dinge, die beim Verifizieren der Saison-Sortierung aufgefallen sind:

1. Eine Datenänderung **per SQL** (ohne Server-Action) invalidiert nichts — die Route liefert bis zu
   24 h das alte PDF. Das sah wie ein Fehler im Feature aus und war einer in der Prüfmethode.
   (Gilt weiter, siehe unten.)
2. Wurde der **Slug geändert**, verwaiste der Eintrag unter dem alten Tag: der neue Slug bildete
   einen anderen Tag, der Eintrag hing aber weiter am alten und war damit **gar nicht mehr**
   invalidierbar. Über die Action fiel das nicht auf, weil `update.ts` konservativ den alten **und**
   den neuen Slug revalidierte — per SQL umging man genau diesen Schutz. (Behoben, siehe unten.)

**Behoben (2026-09-10)** — Punkt 2 ist strukturell weg: der Tag kommt aus der unveränderlichen
Wettbewerbs-ID, also aus derselben Identität wie der Cache-Key.

- `publicPdfCacheTag(competitionId)` + `revalidatePublicPdf(competitionId)` liegen in
  `lib/competitions/publicPdfCache.ts` — ein eigenes Modul, damit die öffentliche Route den reinen
  Tag-Builder ohne `db`/`zod` aus `actions/_shared.ts` importieren kann (gleiche Trennung wie
  `publicSlug.ts` ↔ `publicSlugQueries.ts`).
- `revalidatePublicSlug` **und** `revalidatePublicSlugForCompetition` sind in dieses eine
  `revalidatePublicPdf(competitionId)` verschmolzen. Die DB-Auflösung Wettbewerb→Slug ist entfallen:
  alle 11 Aufrufer hatten die ID schon zur Hand, die Query pro Mutation war reiner Overhead. Das
  `isPublic`-Gate fällt mit weg — ohne Eintrag unter dem Tag ist der Aufruf ein No-op. Nebenbei
  wurden `revalidateEventPaths`/`revalidateSeasonPaths`/`revalidateCompetitionParticipantPaths`
  synchron (die Slug-Query war ihr einziges `await`).
- `update.ts` braucht das konservative Revalidieren von altem **und** neuem Slug nicht mehr — das
  war nur der Workaround für genau diesen Bug.
- Der Cache-**Key**-Präfix wurde einmalig mitgezogen (`public-pdf-buffer` → `…-v2`). Next speichert
  die Tags **mit** dem Eintrag: ohne Key-Bump hätten die vor dem Deploy geschriebenen Einträge den
  restlichen 24h-Lauf unter dem alten Slug-Tag überlebt und wären in dieser Zeit weiter nicht
  invalidierbar gewesen — der Bug hätte sich also über den Fix hinweg selbst verlängert.
- Kein zusätzliches `revalidatePath` nötig: die Route ist `dynamic = "force-dynamic"` (die
  Passwortprüfung muss pro Request laufen), es gibt also keinen Full-Route-/ISR-Cache über den
  Slug-Pfad. Der Tag deckt den einzigen vorhandenen Cache vollständig ab.
- Festgehalten in `api/public/c/[slug]/pdf/route.test.ts` („render cache identity"): der Tag trägt
  die ID und nicht den Slug, er bleibt über eine Umbenennung identisch, und die vier PDF-Phasen
  bekommen getrennte Keys, hängen aber an dem einen Tag.

**Punkt 1 bleibt gültig** und ist kein Bug, sondern eine Eigenschaft von `unstable_cache`: eine
Änderung per SQL läuft an jeder Invalidierung vorbei. Die Prüf-Regel dafür („über die Action oder
die `no-store`-Route verifizieren, nicht per `psql`") steht in [[ringwerk-code-conventions]] — sie
war hier der eigentliche Stolperstein, weil sie einen intakten Feature-Stand wie einen Fehler
aussehen ließ.
