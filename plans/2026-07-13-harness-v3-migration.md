# Plan: Harness-Migration v2.0 (built doc-index) → v3.1 (Obsidian-Vault-Graph)

**Datum:** 2026-07-13 · **Branch:** `feat/harness-v3` · **PIV:** Schritt 1 (plan)

## Context (warum)

Die vereinsheim-Harness (`.claude/` + `docs/`) stammt aus dem `basic-harness`-Blueprint,
wurde aber **vor Tag `v2.0` geforkt und seither stark projekt-angepasst** (Monorepo,
autonomes `/implement`, Sicherheits-Fixes in den Guards, eigene ADR-Kette bis ADR-024).
Der Blueprint steht heute auf **`v3.1`**: das gebaute Doku-Index-System (`build-graph.mjs`
→ `knowledge-graph.json`, gelesen via `doc.mjs`-Fragment-Pointer) ist durch einen
**Obsidian-kompatiblen `vault/`-Graph** ersetzt — die Notes **sind** der Graph, kein
Build-Schritt, live editiert, validiert von `vault-lint.mjs`.

Ziel: die vereinsheim-Harness auf das v3.1-System heben, **ohne die projekt-eigenen
Anpassungen zu verlieren**. Es ist ein **3-Wege-Merge** (v2.0-Ursprung × v3.1-Upgrade ×
vereinsheim-Anpassungen), **kein** „overwrite my copies" wie der Standard-Migrations-Prompt
suggeriert.

### Divergenz-Befund (Grundlage)

Gemessene Datei-für-Datei-Divergenz der gemeinsamen `.claude/`-Maschinerie:
- **2 identisch** (`keyword-extract.mjs`, `check-bindings.test.mjs`) → 1:1 übernehmen.
- **13 rein lokal** (Blueprint unverändert, vereinsheim angepasst) → **behalten**: `doc.mjs`,
  `_lib.mjs`, `pretool-guard.mjs`, `stop-gate.mjs`, `posttool-lint.mjs`,
  `autopilot-marker-reset.mjs`, `codegraph-ensure.mjs`, `search-synonyms.mjs`,
  Skills `cleanup-todos`/`debug`/`validate`, plus Tests.
- **2 reines Upgrade** (`graph-store.mjs`, `memory-server.mjs`) → v3.1-Version nehmen.
- **17 echte Konflikte** (beide geändert) → einzeln mergen (Details unten).
- **vereinsheim-only** (kein Blueprint-Pendant, unberührt lassen): Skills `db-reset`,
  `migrate`, `seed`; `context/dev-workflow.md`; `.claude/CLAUDE.md` (CodeGraph-Hinweis).

### ADR-Konsequenz (Hard Rule #6)

Das v3-Vault-System **widerspricht direkt ADR-022** („Memory-Graph als *gebauter* Index;
Store `.claude/knowledge-graph.json` ist Artefakt, **nie von Hand editieren**"). v3 wirft
genau das um (Notes live editieren, kein Build). Die Migration legt daher **ADR-025 —
Memory-Graph als Obsidian-kompatibler Vault-Graph (supersedes ADR-022, schärft
ADR-016 §3 / ADR-021)** an. Die BM25/EN+DE-Such-**Engine** aus ADR-022 bleibt erhalten;
nur ihre **Quelle** wechselt von `knowledge-graph.json` auf `vault/`.

## Entscheidungen (mit User geklärt)

1. **Umfang:** alles in **einem Durchlauf** (ein Branch, viele Commits) — machinery +
   kompletter Content (25 ADRs + ~92 projizierte Entities → Notes).
2. **Taxonomie:** vereinsheims reiche Typen auf die **7 v3-Kern-Typen** mappen
   (`guide/subsystem/operation/concept/decision/incident/source`) — keine Loader-Erweiterung.
   Mapping: `domain-rule`/`ops-constraint` → `concept`, `feature` → `subsystem`,
   `state` → `incident`, `app` → `guide` (MOC), `project` → `overview`. Ursprungstyp als
   `tags:` erhalten.
3. **Hook-Architektur:** **Composite-Dispatcher** übernehmen (`pretool.mjs`/`stop.mjs`);
   die 4 vereinsheim-Guards auf `evaluate()`-Export refactoren (mit erhaltenem
   `main()`-Standalone).

## Ausführungs-Regeln (kritisch)

- **INTERAKTIV / `/implement --step` — NICHT autonom.** Der `autopilot-guard` schützt
  `.claude/`, `scripts/`, ADRs — das autonome `/implement` würde diese Migration
  **selbst blocken**. Der Marker `.claude/.autopilot-active` wird **nicht** gesetzt.
- **Session-sichere Reihenfolge** (die laufende Session nutzt die alten, bis-Reload
  verdrahteten Hooks; Hook-`.mjs` werden aber pro Event frisch gelesen):
  1. Neues additiv anlegen (vault-Engine, Dispatcher, `vault/`) — stört nichts.
  2. `graph-sync.mjs` **erst** auf `vault-lint` umstellen, **nachdem** `vault/` befüllt &
     `vault-lint` grün ist (sonst blockt der Stop-Hook das Turn-Ende).
  3. v2-Dateien (`build-graph.mjs` etc.) **zuletzt** löschen — erst wenn nichts mehr
     darauf verweist.
  4. Alle refactorten Hooks behalten `if (isMain) main()` (settings.json ruft sie bis
     Reload direkt, nicht über den Dispatcher).
- **Verifikation im Haupt-Tree** (kein Worktree — ADR-024, Hauptsession-Entscheid): der
  Diff berührt keinen App-Code; `pnpm check` (Stop-Gate) braucht `.env`/Dev-DB, die nur
  im Haupt-Tree liegen.

## Required Docs (Implementer liest zuerst)

- Blueprint `v3.1` (Repo `/Users/christian/repos/basic-harness`, via `git show v3.1:<pfad>`
  oder Working-Tree = v3.1):
  - `MIGRATING-v2-to-v3.md`, `vault/SCHEMA.md` (Ziel-Vertrag), `KNOWLEDGE.md` (System),
    `BLUEPRINT.md`.
  - Referenz-Maschinerie: `.claude/vault-loader.mjs`, `.claude/vault-lint.mjs`,
    `.claude/hooks/{pretool,stop,knowledge-capture,graph-sync,memory-surface}.mjs`,
    `.claude/skills/{sync-graph,plan,ingest,harness-init}/SKILL.md`.
  - Blueprint-Skills bereits exportiert nach
    `…/scratchpad/bp/{check,cleanup-todos,commit-msg,consolidate-lessons,debug,harness-init,implement}.md`.
- vereinsheim: `docs/decisions.md` (ADR-Quelle), `docs/shared-conventions.md` (@-import),
  `docs/{spec,architecture,operations,monorepo-plan}.md`, `.claude/graph-projection.mjs` +
  `.claude/graph-captured.mjs` + `.claude/knowledge-graph.json` (Entity-Quellen),
  `scripts/consistency-check.sh` (referenziert `shared-conventions.md`).

## Ziel-vault-Struktur (Topic-Ordner + MOCs)

```
vault/
├── SCHEMA.md · index.md · overview.md · conventions.md   (Root-Meta + @-imports)
├── _templates/ · .obsidian/                              (aus Blueprint)
├── decisions/      adr-001…adr-025 (decision) + decisions.md (MOC)
├── architecture/   architecture.md (MOC) · system-topologie · netz-split · build-deploy-pipeline
├── deployment/     compose · caddy · postgres-container · docker-hub-images · migrator · backup/restore
├── operations/     operations.md (MOC) · vereinsheim-CLI · daily-ops · recovery-pfade
├── monorepo/       turbo/pnpm/catalog · packages-config/lib/ui · drift-gate · dev-postgres
├── apps/           ringwerk.md (MOC) · treffsicher.md (MOC) + deren feature-Notes (subsystem)
├── harness/        memory-graph · hooks · PIV-workflow · autonomous-implement · sub-agents
├── domain/         domain-rules (concept): wertungs-/fachlogik
└── incidents/      captured incidents/state (aus graph-captured.mjs)
```
(Feinzuordnung darf der Implementer je nach Entity anpassen; Regel: 1 Topic-Ordner =
1 MOC-Hub `guide` + atomare Notes.)

---

## Tasks

Jede Task = ein fokussierter Commit; Gate = der jeweils genannte Test **muss** grün sein.

### Block A — Additive v3-Engine (stört die laufende Session nicht)

**A1. Neue Engine-Dateien aus Blueprint v3.1 kopieren.**
`cp` aus `basic-harness` (Working-Tree = v3.1): `.claude/vault-loader.mjs`,
`.claude/vault-lint.mjs`, `.claude/hooks/knowledge-capture.mjs`. Zusätzlich
`.claude/launch.json` (Blueprint-neu; vereinsheim hat keine — als schlanke leere/Referenz
übernehmen, siehe Task J2 zur FILLABLE-Konsequenz).
_Test:_ `node -c .claude/vault-loader.mjs && node -c .claude/vault-lint.mjs && node -c .claude/hooks/knowledge-capture.mjs` (Syntax).

**A2. Reine-Engine-Upgrades auf v3.1-Version heben.**
`graph-store.mjs`, `memory-server.mjs`, `doc-index.mjs`, `search-index.mjs`,
`keyword-extract.mjs`, `check-bindings.test.mjs` durch die Blueprint-v3.1-Fassung ersetzen
(kein vereinsheim-Spezifikum darin — `doc-index`/`search-index` sind reine Engine; die
neuen `TYPE_WEIGHTS` passen zu den Kern-Typen aus Entscheidung 2).
**Ausnahme:** `search-synonyms.mjs` **behalten** (vereinsheim-eigene DE/Domänen-Synonyme;
Blueprint hat es nicht verändert).
_Test:_ `for f in graph-store memory-server doc-index search-index keyword-extract; do node -c .claude/$f.mjs; done` + `node .claude/hooks/memory-server.test.mjs` (aus Blueprint mitkopieren) + `node .claude/hooks/memory-server.mjs` startet ohne Crash (liest leeres/künftiges `vault/`).

### Block B — vault/-Gerüst

**B1. Statisches vault-Gerüst aus Blueprint kopieren.**
`vault/SCHEMA.md`, `vault/_templates/` (alle 7), `vault/.obsidian/`, plus Root-`KNOWLEDGE.md`.
`vault/index.md` als leeres Gerüst anlegen (füllt Task I1).
_Test:_ `ls vault/_templates/*.md | wc -l` = 7; `test -f vault/SCHEMA.md`.

### Block C — Content: ADRs (die 25 decision-Notes)

**C1. `docs/decisions.md` → `vault/decisions/adr-001.md … adr-024.md`.**
Ein File pro `## ADR-NNN — Titel`. Frontmatter: `id: adr-NNN`, `type: decision`,
`title`, `status:` (aus `**Status**`), `supersedes: ["[[adr-XXX]]"]` wo „(supersedes
ADR-XXX)" steht (ADR-015→adr-001, ADR-020→adr-018, ADR-023→adr-020, ADR-024→adr-023 usw.,
gemäß den Klammer-Verweisen). Body in **`## Kontext` / `## Entscheidung` / `## Alternativen`
/ `## Folgen`**-Sektionen (v3.1-Konvention, keine inline-Bold-Labels). `keywords:` je ADR
kuratiert. `vault/decisions/decisions.md` als MOC (`type: guide`) mit Liste aller ADRs.
_Test:_ `ls vault/decisions/adr-*.md | wc -l` = 24; `node .claude/vault-lint.mjs` meldet für decisions/ keine dangling edges.

**C2. ADR-025 anlegen (supersedes ADR-022).**
`vault/decisions/adr-025.md`: „Memory-Graph als Obsidian-kompatibler Vault-Graph".
`status: Accepted`, `supersedes: ["[[adr-022]]"]`, `refines: ["[[adr-016]]","[[adr-021]]"]`.
Kontext (Build-Reibung/Doppelpflege des gebauten Index), Entscheidung (vault=Graph, live,
kein Build; `vault-loader` liest direkt; `vault-lint` validiert; BM25-Engine bleibt, Quelle
wechselt), Alternativen (gebauter Index = ADR-022, jetzt abgelöst), Folgen (`doc.mjs` bleibt
Reader; `graph-sync`→`vault-lint`; `/sync-graph` + `/consolidate-lessons` schreiben live).
In `adr-022.md` `status: Superseded` + `superseded_by: ["[[adr-025]]"]` setzen.
_Test:_ `node .claude/vault-lint.mjs` grün für die supersedes-Kette.

### Block D — Content: Guides (Doku-Prosa → Topic-MOCs + Root-Guides)

**D1. Root-Guides.**
`docs/spec.md`/README-Essenz → `vault/overview.md` (`type: guide`);
`docs/shared-conventions.md` → `vault/conventions.md` (`type: guide`, wird @-importiert —
Task H1). Frontmatter `id/type/title` voranstellen.
_Test:_ `node .claude/vault-lint.mjs` erkennt beide als guide (kein missing title).

**D2. Topic-MOCs + Guide-Prosa.**
`docs/architecture.md` → `vault/architecture/architecture.md` (MOC);
`docs/operations.md` → `vault/operations/operations.md` (MOC);
`docs/monorepo-plan.md` → `vault/monorepo/monorepo.md` (MOC).
Je MOC `type: guide` + Links auf die atomaren Notes seines Topics (Block E). Prosa bleibt
im Guide; atomare Notes referenzieren Abschnitte via `documented_in: ["[[guide#Heading TEXT]]"]`.
_Test:_ `node .claude/vault-lint.mjs` — jeder `documented_in`-Anchor trifft eine reale Überschrift.

### Block E — Content: atomare Entities (~92 → Kern-Typen)

**E1. Projizierte Entities → atomare Notes.**
Quelle: `.claude/graph-projection.mjs` (Essenz + `→ datei#slug`-Pointer + Relationen) +
`.claude/knowledge-graph.json` (fertige Typ-/Relations-Struktur als Referenz). Pro Entity
eine Note im passenden Topic-Ordner (Struktur oben), Typ **gemappt** (Entscheidung 2):
`domain-rule`/`ops-constraint`→`concept`, `feature`→`subsystem`, `app`→`guide`,
`project`→`vault/overview.md`. Jede Note: `**TL;DR**` (= alte Essenz), **echter Body** (die
Prosa aus dem `→ datei#slug`-Zielabschnitt hereinziehen — **kein** Ein-Zeilen-Stub),
kuratierte `keywords:`-Zeile (Pflicht für atomare Typen, sonst `vault-lint`-Fehler),
`tags:` mit dem Ursprungstyp, flache Edges (`part_of` MOC, `governed_by` ADR,
`documented_in` Guide#Heading, plus `relates_to`/`contrasts_with`/`see_also` aus der
projection).
_Test:_ `node .claude/vault-lint.mjs` grün (alle atomaren Notes haben `keywords`, keine
dangling edges); Stichprobe `mcp__memory__search_nodes` (nach Reload) findet 3 bekannte Entities.

**E2. `graph-captured.mjs` → `vault/incidents/`.**
Jede `incident`/`state`-Entity → eine `type: incident`-Note mit `keywords:` + `[[link]]`
in ein Topic. (Diese überlebten in v2 jeden Rebuild; in v3 sind sie normale Notes.)
_Test:_ `node .claude/vault-lint.mjs` grün.

### Block F — Hooks: Dispatcher + evaluate()-Refactor

**F1. `graph-sync.mjs` auf vault-lint + evaluate() umstellen** (Blueprint-v3.1 als Basis).
Ruft `vault-lint.mjs` (statt `build-graph.mjs`); exportiert `evaluate(input) → {block,message}`;
behält `if (isMain) main()`. Nudge-Text auf Deutsch + Richtung `/sync-graph`.
**Voraussetzung:** Block B–E fertig, `vault/` befüllt (sonst blockt der Stop-Hook diese Session).
_Test:_ `echo '{}' | node .claude/hooks/graph-sync.mjs; echo $?` = 0 (vault grün).

**F2. Guards auf `evaluate()`-Export refactoren.**
`pretool-guard.mjs`, `autopilot-guard.mjs`, `stop-gate.mjs`: die Kernlogik in
`export function evaluate(input)` extrahieren (pre: `{deny,reason,context,contextMarker}`;
stop: `{block,message}`), `main()` ruft `evaluate` + setzt exit-code. **Inhaltliche Logik
unverändert** (alle Sicherheits-Fixes, `pnpm check`-Gate, quote-aware Tokenizer bleiben).
_Test:_ die bestehenden `pretool-guard.test.mjs` + `autopilot-guard.test.mjs` bleiben grün:
`node --test .claude/hooks/*.test.mjs`.

**F3. Dispatcher + neue Tests übernehmen.**
`pretool.mjs`, `stop.mjs` aus Blueprint v3.1 kopieren; `stop.mjs`-Import so, dass es
vereinsheims `graph-sync`+`stop-gate`+`knowledge-capture` orchestriert. Tests
`pretool.test.mjs`, `stop.test.mjs` mitkopieren/anpassen.
_Test:_ `node --test .claude/hooks/{pretool,stop}.test.mjs`; `echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node .claude/hooks/pretool.mjs; echo $?` = **2**.

**F4. `memory-surface.mjs` auf vault umstellen** (Blueprint-v3.1-Basis + DE-Text).
Surface't den `vault/`-Index statt `knowledge-graph.json`; deutsche SessionStart-Message
mit Entity-Zählung, Verweis auf `search_nodes`/`document_map`/`section_read`.
_Test:_ `echo '{}' | node .claude/hooks/memory-surface.mjs` gibt eine vault-basierte Zusammenfassung ohne Crash.

### Block G — Binding-Cluster (kohärent mergen)

**G1. `autopilot-guard.mjs` PROTECTED an vault anpassen** (vereinsheim-Basis behalten).
In `PROTECTED_FILE_PATTERNS`: `rel === "docs/decisions.md"` ersetzen durch
`(rel) => /(^|\/)vault\/decisions\//.test(rel)` (ADR-Kanon-Location gewandert). Rest der
Patterns (compose.yml/Caddyfile/Dockerfile/db-init/prisma) unverändert. (`PROTECTED_DIRS`
`.claude/`+`scripts/` bleibt; deckt `vault/` NICHT ab — gewollt, damit interaktives
Editieren möglich bleibt, aber ADRs bleiben geschützt.)
_Test:_ `autopilot-guard.test.mjs` grün; manueller Probe-Input mit `vault/decisions/adr-001.md` → deny (exit 2) bei gesetztem Marker.

**G2. `check-bindings.mjs` mergen.**
`FILLABLE`: `docs/architecture.md` → `vault/architecture/architecture.md`; `vault/overview.md`,
`vault/conventions.md`, `vault/operations/operations.md`, `.claude/launch.json` ergänzen
(aus Blueprint); vereinsheim-Skills `migrate`/`db-reset`/`seed` **behalten**; die
`docs/`-Ausschluss-Kommentare (shared-conventions/operations/spec/sync-graph False-Positives)
auf die neuen `vault/`-Pfade neu justieren. Variablennamen-Checks an vereinsheims
`stop-gate` (`GATE`, nicht `TURN_GATE`) und die neue `autopilot-guard`-Realität
(`vault/decisions/`-Pattern statt `PROTECTED_FILES=['docs/decisions.md']`) anpassen.
_Test:_ `node .claude/check-bindings.mjs; echo $?` = 0 („vollständig gebunden").

**G3. `settings.json` auf Dispatcher + vault-Permissions** (greift bei Reload).
`PreToolUse` → nur `pretool.mjs`; `Stop` → nur `stop.mjs`; `PostToolUse`-Matcher
`Edit|Write|NotebookEdit`. `permissions.allow`: memory-write-Einträge
(`create_entities`/`create_relations`/`add_observations`) **entfernen** (v3 editiert Notes
als Datei), `Bash(node .claude/vault-lint.mjs)` + `Bash(node .claude/check-bindings.mjs)` +
`Bash(node .claude/doc.mjs:*)` ergänzen. SessionStart (marker-reset/codegraph-ensure/
memory-surface) beibehalten.
_Test:_ `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json'))"` (valides JSON); Sichtprüfung Dispatcher verdrahtet.

### Block H — Skills

**H1. `sync-graph` — Heavy, Blueprint-v3.1-Basis + DE + Bindings.**
Kompletter Ersatz des v2-Build-Modells: Workflow = `git diff -- vault/` → `node
.claude/vault-lint.mjs` (Fehler in der Note beheben: id/type, dangling `[[edge]]`, title,
`documented_in`-Anchor, `keywords:`) → Cross-Ref-Lücken schließen → `vault/index.md`
pflegen. Auf Deutsch; vereinsheims Relations-Vokabular (`feature_of`/`subsystem_of`/
`governed_by`/`contrasts_with`/`see_also`/`relates_to`/`informed_by`) einweben; ADR-Verweis
auf **ADR-025** (nicht Blueprint-adr-011). Kein `build-graph`/`knowledge-graph.json`/`doc.mjs`-Rebuild mehr.
_Test:_ Skill referenziert 0× `build-graph|knowledge-graph.json|graph-projection`; `grep -c vault .claude/skills/sync-graph/SKILL.md` > 0.

**H2. `consolidate-lessons` — Medium, vereinsheim-Basis, nur REMEMBER chirurgisch.**
Triage-Engine (ENFORCE-Mechanismen, Opus-Analyse-Agent, DOCUMENT-Ziele, idempotente
`## Aus Lernlog übernommen`-Sektion, DE-Report) **unverändert behalten**. Nur den
REMEMBER-Zweig (Schritt 5 + L23-24 + L62-77) umschreiben: statt „Quelle + Rebuild
(`graph-captured.mjs`/`graph-projection.mjs`, `Keywords:`-Zeile, `build-graph`)" →
„`incident`-Note unter `vault/incidents/` (aus `_templates/incident.md`; `keywords:` +
`[[link]]`); kein Build — die Note ist live; `vault-lint` validiert." Verweis ADR-022→ADR-025.
_Test:_ Skill referenziert 0× `build-graph|knowledge-graph.json`; ENFORCE/DOCUMENT-Struktur intakt (Diff nur im REMEMBER-Block).

**H3. `plan` — Medium, Blueprint-v3.1-Basis + vereinsheim-Bindings re-appliziert.**
Blueprint-Struktur (Tier-Modell, Plan-Template, Plan-Approval-Gate) übernehmen, aber:
**ADR-024-Worktree-Stance einspielen** (Skills erstellen/erzwingen keinen Worktree —
Hauptsession entscheidet vorab; Blueprint-`.claude/worktrees/`-Annahme **entfernen**),
codegraph-first-Exploration erhalten, Pfade auf `vault/` + `apps/<app>/docs/*`, `pnpm
check`/`feat/<topic>`, Deutsch. Graph-Query-Schritt auf `mcp__memory__search_nodes` +
`section_read` (statt `doc.mjs #slug`).
_Test:_ Skill nennt ADR-024 + „kein Worktree"; referenziert 0× `.claude/worktrees` als Vorgabe.

**H4. Sechs Light-Skills.**
`implement`, `review`, `check`, `test`, `commit-msg` → **vereinsheim-Basis behalten**
(keine Knowledge-Store-Referenzen; ADR-023/`--step`/Ledger/ADR-024 in `implement`,
Drift-Check in `review` sind reicher als Blueprint). Optional cherry-picken (nicht
zwingend): Findings-Tabelle in `review`, Fast-Gate-Idee in `check`. **Keine** Store-Rewrites nötig.
_Test:_ `grep -lE 'build-graph|knowledge-graph.json|graph-projection' .claude/skills/{implement,review,check,test,commit-msg}/SKILL.md` = leer.

**H5. Neue Skills übernehmen.**
`ingest` (Blueprint-v3.1, ~as-is, Englisch; braucht `vault/sources/` + `.raw/`-Konvention —
Ordner bei erstem Gebrauch). `harness-init`: als **Referenz/Binding-Contract** übernehmen,
die Binding-Tabelle auf vereinsheims bereits gestampfte Werte gemappt, Greenfield-Phasen
(0–2, „ADRs ab adr-012") als **erfüllt** markiert (vereinsheim ist reif/gebunden) — nicht
als runnable-Bootstrap.
_Test:_ `test -f .claude/skills/ingest/SKILL.md && test -f .claude/skills/harness-init/SKILL.md`.

**H6. Unberührt lassen.** `db-reset`, `migrate`, `seed`, `cleanup-todos`, `debug`,
`validate` — kein Handlungsbedarf (verifiziert: keine Knowledge-Refs bzw. Blueprint-identisch).

### Block I — Rewire (Referenzen umbiegen)

**I1. Root-`CLAUDE.md`.**
`@import`-Zeilen: `@docs/architecture.md` → `@vault/architecture/architecture.md`,
`@docs/shared-conventions.md` → `@vault/conventions.md`. Lese-Reihenfolge auf `vault/`-Pfade;
den Memory-Graph-Abschnitt (ADR-022 „gebauter Index") auf das v3-Vault-Modell (ADR-025)
umschreiben; alle `docs/`-, `build-graph`-, `knowledge-graph.json`-, `doc.mjs #slug`-Verweise
auf `vault/`-Äquivalente. `vault/index.md` mit dem finalen Katalog + Lese-Reihenfolge füllen.
_Test:_ `grep -nE 'docs/|build-graph|knowledge-graph\.json' CLAUDE.md` = nur bewusste
historische Verweise (in superseded-ADR-Kontext); `@vault/` vorhanden.

**I2. App-`CLAUDE.md` + `.mcp.json`-Check.**
`apps/ringwerk/CLAUDE.md` + `apps/treffsicher/CLAUDE.md`: Memory-Graph-/Doku-Index-Verweise
auf das v3-Vault-Modell umbiegen. `.mcp.json` **unverändert** bestätigen (Pfad
`memory-server.mjs` gleich; nur v3-Server liest jetzt `vault/`).
_Test:_ `grep -rlE 'build-graph|knowledge-graph\.json|Doku-Index' apps/*/CLAUDE.md` = leer (bzw. auf v3 umformuliert).

**I3. `scripts/consistency-check.sh` + Drift-Gate.**
Prüfen, ob `shared-conventions.md` als Pfad im Gate steht; auf `vault/conventions.md`
umstellen (die byte-identisch-erzwungene @-import-Datei ist umgezogen). `MUST_MATCH`-Liste
entsprechend.
_Test:_ `bash -n scripts/consistency-check.sh`; grep im Skript nach `shared-conventions` → 0 offene Treffer, `vault/conventions.md` referenziert.

### Block J — v2-Altlasten entfernen (ZULETZT)

**J1. v2-Knowledge-System löschen.**
`git rm` : `docs/` (komplett — Inhalt ist nach `vault/` migriert), `.claude/build-graph.mjs`,
`.claude/graph-projection.mjs`, `.claude/graph-captured.mjs`, `.claude/knowledge-graph.json`,
`.claude/knowledge-graph.search.json`. **Behalten:** `.claude/doc.mjs` (v3-Reader),
`.claude/graph-store.mjs`, `.claude/search-*.mjs`, `.claude/context/dev-workflow.md`.
**Voraussetzung:** F1 erledigt (graph-sync ruft nicht mehr build-graph), Block C–E fertig.
_Test:_ `node .claude/vault-lint.mjs` grün; `node .claude/hooks/graph-sync.mjs < /dev/null; echo $?` = 0; kein Import-Fehler.

**J2. Leftover-Sweep.**
`grep -rInE 'build-graph|graph-projection|graph-captured|knowledge-graph\.json|docs/' --include='*.md' --include='*.mjs' --include='*.json' . ':!vault/decisions'` — jeden Treffer
außerhalb superseded-ADR-Bodies fixen (Skills, Hooks, CLAUDE.md, README).
_Test:_ Sweep liefert nur bewusste historische Verweise.

### Block K — Verifikation (PIV-Schritt 3 `/validate`)

- `node .claude/vault-lint.mjs` → grün, 0 unerwartete Orphans.
- `node .claude/check-bindings.mjs; echo $?` → 0.
- `node --test .claude/hooks/*.test.mjs` → alle grün.
- `echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node .claude/hooks/pretool.mjs; echo $?` → **2**.
- `node .claude/search-selftest.mjs` → grün (nach Anpassung der Cases an die neuen Notes; falls Cases zu stark v2-gebunden, in diesem Block neu schreiben).
- `pnpm check` (5 Gates) → grün (berührt keinen App-Code, sollte unverändert grün sein).
- **Reload-Probe:** neue Claude-Session starten → SessionStart surft `vault/`;
  `mcp__memory__search_nodes` beantwortet eine DE-Frage aus dem Vault.

## Out of scope

- **Phase 5** (CI/GitHub Actions, Turbo-Remote-Cache) — unverändert offen, kein Teil davon.
- **`git push origin main`** — deploy-irrelevant, user-gated, separat.
- NODE_TYPES-Erweiterung (Entscheidung 2 = mappen, nicht erweitern).
- Semantischer Reranker (ADR-008-Seam) — nicht nötig bei diesem Vault-Volumen.

## Rollback

Alles auf `feat/harness-v3`; der v2-Stand ist per Tag/Branch erhalten. `git checkout main`
(oder Branch löschen) stellt v2 vollständig wieder her. Nichts ist destruktiv bis zum Merge.
Merge nach `main` (`--ff-only`) erst nach `/validate` + `/review` + **User-OK**.

## Self-Review

- Jede Divergenz-Kategorie hat Tasks: identisch (A2), rein-lokal (behalten, H4/H6/G1),
  Upgrade (A2), Konflikt (C/D/F/G/H1–H3/I), vereinsheim-only (H6). ✓
- ADR-Konsequenz adressiert (C2, in CLAUDE.md I1). ✓
- Session-Sicherheit als Reihenfolge-Regel + F1/J1-Voraussetzungen kodiert. ✓
- Autopilot-Konflikt: interaktiv/`--step`, Marker nicht gesetzt. ✓
- Keine Platzhalter: jede Task nennt Dateien + konkreten Test. ✓
- Namensträger konsistent: `evaluate()`-Verträge (F2/F3), `vault/decisions/`-Pattern
  (G1↔G2), `GATE`-Varname (G2), Kern-Typen (E1↔A2 TYPE_WEIGHTS). ✓
