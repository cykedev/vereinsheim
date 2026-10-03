# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-09-23 (2. Lauf) -->
<!-- 2026-09-23 (2): 2 Einträge (Best-of-Playoff-Setzung) — Charakterisierungstests unterscheidungsfähig bauen → vault/conventions.md §9; Commit trotz rotem Gate (`;` statt `&&`) → natives Auto-Memory + ENFORCE-Vorschlag (pre-commit-Gate) beim User; Provenance → vault/incidents/best-of-playoff-seeding-round-robin-table. -->
<!-- 2026-09-23: 5 Einträge konsolidiert — Responsive-je-Modus + geteilte Plätze/Podium → ringwerk-ui-patterns (Tabellen & Ranking); Fließkomma-Gleichheit (sameScore) → ringwerk-code-conventions (Wertung & Ranking), per Test erzwungen; Datenlage vor Sichtprüfung → vault/conventions.md §9; jsdom-Eintrag archiviert (steht in §9); docker-exec-stdin → natives Auto-Memory. ENFORCE-Vorschlag (/validate-Skill: Datenlage-Schritt) liegt beim User. -->
<!-- 2026-09-09: 5 Einträge (Saison-Sortierung) konsolidiert — Regeln → vault/conventions.md §9, ringwerk-code-conventions (Next.js & Caching), ringwerk-ui-patterns (Tabellen & Ranking); Provenance → vault/incidents/{dev-shadow-db-createdb, public-pdf-cache-tag-orphaning, next-dist-dir-shared-with-dev-server}; zwei ENFORCE-Vorschläge liegen beim User. -->
<!-- Alle bisherigen Einträge konsolidiert: Regeln → docs/ (code-conventions, ui-patterns, data-model, shared-conventions); Incidents/State → Memory-Graph (.claude/graph-captured.mjs); ops-lokales → natives Auto-Memory. Langzeit-Gedächtnis ist der Memory-Graph, nicht dieser Buffer. -->

## Offen

| Datum      | Was schiefgelaufen ist oder aufgefallen ist                                                                                                                                                                                  | Die Regel die es verhindert                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-03 | Der QR-Kopf schob das Achtelfinal-Bracket auf eine eigene Seite, und ein langer Titel lief in die URL. Die Validierung hatte nur ein 2-Halbfinal-Bracket und einen kurzen Titel geprüft.                                     | Wer am PDF-Kopf oder an fest dimensionierten PDF-Blöcken etwas ändert, rendert den Worst Case (größtes Bracket, längster Titel, 60-Zeichen-Slug) und hält die Seitenzahl per Test fest (`PlayoffsPdf.test.tsx`). |
| 2026-10-03 | react-pdf bricht ein Wort ohne Leerzeichen (URL) nicht um und vermisst eine Text-Spalte ohne feste Breite falsch.                                                                                                            | Lange Tokens selbst in Zeilen schneiden (`splitDisplayUrl`), der Spalte eine feste Breite geben und die Silbentrennung abschalten (`hyphenationCallback={(w) => [w]}`).                                          |
| 2026-10-03 | Auf einer frischen Dev-DB legte der Server keinen Seed-Admin an: `pnpm check` lief vorher, und die DB-gestützten Tests hatten einen `test-…@example.com`-Admin hinterlassen. Der Seed greift nur, wenn es keinen Admin gibt. | Frische Dev-DB: erst den Dev-Server einmal starten (Seed), dann `pnpm check`. Oder die Testreste entfernen.                                                                                                      |
| 2026-10-03 | Nach `pnpm --filter ringwerk add qrcode` war treffsicher rot (`Cannot find package 'next-auth'`): pnpm hatte eine Peer-Variante neu aufgelöst und den Link der Nachbar-App nicht nachgezogen.                                | Nach `pnpm add` in einer App immer `pnpm install --frozen-lockfile` laufen lassen, bevor der Gate-Lauf einem rot meldet.                                                                                         |

## Abgeschlossen
