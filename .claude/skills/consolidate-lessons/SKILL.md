---
name: consolidate-lessons
description: Triage an app's session lessons (apps/<app>/.claude/tasks/lessons.md) by strongest-permanence-first (ENFORCE > DOCUMENT > REMEMBER), promote reusable rules into docs/gates, and store project-specific context in the Memory-Graph. Use at session end after writing lessons, or whenever lessons.md has grown.
---

One skill for **both apps** (ADR-017). Operate on the app you're working in; `<app>` is
`ringwerk` or `treffsicher`. The lessons buffer is `apps/<app>/.claude/tasks/lessons.md`.

## Triage-Prinzip: stärkste verfügbare Permanenz zuerst

Eine Lektion ist erst „erledigt", wenn sie in der **stärksten erreichbaren Form** verankert
ist — „nie wieder" schlägt „bitte daran denken". Pro Lektion von oben nach unten prüfen und
auf der **höchsten** erreichbaren Stufe verankern:

1. **ENFORCE** (stärkste) — automatisch erzwingen, wenn machbar: eine eslint-Regel, ein
   `pnpm check`-Gate (lint/format/test/**`next build`**), ein Anti-Pattern-Grep in
   `scripts/consistency-check.sh` (Drift-Gate), ein Unit-Test, oder ein Fix, der den
   Fehlermodus beseitigt. Den Check **tatsächlich umsetzen** und darauf verweisen.
   (Exemplar: `"use server"`-Re-Export-Lektion → `next build` als Gate, nicht nur Doku.)
2. **DOCUMENT** — generische Regel in die passende immer-/on-demand-geladene Doc:
   - app-spezifisch generisch → `apps/<app>/docs/code-conventions.md` bzw. `…/ui-patterns.md`
   - app-übergreifend → `docs/shared-conventions.md` (Single Source, Root)
3. **REMEMBER** — projektspezifischer Kontext, der **nicht** als Regel taugt → **Memory-Graph**
   (memory-MCP, Store `.claude/knowledge-graph.json`). Hierher gehört das *Warum/Wann/Was-passiert-ist*:
   **Incident** mit Provenance (was kippte warum, wer entschied, revidierbar?), sich ändernder
   **Zustand** (offene Migration, Teil-Stand), **Relationen** zwischen Apps/ADRs/Modulen. **Nicht**
   hierher: wiederverwendbare Regeln (→ DOCUMENT) und maschinen-/ops-lokale Fakten (→ natives
   Claude-Code-Auto-Memory, `~/.claude/.../memory/`). Faustregel: die *Regel* einer Lektion → Docs;
   die *Story/Provenance* → Graph. Der Graph ersetzt den `lessons.md`-Buffer als Langzeit-Speicher;
   in `lessons.md` bleiben nur die letzten ~10 Einträge fürs Kurzzeit-Gedächtnis.
4. **ARCHIVE** — bereits abgedeckt, obsolet oder trivial → löschen.

ENFORCE-Funde werden dem User **immer als konkrete Aktion** vorgelegt (welcher Check/Fix),
nie still nur dokumentiert.

## Ablauf

1. **Lesen.** `apps/<app>/.claude/tasks/lessons.md` in 50-Zeilen-Chunks (kann groß sein). Lies
   auch die Ziel-Docs (`apps/<app>/docs/code-conventions.md`, `…/ui-patterns.md`,
   `docs/shared-conventions.md`), um Duplikate zu vermeiden.

2. **Analyse-Agent (model: opus).** Lass einen Sub-Agent jeden Eintrag der **höchsten
   anwendbaren** Kategorie zuordnen (prefer enforcement). Rückgabe:
   - `enforce_actions`: Liste `{ lesson, mechanism }` — konkrete Checks/Fixes (Gate/Lint/Grep/Test/Fix)
   - `shared_conventions` / `code_conventions` / `ui_patterns`: je Liste formatierter Regeln
     (`"**[Kurztitel]**: [Regel in 1–2 Sätzen. Warum.]"` — ohne die Fehler-Story)
   - `remember`: Liste projektspezifischer Einträge (→ Memory-Graph)
   - `archived_count`: Zahl
   Der Agent liest die Ziel-Docs zuerst, um Bereits-Dokumentiertes nicht zu duplizieren.

3. **ENFORCE umsetzen.** Für jeden `enforce_actions`-Eintrag den Mechanismus dem User als
   konkrete Aktion vorlegen (eslint-Regel / Gate / Grep in `consistency-check.sh` / Test / Fix).

4. **Docs aktualisieren** (idempotent). Pro Ziel-Doc den Abschnitt `## Aus Lernlog übernommen`
   **ersetzen** (bis zum nächsten `##`/EOF) bzw. anhängen, mit Datums-Kommentar:
   ```markdown
   ## Aus Lernlog übernommen
   <!-- Zuletzt konsolidiert: YYYY-MM-DD -->
   - **[Regel]**: …
   ```

5. **REMEMBER → Memory-Graph.** Pro `remember`-Eintrag:
   a. **Entity anlegen** — `mcp__memory__create_entities` mit sprechendem `name` (kebab-case),
      `entityType` aus dem Vokabular `incident` | `state` | `decision`, und einer `observations`-Zeile
      mit Datum + App + Provenance (z.B. `"2026-06-18 (ringwerk): … gekippt, weil …; revidierbar"`).
      Existiert die Entity schon → `mcp__memory__add_observations` statt Dublette.
   b. **Verknüpfen** — wo sinnvoll `mcp__memory__create_relations` zur App (`occurred_in`/`applies_to`)
      oder zu einer ADR (`amends`/`relates_to`), damit der Eintrag auffindbar im Graph hängt.
   c. **Committen** — `.claude/knowledge-graph.json` ist in-repo (anders als das auto-persistierte
      native Auto-Memory) → die geänderte Store-Datei in den Session-Commit aufnehmen, sonst geht der
      Write beim nächsten Clone/Pull verloren.
   (Fallback ohne MCP: Eintrag in `lessons.md` als KEEP behalten.)

6. **lessons.md neu schreiben:** Original-Header + Datums-Kommentar + alle KEEP/REMEMBER-Einträge
   (die noch NICHT in den Memory-Graph wanderten) + die letzten 10 nach Datum; keine
   archivierten/promoteten Einträge.

7. **Bericht (Deutsch):** verarbeitete Gesamtzahl; **ENFORCE: Liste der umzusetzenden Checks/Fixes**
   (Mechanismus je Eintrag) als konkrete Aktion; X→code-conventions, Y→ui-patterns,
   Z→shared-conventions, R→Memory-Graph, N archiviert.

## Wichtige Regeln

- **Idempotent**: Mehrfachlauf schreibt nichts doppelt (Abschnitt wird ersetzt, nicht angehängt).
- **Nie Inhalte aus Docs löschen** — nur den `## Aus Lernlog übernommen`-Abschnitt überschreiben.
- **Im Zweifel KEEP/REMEMBER** statt ARCHIVE.
- Ziel: `lessons.md` so klein wie möglich, ohne wichtige Infos zu verlieren — der Memory-Graph
  ist das Langzeit-Gedächtnis.
