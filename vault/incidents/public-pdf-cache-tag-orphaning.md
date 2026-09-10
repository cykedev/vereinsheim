---
id: public-pdf-cache-tag-orphaning
type: incident
title: "Öffentliches PDF: Cache-Tag am Slug verwaist bei Umbenennung"
keywords: [unstable_cache, revalidateTag, updateTag, stale-while-revalidate, max-Profil, Cache-Tag, verwaist, orphaned tag, stale PDF, öffentlicher Slug, publicPdfCacheTag, publicPdfCache, revalidatePublicPdf, revalidatePublicSlug, SQL am Cache vorbei, no-store]
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
- **Kein** Key-Bump nötig — im Review korrigiert. Ein zwischenzeitliches `…-v2` beruhte auf der
  Annahme, Next prüfe die **mit dem Eintrag gespeicherten** Tags; das ist falsch. Für
  `unstable_cache`-Einträge (Kind `FETCH`) bildet Next `combinedTags` aus `ctx.tags`/`ctx.softTags`,
  also den **zur Lesezeit** übergebenen Tags (`incremental-cache/index.js` und
  `file-system-cache.js`). Ein vor dem Deploy geschriebener Eintrag wird deshalb gegen den *neuen*
  ID-Tag geprüft und ist normal invalidierbar. In Produktion überlebt ohnehin nichts: `app-ringwerk`
  hat in `compose.yml` kein Volume, `.next/cache` und das In-Memory-`tagsManifest` sterben mit dem
  Container beim Deploy. Der Key bleibt daher `public-pdf-buffer` — ein Bump hätte nur einen
  kalten Render pro Wettbewerb erzwungen, ohne Gegenwert.
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

## Beim Verifizieren zusätzlich gefunden: `"max"` ist stale-while-revalidate

Der Kommentar im Altcode („`max`-Profil: alle Einträge mit diesem Tag **sofort** verwerfen") war
falsch, und die Fehlannahme steckt in `revalidateTag(tag, "max")` selbst. Next 16 behandelt das
zweite Argument als `cacheLife`-Profil; `"max"` ist die **längste** Lebensdauer. Der Effekt ist
stale-while-revalidate: der **erste** Leser nach einer Änderung bekommt noch das alte PDF, erst der
nächste das neue. Nur `updateTag(tag)` expiriert sofort (Next-Quelle:
`updateTag uses immediate expiration (no profile)`), gilt aber ausschließlich innerhalb einer
Server Action — in einem Route Handler wirft es.

Am 2026-09-10 im Dev-Server A/B gemessen (Details in
`reports/2026-09-10-public-pdf-cache-tag-by-id.md`):

| Variante | 1. Abruf nach der Action | 2. Abruf |
| -------- | ------------------------ | -------- |
| `revalidateTag(tag, "max")` (Ist-Stand) | alter Stand (22 ms, Cache-Treffer) | neuer Stand |
| `updateTag(tag)` | **neuer Stand** (118 ms, Neu-Render) | neuer Stand |

### Weitere Invalidierungs-Lücken (im Review gefunden, bewusst nicht in diesem Change)

Zwei schreibende Pfade verändern Inhalte des öffentlichen PDFs, ohne es zu invalidieren — beide
**vor** diesem Change schon so, deshalb eigener Fix:

- `lib/matchups/actions.ts` `generateCompetitionSchedule` löscht und erzeugt die PENDING-Paarungen
  neu und revalidiert nur `/schedule` + `/participants`. Das Liga-PDF **ist** Spielplan + Tabelle,
  ein neu erzeugter Spielplan bleibt also bis zu 24 h öffentlich alt. Die `competitionId` liegt
  vor, der Fix ist ein `revalidatePublicPdf(competitionId)` neben den beiden `revalidatePath`.
- `lib/participants/crud.ts` `updateParticipant` benennt einen Schützen um, dessen Name in **jedem**
  öffentlichen PDF steht. Hier bräuchte es zuerst eine Abfrage der betroffenen Wettbewerbe.

**Offen:** ob `revalidatePublicPdf` auf `updateTag` umgestellt wird. Dagegen spricht nichts
Technisches (alle Aufrufer sind Server Actions), aber es ändert das Verhalten für **alle** Leser
der öffentlichen URL und ist damit ein eigener Change, keine Beigabe zum Tag-Umbau. Bis dahin
gilt: eine Änderung ist ab dem **zweiten** Abruf öffentlich sichtbar. Wer das prüft und nur einmal
abruft, hält den intakten Zustand für kaputt — dieselbe Falle wie bei Punkt 1, eine Ebene tiefer.
