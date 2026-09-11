# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-09-09 -->
<!-- 2026-09-09: 5 Einträge (Saison-Sortierung) konsolidiert — Regeln → vault/conventions.md §9, ringwerk-code-conventions (Next.js & Caching), ringwerk-ui-patterns (Tabellen & Ranking); Provenance → vault/incidents/{dev-shadow-db-createdb, public-pdf-cache-tag-orphaning, next-dist-dir-shared-with-dev-server}; zwei ENFORCE-Vorschläge liegen beim User. -->
<!-- Alle bisherigen Einträge konsolidiert: Regeln → docs/ (code-conventions, ui-patterns, data-model, shared-conventions); Incidents/State → Memory-Graph (.claude/graph-captured.mjs); ops-lokales → natives Auto-Memory. Langzeit-Gedächtnis ist der Memory-Graph, nicht dieser Buffer. -->

## Offen (2026-09-11)

| 2026-09-11 | Eine responsive Regel war ungeprüft: „Best. Teiler" hatte `hidden sm:table-cell`, in der alternierenden Sortierung stand damit mobil jede zweite Zeile mit ihrem maßgeblichen Wert in einer unsichtbaren Spalte. Am Desktop war alles korrekt, die Sichtprüfung lief nur dort. | Wenn eine Darstellung von einem Modus abhängt, jede Breite gegen jeden Modus prüfen — und die Regel „sichtbar bleibt, was die Reihenfolge bestimmt" als Test festhalten, nicht als Screenshot. |
| 2026-09-11 | Ich hatte Component-Markup-Tests als „bräuchte erst jsdom + testing-library" abgetan (und ein Review-Agent bestätigte das). Falsch: `renderToStaticMarkup` aus `react-dom/server` läuft im Node-Environment und reicht für alles, was am `class`-Attribut hängt. | Vor dem Urteil „dafür fehlt die Infrastruktur" den billigsten Pfad ausprobieren — hier: 20 Zeilen `.test.tsx` statt einer Infrastruktur-Entscheidung. |
| 2026-09-11 | `docker exec` ohne `-i` leitet stdin nicht weiter: ein psql-Heredoc lief ins Nichts, ohne Ausgabe und ohne Fehler — es sah aus, als hätte das DELETE nichts getroffen. | Bei `docker exec` mit Heredoc/Pipe immer `-i`; und das Ergebnis einer Mutation an gezählten Zeilen prüfen, nicht am fehlenden Fehler. |

## Abgeschlossen
