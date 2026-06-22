Räume `.claude/tasks/todo.md` auf: Abgeschlossene Tasks aus "Aktuell" entfernen, komprimieren, alte Einträge archivieren.

## Ziel

todo.md wächst nach jeder Phase. Dieses Command hält die Datei schlank:

- Abgeschlossene Einträge in "Aktuell" → komprimiert nach "Abgeschlossen" verschieben
- Ältere "Abgeschlossen"-Einträge → nach `todo-archive.md` auslagern
- Nur offene Tasks + die letzten 5 Abschlüsse bleiben in todo.md sichtbar

## Ablauf

### 1. Lesen

Lies `.claude/tasks/todo.md` vollständig.
Prüfe ob `.claude/tasks/todo-archive.md` existiert (für spätere Nutzung).

### 2. Analyse-Agent starten (model: haiku)

Starte einen Agent mit folgendem Auftrag:

```
Analyze the todo.md content. Return a structured report:

open_tasks: list of task blocks from "## Aktuell" that have at least one unchecked checkbox [ ] or no status marker
completed_in_aktuell: list of task blocks from "## Aktuell" that are fully completed (all [x] checked OR explicit ABGESCHLOSSEN status)
recent_abgeschlossen: the 5 most recent entries from "## Abgeschlossen" (keep verbatim)
archive_candidates: entries from "## Abgeschlossen" beyond the 5 most recent (to be archived)

For each completed_in_aktuell entry, produce a compressed summary:
Format: "### [YYYY-MM-DD] <Title>\n\n<1-3 bullet points covering what changed — NO checkbox lists, just facts>"
Use the date from the status line (e.g., "ABGESCHLOSSEN [2026-03-17]") or today's date if missing.

Rules:
- A task block is "completed" if it has "Status: ABGESCHLOSSEN" OR "✓ ABGESCHLOSSEN" OR all checkboxes are [x]
- Keep the project overview block ("Ringwerk-Umbau: Uebersicht") as open_tasks if it contains forward-looking info, otherwise discard
- Compress ruthlessly: a phase with 20 checkboxes becomes 2-3 bullet points
- Preserve the key facts: what schema changed, what module was added, test count
```

### 3. todo.md neu schreiben

Schreibe die Datei neu mit:

1. Original-Header (`# Aufgaben-Log – Ringwerk\n\n---`)
2. `## Aktuell` — nur `open_tasks` (leer lassen wenn keine offenen Tasks: `_Keine offenen Tasks._`)
3. `---`
4. `## Abgeschlossen`
5. Komprimierte Versionen aller `completed_in_aktuell` Einträge (neueste zuerst)
6. Dann die `recent_abgeschlossen` (die 5 neuesten bestehenden Einträge)

**Wichtig:** Keine doppelten Einträge. Wenn ein completed_in_aktuell-Eintrag inhaltlich schon in Abgeschlossen vorhanden ist, nur einmal behalten.

### 4. todo-archive.md aktualisieren

Falls `archive_candidates` vorhanden:

1. Lies `.claude/tasks/todo-archive.md` (falls vorhanden)
2. Füge die `archive_candidates` am Anfang des Archivs ein (neueste zuerst)
3. Falls die Datei noch nicht existiert, erstelle sie mit Header:

```markdown
# Aufgaben-Archiv – Ringwerk

Archivierte abgeschlossene Tasks (zu alt für das aktive Log).

---
```

### 5. Bericht an User

Berichte in Deutsch:

- X offene Tasks behalten
- Y abgeschlossene Tasks aus "Aktuell" komprimiert und verschoben
- Z Einträge in "Abgeschlossen" sichtbar (letzte 5 + neu verschobene)
- N Einträge nach todo-archive.md ausgelagert

## Wichtige Regeln

- **Idempotent**: Mehrfaches Ausführen darf nichts doppeln (bereits in "Abgeschlossen" vorhandene Einträge nicht erneut komprimieren)
- **Nie Informationen verlieren**: Komprimieren ja, löschen nein — Archiv bewahrt alles
- **Offen bleibt offen**: Im Zweifel als open_task behandeln
- **Kontext-Schutz**: todo.md soll so kurz wie möglich bleiben (Ziel: < 100 Zeilen)
