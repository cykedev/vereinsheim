Konsolidiere `.claude/tasks/lessons.md`: Promoviere wiederverwendbare Regeln in passende Docs, behalte nur projektspezifische Lerneinträge.

## Ziel

lessons.md wächst nach jeder Session. Dieses Command hält die Datei schlank:

- Generische Regeln/Patterns → passende Doc (code-conventions, ui-patterns)
- Projektspezifische Bugs und Incidents → bleiben in lessons.md
- Bereits bekannte oder obsolete Einträge → werden archiviert (gelöscht)

## Kategorien

| Kategorie          | Ziel-Doc                           | Typische Inhalte                                                                   |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------- |
| `ENFORCE`          | Gate/Lint/Test/Grep umsetzen       | Build-/Compile-Regeln, Anti-Pattern, fehlende Dateien — alles automatisch Prüfbare |
| `CODE_CONVENTIONS` | `.claude/docs/code-conventions.md` | Prisma-Patterns, TypeScript/Zod, Tests, Server Actions                             |
| `UI_PATTERNS`      | `.claude/docs/ui-patterns.md`      | shadcn, Mobile/Responsive, CSS, Touch-Targets, React-UI                            |
| `REMEMBER` (KEEP)  | lessons.md / Memory-Graph          | Projektspezifisch, Business-Logic, einmalige Incidents                             |
| `ARCHIVE`          | wird gelöscht                      | Bereits in Docs vorhanden, obsolet, oder trivial                                   |

## Triage-Prinzip: stärkste verfügbare Permanenz zuerst

Eine Lektion ist erst „erledigt", wenn sie in der **stärksten erreichbaren Form** verankert ist —
„nie wieder" schlägt „bitte daran denken". Pro Lektion von oben nach unten prüfen und auf der
**höchsten** erreichbaren Stufe verankern:

1. **ENFORCE** — automatisch erzwingen, wenn machbar: eslint-Regel, ein `/check`-Gate
   (lint/test/tsc/**`next build`**), ein Anti-Pattern-Grep in `consistency-check.sh` (Drift-Gate),
   ein Unit-Test, oder ein Fix, der den Fehlermodus beseitigt. Den Check **tatsächlich umsetzen** und
   darauf verweisen. (Exemplar: `"use server"`-Re-Export-Lektion → `next build` als Gate, nicht nur Doku.)
2. **DOCUMENT** — generische Regel in die passende immer-geladene Doc (auto-geladen, aber weich).
3. **REMEMBER** — projektspezifischer Kontext/Incident → bleibt abrufbar (`lessons.md`; im Monorepo
   der Layer-3-Memory-Graph, ADR-016).
4. **ARCHIVE** — bereits abgedeckt, obsolet oder trivial → löschen.

ENFORCE-Funde werden dem User immer als **konkrete Aktion** vorgelegt (welcher Check/Fix), nie still
nur dokumentiert.

## Ablauf

### 1. Lesen

Lies `.claude/tasks/lessons.md` in 50-Zeilen-Chunks (Datei kann gross sein).
Lies auch die Ziel-Docs um Duplikate zu vermeiden:

- `.claude/docs/code-conventions.md`
- `.claude/docs/ui-patterns.md`

### 2. Analyse-Agent starten (model: opus)

Starte einen Agent mit folgendem Auftrag:

```
Analyze all lesson entries from lessons.md. For each entry, assign the HIGHEST applicable category
(prefer enforcement over documentation over memory):
- ENFORCE: can become an automated check (eslint rule, a /check gate incl `next build`, an anti-pattern
  grep in consistency-check.sh, a unit test) or a fix that removes the failure mode. Prefer this
  whenever feasible. Output the concrete mechanism to implement (do NOT silently downgrade to a doc).
- CODE_CONVENTIONS: generic rule applicable to any Next.js/Prisma/TypeScript project
- UI_PATTERNS: generic rule applicable to any React/Tailwind/shadcn project
- REMEMBER (KEEP): project-specific incident, ringwerk business logic, or unique context
- ARCHIVE: already covered in the target docs, superseded, or too trivial

For CODE_CONVENTIONS and UI_PATTERNS entries, reformulate as a concise rule:
  "**[Short rule title]**: [Rule in 1-2 sentences. Why it matters.]"
  Do NOT include the full error story — just the actionable rule.

Return:
  enforce_actions: list of { lesson, mechanism } — concrete checks/fixes to implement (gate, lint rule, grep, test, or fix)
  code_conventions: list of formatted rules (strings)
  ui_patterns: list of formatted rules (strings)
  keep_entries: list of original table rows (verbatim from lessons.md)  # REMEMBER bucket
  archived_count: number

Read the existing target docs first to avoid duplicating already-documented rules.
```

### 3. Ziel-Docs aktualisieren

Für jede Ziel-Doc:

1. Lies die gesamte Datei
2. Suche nach dem Abschnitt `## Aus Lernlog übernommen`
3. **Falls vorhanden**: Ersetze den gesamten Abschnitt (bis zum nächsten `##` oder EOF) durch die neue Liste
4. **Falls nicht vorhanden**: Füge den Abschnitt am Ende der Datei an

Format des Abschnitts:

```markdown
## Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: YYYY-MM-DD -->

- **[Regel 1]**: ...
- **[Regel 2]**: ...
```

### 4. lessons.md neu schreiben

Schreibe die Datei neu mit:

1. Original-Header (# Lernlog – Liga-App + Format-Zeile + Separator)
2. Kommentarzeile: `<!-- Zuletzt konsolidiert: YYYY-MM-DD -->`
3. Alle `KEEP`-Einträge (Priorität — immer behalten, unabhängig vom Alter)
4. Die letzten 10 Einträge nach Datum (sofern nicht bereits KEEP)
5. Keine archivierten oder promotierten Einträge

Die letzten 10 Einträge werden immer behalten (für Kurzzeit-Gedächtnis bei Session-Start).

### 5. Bericht an User

Berichte in Deutsch:

- Gesamtzahl verarbeiteter Einträge
- **ENFORCE: Liste der umzusetzenden Checks/Fixes** (Mechanismus je Eintrag) — als konkrete Aktion, nicht still
- X Einträge → code-conventions.md
- Y Einträge → ui-patterns.md
- Z Einträge behalten (REMEMBER/KEEP + letzte 10)
- N Einträge archiviert

## Wichtige Regeln

- **Idempotent**: Mehrfaches Ausführen darf nichts doppelt schreiben (Abschnitt wird ersetzt, nicht angehängt)
- **Nie Inhalte aus Docs löschen** — nur den `## Aus Lernlog übernommen`-Abschnitt überschreiben
- **KEEP ist immer sicher** — im Zweifel KEEP statt ARCHIVE
- **Kontext-Schutz**: Ziel ist es, lessons.md so klein wie möglich zu halten ohne wichtige Infos zu verlieren
