---
name: consolidate-lessons
description: Triage an app's session lessons (apps/<app>/.claude/tasks/lessons.md) by strongest-permanence-first (ENFORCE > DOCUMENT > REMEMBER), promote reusable rules into gates/conventions, and store project-specific context as an incident note in the vault. Use at session end after writing lessons, or whenever lessons.md has grown.
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
2. **DOCUMENT** — generische Regel in die passende Vault-Guide-Note (live editiert, ADR-025):
   - app-spezifisch generisch → `vault/apps/<app>/<app>-code-conventions.md` bzw. `…-ui-patterns.md`
   - app-übergreifend → `vault/conventions.md` (Single Source, @-importiert)
3. **REMEMBER** — projektspezifischer Kontext, der **nicht** als Regel taugt → **Vault** als
   `incident`-Note unter `vault/incidents/` (live, kein Build; ADR-025). Hierher gehört das *Warum/Wann/Was-passiert-ist*:
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
   auch die Ziel-Guides (`vault/apps/<app>/<app>-code-conventions.md`, `…-ui-patterns.md`,
   `vault/conventions.md`), um Duplikate zu vermeiden — via `search_nodes`/`section_read`.

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

5. **REMEMBER → `incident`-Note im Vault** (ADR-025 — kein Build, kein Live-`mcp__memory__`-Write;
   die Note **ist** der Graph, sobald gespeichert). Pro `remember`-Eintrag:
   a. **Note anlegen/ergänzen** — `vault/incidents/<name>.md` (aus `vault/_templates/incident.md`;
      `type: incident`, `id`/Dateiname kebab-case, `**TL;DR**` + Body mit Datum + App + Provenance, z.B.
      „2026-06-18 (ringwerk): … gekippt, weil …; revidierbar"). **Kuratierte `keywords:`-Zeile**
      (Synonyme; vault-lint erzwingt sie für atomare Notes). Existiert die Note → Body/Datum ergänzen
      statt Dublette.
   b. **Verknüpfen** — typisierte Kante(n) im Frontmatter: `relates_to`/`part_of` zur App
      (`"[[ringwerk]]"`/`"[[treffsicher]]"`), `governed_by`/`informed_by` zur ADR bzw. zum Topic, damit
      die Note im Graph hängt (nicht orphan; sonst nur per Suche findbar).
   c. **Validieren + committen** — `node .claude/vault-lint.mjs` (Schema/Anker/keywords) → die Note in
      den Session-Commit. Bei Cross-Ref-Aufräumen `/sync-graph`.

6. **lessons.md neu schreiben:** Original-Header + Datums-Kommentar + alle KEEP/REMEMBER-Einträge
   (die noch NICHT in den Memory-Graph wanderten) + die letzten 10 nach Datum; keine
   archivierten/promoteten Einträge.

7. **Bericht (Deutsch):** verarbeitete Gesamtzahl; **ENFORCE: Liste der umzusetzenden Checks/Fixes**
   (Mechanismus je Eintrag) als konkrete Aktion; X→code-conventions, Y→ui-patterns,
   Z→conventions, R→vault/incidents/, N archiviert.

## Wichtige Regeln

- **Idempotent**: Mehrfachlauf schreibt nichts doppelt (Abschnitt wird ersetzt, nicht angehängt).
- **Nie Inhalte aus Docs löschen** — nur den `## Aus Lernlog übernommen`-Abschnitt überschreiben.
- **Im Zweifel KEEP/REMEMBER** statt ARCHIVE.
- Ziel: `lessons.md` so klein wie möglich, ohne wichtige Infos zu verlieren — der Memory-Graph
  ist das Langzeit-Gedächtnis.
