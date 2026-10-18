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

| 2026-10-18 | Zwei Aufbauten des Prüfbestands unterschieden sich nur in der Seite der Finalisten: `advanceRound` liest die Halbfinals mit `findMany` ohne `orderBy` und setzt `winners[0]` als A; die physische Zeilenfolge (Autovacuum, Statistik) entscheidet | Wo die Reihenfolge gelesener Zeilen Daten festlegt (Seite, Setzung), immer `orderBy`; Reproduzierbarkeit per Prüfsumme über zwei Läufe prüfen (`pruefdaten --erwartet`) |
| 2026-10-18 | Nach einem Feldfehler im Formular „Neuer Wettbewerb“ stand die Disziplin wieder auf „Gemischt“, obwohl der State gesteuert ist: Die Radix-Auswahl mit `name` rendert ein verstecktes `<select>` und folgt dem Zurücksetzen des Formulars, das React 19 nach der Server Action auslöst. Kein Test sah es, erst der Ablauf im Browser | Gesteuerte Formulare mit Radix-Auswahl nach einem Feldfehler im Browser prüfen (`pruefen:ablaeufe`); jede Auswahl, nicht nur Textfelder |
| 2026-10-18 | Die Skriptprüfung hing ohne Meldung: Nach einer ungespeicherten Eingabe öffnete Chrome beim nächsten Laden den `beforeunload`-Dialog, und `Page.navigate` wartete auf ihn | `@vereinsheim/pruefen` nimmt Browser-Dialoge an und schreibt sie in `page.dialogs`; eine Prüfung, die `beforeunload` erwartet, liest sie dort |
| 2026-10-18 | Der Vergleich direkt nach der Aufnahme meldete Abweichungen: Seiten mit `loading.tsx` zeigen erst Platzhalter und streamen nach, die Starterliste lost die Nummern je Abruf neu aus | Text erst lesen, wenn keine Platzhalter mehr da sind und er über drei Lesungen gleich bleibt; was je Abruf wechselt, vor dem Vergleich herausnehmen und seine Eigenschaft prüfen (1 bis n) |
| 2026-10-18 | Der Vergleich direkt nach der Aufnahme war fehlerfrei, nach einem Neuaufbau des Prüfbestands (gleiche Prüfsumme) meldete er 122 Abweichungen: Ringwerk ordnet bei Gleichstand nach der physischen Zeilenfolge, und die wechselte je Aufbau (parallele Schreibzugriffe über den Pool, Aufräumen geänderter Seiten) | Reproduzierbarkeit über zwei Aufbauten prüfen, nicht nur zwei Lesungen derselben Datenbank; der Prüfbestand baut mit einer Verbindung und `fillfactor = 50` |
| 2026-10-18 | `pg` liest Prismas `timestamp` ohne Zeitzone in der Zone des Rechners; die Prüfsumme hing am Rechner, an der Zeitumstellung fallen zwei Zeiten zusammen | In Werkzeugen mit rohem `pg` Zeitstempel als Text lesen (Type-Parser 1114/1184) |

<!-- 2026-10-15 (Rückzug sperrt Playoff-Start): 1 Eintrag direkt nach vault/conventions.md §9 (Mocks filtern nach der Bedingung); ENFORCE durch die Fixture in seeding.test.ts. -->
<!-- 2026-10-03 (Neu generieren): 1 Eintrag direkt nach vault/conventions.md §9 (Prüfen und Löschen in einer Transaktion). -->
<!-- 2026-10-03 (A/B-Ausgleich): 2 Einträge direkt nach vault/conventions.md §9 (Mutation gegen Eigenschaftstests; UI-Pfade an der UI prüfen). -->
<!-- 2026-10-03: 4 Einträge konsolidiert (1 ENFORCE-Fix publicSlug.test.ts, 2 → ringwerk-code-conventions, 1 → vault/conventions.md §9). -->

## Abgeschlossen
