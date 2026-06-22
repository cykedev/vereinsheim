# Memory-Graph operationalisieren — Plan

> PIV step-1 artifact. Branch: `feat/memory-graph-operational` (from `main`).
> Status: **awaiting user approval** before implementation.

## Context (why)

Der Memory-MCP-Graph (ADR-016 Schicht 3, `@modelcontextprotocol/server-memory`, Store
`.claude/knowledge-graph.json`) wirkte tot: 24 Entities, seit dem Seed-Commit (`371763c`) nie
gewachsen, und nie benutzt. **Empirisch belegter Root Cause** (in dieser Session getestet):

- `mcp__memory__read_graph` liefert `{entities:[],relations:[]}` — **leer**, obwohl die getrackte
  Datei 24 Entities hat.
- `mcp__memory__create_entities` schlägt fehl mit
  `ENOENT: open '/Users/christian/.npm/_npx/…/server-memory/dist/.claude/knowledge-graph.json'`.

Ursache: `MEMORY_FILE_PATH` in `.mcp.json` ist **relativ** (`.claude/knowledge-graph.json`) und wird
vom `server-memory` gegen sein **eigenes npx-Installationsverzeichnis** aufgelöst, nicht gegen die
Repo-Wurzel. Folge: Der Server las nie die getrackte Datei (→ leerer Graph) und konnte nie schreiben
(→ ENOENT). **Die Schicht war seit Tag 1 ein No-Op.** Der Seed-Inhalt entstand nur, weil der
Seed-Commit die Datei direkt schrieb — der MCP hat sie nie gesehen.

Sekundäre Faktoren (greifen erst, wenn der Pfad gefixt ist):
1. **Keine Lese-Seite**: nichts surface't den Graphen bei Sessionstart (CodeGraph hat dafür einen
   SessionStart-Hook + CLAUDE.md-Guidance; Memory hatte nichts).
2. **Schreib-Seite schwach**: nur manuell via `/consolidate-lessons`, und dessen Triage (ADR-017,
   ENFORCE > DOCUMENT > REMEMBER) leitet wiederverwendbare Regeln korrekt in Docs — der Graph (REMEMBER)
   ist die schwächste Stufe und wird kaum gefüttert. Schreiben hing zudem am kaputten Pfad.
3. **Seed redundant**: nur ADR-Inhalte, die ohnehin in `decisions.md` + den CLAUDE.md-Dateien stehen und
   in **jeder** Session geladen werden → null Mehrwert beim Abfragen.

Ziel (User-Entscheid: „real nutzen, befüllt, verwendet, geupdated"): Den Graphen funktionsfähig,
auffindbar und nicht-redundant machen — mit klarer Abgrenzung zum **nativen Claude-Code-Auto-Memory**
(`~/.claude/projects/.../memory/`, das den Cross-Session-Job bereits lebendig macht), damit beide sich
nicht duplizieren.

## Approach

**Entscheidender Fix zuerst** (1 Zeile), dann Lese-Pfad, Schreib-Disziplin, nicht-redundanter Re-Seed,
Abgrenzung, ADR-Pflege.

### Sequencing-Constraint (kritisch)

`.mcp.json`-Änderungen greifen **erst nach Claude-Code-Reload** — der Memory-Server liest den neuen
Pfad nicht heiß nach. Konsequenzen für den Plan:
- Der **Re-Seed** erfolgt per **direktem JSONL-Edit** der Store-Datei (wie der Original-Seed), **nicht**
  via Live-MCP — sonst Henne-Ei.
- Der **Lese-Hook** liest die JSONL-Datei **direkt** (unabhängig vom MCP-Server) → wirkt schon beim
  nächsten Sessionstart, auch ohne MCP-Reload.
- Die **Round-Trip-Verifikation** (liest/schreibt der gefixte MCP die getrackte Datei?) ist ein
  **Akzeptanz-Gate nach Reload** — Teil von `/validate`, nicht im selben Lauf erzwingbar.

### 1. Pfad-Fix (`.mcp.json`)

`MEMORY_FILE_PATH` portabel + absolut machen (per claude-code-guide gegen die offizielle Doku
verifiziert: Claude Code expandiert `${VAR}`/`${VAR:-default}` in `.mcp.json`-`env`; `CLAUDE_PROJECT_DIR`
wird im Server-Env gesetzt; **projekt-scoped braucht den `:-.`-Fallback**):

```jsonc
"memory": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "env": { "MEMORY_FILE_PATH": "${CLAUDE_PROJECT_DIR:-.}/.claude/knowledge-graph.json" }
}
```

Kein hartkodierter `/Users/...`-Pfad → überlebt `git clone` auf andere Maschine/Pfad.

### 2. Lese-Pfad — SessionStart-Surface-Hook

Neuer Hook `.claude/hooks/memory-surface.mjs` (Muster: `codegraph-ensure.mjs` SessionStart + der
einmalige `additionalContext`-Nudge aus `pretool-guard.mjs`), verdrahtet als **zweiter** SessionStart-Hook
neben `codegraph-ensure`. Verhalten, fail-open:
- Liest `${CLAUDE_PROJECT_DIR}/.claude/knowledge-graph.json` **JSONL-zeilenweise** (Format: 1 JSON-Objekt
  pro Zeile, `{"type":"entity"|"relation",...}`) — **kein** `JSON.parse` der Gesamtdatei.
- Fehlt/leer/Parse-Fehler → `exit 0` still (nichts zu surfacen, nie bricken).
- Sonst: zählt Entities nach `entityType` + Relationen, emittiert
  `hookSpecificOutput.{hookEventName:"SessionStart", additionalContext: <msg>}`.
- `additionalContext` (verbatim Vorlage, Deutsch):
  > „Memory-Graph (Projektgedächtnis, `.claude/knowledge-graph.json`): N Entities (Typen: …), M
  > Relationen. **Abfragen** mit `mcp__memory__search_nodes`/`open_nodes`/`read_graph`, **bevor** du
  > breit explorierst — projektspezifischer Kontext/Incidents/Provenance, der nicht in den
  > immer-geladenen Docs steht. **Neue** projektspezifische Fakten (Incident, Entscheidungs-Provenance,
  > sich ändernder Zustand, Relationen) mit `mcp__memory__create_entities`/`add_observations` festhalten
  > **und `.claude/knowledge-graph.json` committen**. Abgrenzung: Code-Struktur → CodeGraph; erzwingbare
  > Regeln → docs/Gates; Maschinen-/Ops-lokales → natives Auto-Memory."

Damit ist der Lese-Pfad zweifach abgesichert: passive Surface (Hook, immer) + aktive Abfrage (MCP,
on-demand). Die Guidance liegt im Hook-Text (immer injiziert), nicht im auto-managed Block von
`.claude/CLAUDE.md` (den fasse ich nicht an).

### 3. Schreib-Disziplin — `/consolidate-lessons` + Session-Ende

- `.claude/skills/consolidate-lessons/SKILL.md`, Schritt 5 (REMEMBER → Memory-Graph) konkretisieren:
  - **Was qualifiziert** (Abgrenzung schärfen): Incident/Entscheidungs-**Provenance**, sich ändernder
    **Zustand**, **Relationen** zwischen Apps/ADRs/Modulen — **nicht** wiederverwendbare Regeln (die
    bleiben DOCUMENT → Docs). Die *Regel* einer Lektion → Docs; die *Story/Provenance/Revidierbarkeit*
    → Graph.
  - **Wie**: tatsächliche `mcp__memory__create_entities`/`add_observations`-Calls (mit `entityType` wie
    `incident`/`state`/`decision`, App-Tag, sinnvollen Relationen via `create_relations`).
  - **Commit-Schritt ergänzen**: `.claude/knowledge-graph.json` ist in-repo → nach MCP-Writes
    committen (das native Auto-Memory persistiert automatisch, der in-repo-Graph nicht).
- `apps/ringwerk/CLAUDE.md` + `apps/treffsicher/CLAUDE.md`:
  - „Session Start"-Block: Zeile, dass der SessionStart-Hook den Graphen surface't und man ihn bei
    relevantem Vorwissen abfragt (`mcp__memory__search_nodes`).
  - „Completing a session"-Checkliste: nach `/consolidate-lessons` REMEMBER-Fakten im Graph sichern +
    `.claude/knowledge-graph.json` committen.

> Ehrlich im Plan: Schreiben bleibt **modellgetrieben** — kein Hook kann semantisches Capture
> *erzwingen* (ein Stop-Hook könnte nur nerven/blocken, nicht sinnvoll Entities schreiben). Der
> SessionStart-Surface macht aber einen vernachlässigten/leeren Graphen **sofort sichtbar**, sodass
> Nicht-Pflege auffällt — kombiniert mit broaderem REMEMBER-Scope + Checkliste ist das der realistische
> „kept updated"-Mechanismus.

### 4. Re-Seed (nicht-redundant) — direkter JSONL-Edit von `.claude/knowledge-graph.json`

Anhängen (Provenance/State/Relationen — **nicht** Regeln, die in Docs gehören; ADR-Backbone aktuell
ziehen):
- **Entities**:
  - `ADR-019`, `ADR-020` (`decision`, dünne Observation + Verweis auf `decisions.md`) — Backbone bis
    heute (Graph stoppte bei 018).
  - `ADR-021` (`decision`) — diese Entscheidung.
  - `stechschuss-modell-flip` (`incident`): „2026-06-18: Stechschuss von Match-only auf duell-zählend
    (2:1) gekippt nach Real-Daten-Review mit dem Domänen-Owner; **revidierbar**; Domänen-Calc zentral in
    `bestOf.ts`." (Provenance — die *Regel* steht in code-conventions.)
  - `ruleset-lock-granularity` (`incident`): „2026-06-18: Liga-Regelset komplett gesperrt sobald
    Paarungen existierten → Playoff-Deadlock. Lösung: Sperr-Granularität an den Wirk-Zeitpunkt koppeln."
  - `treffsicher-actionresult-migration` (`state`): „Treffsichers Module noch nicht auf die diskriminierte
    ActionResult-Union migriert (shared-conventions §6) — geplanter Folgeschritt."
- **Relations**: `ADR-021 amends ADR-016`, `ADR-021 amends ADR-017`, `ADR-020 amends ADR-018`,
  `stechschuss-modell-flip occurred_in ringwerk`, `ruleset-lock-granularity occurred_in ringwerk`,
  `treffsicher-actionresult-migration applies_to treffsicher`.

Modest (~6 Entities, ~6 Relationen): beweist die Nische, macht den Graph sofort abfragbar-nützlich,
demonstriert das Muster — der Graph wächst danach organisch. JSONL-Format exakt wie bestehende Zeilen.

### 5. Abgrenzung natives Auto-Memory ↔ Memory-MCP-Graph (dokumentieren)

Regel (in ADR-021 + kurz in `docs/architecture.md`): **Maschinen-/User-/Ops-lokales → natives
Auto-Memory** (`~/.claude/.../memory/`, persistiert automatisch, nicht via git geteilt — VPS-Status,
Dev-Server-Disziplin, CodeGraph-Auto-Index-Präferenz). **Projekt-/Domänen-/via-git-geteiltes →
Memory-MCP-Graph** (`.claude/knowledge-graph.json`, im Repo — Domänen-Incidents, ADR-Relationen,
Architektur-Provenance; jeder Clone bekommt ihn).

### 6. ADR-Pflege (`docs/decisions.md` = kanonisch)

- **Neu: ADR-021 — „Memory-Graph operationalisiert (Pfad-Fix, Lese-Hook, Schreib-Disziplin, Abgrenzung
  natives Auto-Memory)"**, Status Accepted. Hält Root Cause + die 5 Maßnahmen + die Abgrenzung fest.
- **Nachtrag** in ADR-016 §3 und ADR-017 §3: einzeiliger Verweis „Pfad-Bug → No-Op; gefixt +
  operationalisiert in ADR-021".
- Doc-Sync (Hygiene): `CLAUDE.md` (root, Harness-Absatz: Memory jetzt operational + Abgrenzung),
  `docs/architecture.md` (Knowledge & Harness: Lese-Hook + Abgrenzung), `docs/monorepo-plan.md` (falls es
  die Memory-Schicht als erledigt/geseedet behauptet → auf „operationalisiert (Juni 2026, Pfad-Bug
  behoben)" korrigieren; per `grep -n "knowledge-graph\|Memory" docs/monorepo-plan.md` prüfen).

## Files to change

- `.mcp.json` — portabler `MEMORY_FILE_PATH`.
- `.claude/hooks/memory-surface.mjs` — **NEU** (SessionStart-Surface).
- `.claude/settings.json` — `memory-surface` als 2. SessionStart-Hook eintragen.
- `.claude/knowledge-graph.json` — Re-Seed (JSONL append).
- `.claude/skills/consolidate-lessons/SKILL.md` — REMEMBER-Scope + MCP-Calls + Commit-Schritt.
- `apps/ringwerk/CLAUDE.md`, `apps/treffsicher/CLAUDE.md` — Session-Start-Abfrage + Session-Ende-Capture.
- `docs/decisions.md` — ADR-021 + Nachträge 016/017.
- `CLAUDE.md` (root), `docs/architecture.md`, `docs/monorepo-plan.md` — Doc-Sync.

## Required Docs (vor Implementierung lesen)

- `docs/decisions.md` ADR-016/017/018/019 (Schicht-3-Intent, REMEMBER-Triage, Harness-Hooks).
- `.claude/skills/consolidate-lessons/SKILL.md` (aktueller REMEMBER-Schritt).
- `.claude/hooks/{codegraph-ensure,pretool-guard}.mjs` (Hook-Muster: fail-open, detached,
  `additionalContext`, Session-Marker).
- `docs/shared-conventions.md` §6 (ActionResult — Kontext für das State-Seed).
- claude-code-guide-Befund (in dieser Session): `${CLAUDE_PROJECT_DIR:-.}`-Expansion in `.mcp.json`,
  Quelle https://code.claude.com/docs/en/mcp.md.

## Test steps / Verification

**Statisch (gleicher Lauf):**
- `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8'))"` → valides JSON.
- `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"` → valides JSON.
- `node --check .claude/hooks/memory-surface.mjs` → Syntax OK.
- JSONL-Integrität: `node -e "require('fs').readFileSync('.claude/knowledge-graph.json','utf8').trim().split('\n').forEach((l,i)=>{try{JSON.parse(l)}catch(e){console.error('Zeile',i+1,'kaputt');process.exit(1)}});console.log('JSONL ok')"`.
- Hook-Verhalten ohne Reload: `echo '{}' | node .claude/hooks/memory-surface.mjs` → gibt `additionalContext`
  mit Entity-Zähler N (>0) aus; gegen leere Datei → still `exit 0`, keine Ausgabe.
- `pnpm check` — alle 5 Gates grün (nur Harness/Doku/JSON berührt, keine turbo-Inputs → cache-grün).

**Akzeptanz-Gate (erfordert Claude-Code-Reload, in `/validate`):**
1. Neue Session → der SessionStart-Surface erscheint im Kontext (N Entities sichtbar).
2. `mcp__memory__read_graph` liefert die geseedeten Entities (**Lesen gefixt** — der Kern-Bug weg; vor dem
   Fix war es `{entities:[]}`).
3. Probe-Write: `mcp__memory__create_entities` (Wegwerf-Entity) → `git status` zeigt
   `.claude/knowledge-graph.json` **modified** (**Schreiben landet in der getrackten Datei**) →
   `mcp__memory__delete_entities` → Datei zurück auf Seed-Stand. (Vor dem Fix: ENOENT.)

## Commits (ein fokussierter Commit pro Task)

1. `docs(plan)`: dieser Plan (erster Commit auf dem Branch).
2. `fix(mcp)`: portabler `MEMORY_FILE_PATH` (der entscheidende Fix).
3. `feat(hooks)`: `memory-surface` SessionStart-Hook + settings-Verdrahtung (Lese-Pfad).
4. `feat(memory)`: Re-Seed `knowledge-graph.json` (ADR-Backbone aktuell + Incidents/State + Relationen).
5. `docs(skills)`: `consolidate-lessons` REMEMBER-Scope + MCP-Write + Commit-Schritt (Schreib-Pfad).
6. `docs(claude)`: App-CLAUDE.md Session-Start/-Ende-Memory-Checkliste (beide Apps).
7. `docs(adr)`: ADR-021 + Nachträge 016/017; Doc-Sync architecture/root-CLAUDE/monorepo-plan.

## Self-review (gegen den Scope)

- Jeder der 6 User-Punkte hat Tasks: Pfad-Fix→Task2; Lesen→Task3; Schreiben→Task5+6; Re-Seed→Task4;
  Abgrenzung→Task4(seed)+Task7(doc); ADR-016/017→Task7. ✔
- Keine Platzhalter: Pfad-Wert, Hook-Verhalten + `additionalContext`-Text, Seed-Entities/-Relationen,
  Verifikations-Befehle sind konkret ausformuliert. ✔
- Henne-Ei adressiert: Re-Seed via direktem JSONL-Edit, Reload-Akzeptanz-Gate separat. ✔
- Namen konsistent: `memory-surface.mjs`, `${CLAUDE_PROJECT_DIR:-.}`, `entityType` `incident`/`state`/
  `decision` durchgängig. ✔
- ADR-Respekt (Hard Rule 6): kein Widerspruch zu ADR-016/017 — Bugfix + Operationalisierung ihrer schon
  beschlossenen Intent; transparent als ADR-021 + Nachträge dokumentiert. ✔
