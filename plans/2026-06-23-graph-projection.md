# Plan — Memory-Graph als gebauter, relationenreicher Doku-Index (Fragment-Pointer)

> PIV-Plan (Schritt 1/4). Handoff für `/implement`. Branch: `feat/graph-projection`.
> Revision 2: erweitert von „Projektion" zu „angereicherter Index über die gesamte Doku" — die
> eigentliche Nutzen-Idee (schneller, token-sparsamer Einstieg über Graph → Fragment).

## Context (warum)

Der Memory-Graph (`.claude/knowledge-graph.json`, MCP-Layer-3, ADR-016) soll der **kuratierte,
relationenreiche Index über die gesamte Dokumentation** werden — das symmetrische Gegenstück zu
CodeGraph (Index über den Code). Arbeitsmuster: erst den Graphen fragen *wo* die Antwort steht
(Entity-Essenz + präziser Pointer + Relationen zum Weitergehen), dann **nur das kleine Fragment** lesen.

Drei Probleme von heute, die das löst:
1. **Nicht selbstaktualisierend / manuell gepflegt** (ADR-021: modellgetriebenes Schreiben, war No-Op).
2. **Doppelpflege/Drift** — Volltext im Graph *und* in den Docs.
3. **Token-Verschwendung beim Einstieg** — Pointer auf ganze Dateien (z.B. `features.md`, 595 Z.) → der
   Agent liest viel „umsonst".

**Lösung in zwei Hebeln:**
- **Präzises Retrieval:** Pointer auf **Fragmente** (`datei.md#überschrift`) + ein Fragment-Reader, der
  nur den Abschnitt druckt. Docs bleiben ganze, menschenlesbare Dateien (kein Massen-Splitting).
- **Immer-geladene Schicht schrumpfen:** ein knapper „Rules of the road"-Kern bleibt `@import`; der Rest
  (architecture/conventions-Detail) wandert in den on-demand-Index.

**Ehrliche Determinismus-Grenze:** `Docs → Manifest` ist **modellgetrieben** (seltener `/sync-graph`);
`Manifest+ADRs+Captured → Graph` ist **deterministisch** (Builder, hook-/CI-fähig). Prosa hat keine
AST-Struktur — voll-automatisches „Doc ändert sich → Graph baut sich ohne Modell neu" ist NICHT drin.

**Ehrliches Risiko:** immer-geladen = *garantiert*; indiziert = *muss aktiv geholt werden*. Der Stop-Gate
erzwingt Build-Korrektheit, **nicht** Konventions-Treue. Darum bleibt ein kondensierter Konventions-Kern
always-loaded; nur das Detail wird indiziert. Der Pointer-Validator schützt den Index vor Verrottung.

ADR-Bezug: ADR-016 (Graph = Layer 3, *nicht* Struktur-Autorität — gewahrt). ADR-021 (dessen
*Schreib-Mechanik* wird ersetzt → **ADR-022**).

## Approach

Drei eingecheckte **Quellen** → deterministischer **Builder** → **Artefakt**; dazu **Reader** + **Surface**:

```
docs/decisions.md            ──(deterministisch geparst)──┐
.claude/graph-projection.mjs ──(Manifest: kuratiert)──────┼─▶ .claude/build-graph.mjs ─▶ .claude/knowledge-graph.json
.claude/graph-captured.mjs   ──(Session-Provenance)───────┘        │  (validiert Pointer + Integrität)
        ▲                                                          ▼
        └─(modellgetrieben: /sync-graph)─ docs/*.md, apps/*/docs/*.md
.claude/doc.mjs  ── Fragment-Reader: `node .claude/doc.mjs <datei>#<slug>` druckt nur den Abschnitt
.claude/hooks/memory-surface.mjs ── SessionStart: Landkarte + „so fragst du den Index ab"
```

### Pointer-Konvention (für Reader + Validator + Autoren identisch)

- Jede indizierte Entity trägt **mindestens eine** Pointer-Observation der Form `→ <relpfad>#<slug>`
  (Sentinel `→ ` = U+2192 + Leerzeichen). Mehrere erlaubt (eine Entity kann in mehrere Docs zeigen).
- **Slug-Regel (GitHub-artig, dokumentiert im Builder-Header):** Überschriftstext → trim →
  lowercase → alles außer `\p{L}\p{N} _-` entfernen → Leerzeichen/`_` → `-` → Mehrfach-`-` kollabieren.
  Reader und Validator berechnen denselben Slug; Autoren schreiben den Slug der Ziel-Überschrift.
- Datei-ohne-`#` bleibt erlaubt (grobe Pointer), löst aber **keine** Fragment-Optimierung aus.

### Fragment-Reader `.claude/doc.mjs`

- `node .claude/doc.mjs apps/ringwerk/docs/features.md#ringteiler` → druckt ab der Überschrift, deren
  Slug matcht, bis zur nächsten Überschrift **gleicher oder höherer** Ebene. Exit 1 + stderr, wenn der
  Slug nicht existiert (Caller merkt es). Reines Lesen, keine Abhängigkeiten.

### Builder-Vertrag (`build-graph.mjs`)

- Merge in stabiler Reihenfolge: Manifest-Kern (project, apps) → ADRs (numerisch) → Manifest-Topics →
  Captured; dann alle Relationen gleicher Gruppenfolge. → saubere Git-Diffs, idempotent.
- Serialisierung: kompaktes JSONL im server-memory-Format (`{"type":"entity",…}` /
  `{"type":"relation",…}`), `JSON.stringify` (UTF-8 literal, keine `\u`-Escapes), abschließendes `\n`.
- **Validierung (Exit≠0):** (a) keine doppelten Entity-Namen; (b) keine Dangling-Relation; (c) jede
  Entity ≥1 Observation; (d) **jeder `→ datei#slug`-Pointer resolved** (Datei existiert, Slug ∈
  Heading-Slugs der Datei). (d) ist die Index-Korrektheits-Garantie.

### ADR-Parser (deterministisch aus `decisions.md`)

- Sektion `^## ADR-(\d{3}) — (.+)$` → Entity `ADR-NNN`; Status = erste `^\*\*Status\*\*: (.+)$`.
- Observations = `["Titel: <titel>", "Status: <status>", "→ docs/decisions.md#adr-nnn-<slug>"]`
  (Essenz + Fragment-Pointer; Prosa/Nachträge kanonisch in decisions.md).
- `supersedes` aus Titel-Regex `\(supersedes ADR-(\d+)\)`. Feinere `amends`-Cross-Refs → Manifest.

### Schreib-Mechanik neu (ADR-022)

Neues Projektgedächtnis = Eintrag in die passende **Quelle** (`graph-captured.mjs` für Incidents/State;
`graph-projection.mjs` für abgeleitete Topics) + Rebuild + Commit — **nicht** Live-`mcp__memory__`-Write
(den ein Rebuild überschriebe). Der MCP-Server bleibt **lesend** (liest die Datei pro Operation, ADR-021).

### Index-Korpus (alle lebenden Docs; `superpowers/`-Archive ausgenommen)

`docs/`: decisions (ADR-Parser), spec, operations, shared-conventions, architecture, monorepo-plan ·
`apps/ringwerk/docs/`: project-brief, architecture, features, data-model, technical, code-conventions,
ui-patterns · `apps/treffsicher/docs/`: requirements, data-model, technical-constraints, code-conventions,
backlog · `packages/*/CLAUDE.md` · `README.md`. Je Topic eine schlanke Entity (Essenz + Fragment-Pointer),
verbunden mit reichem Relationsvokabular.

### Relationsvokabular (erweitert)

Bestehend: `feature_of`, `subsystem_of`, `operation_of`, `constraint_of`, `part_of`, `applies_to`, `uses`,
`feeds`, `refined`, `targets`, `supersedes`, `amends`, `occurred_in`, `informed_by`.
Neu (Navigation): `governed_by` (Topic → ADR/Konvention, die es regelt), `contrasts_with` (z.B.
ringwerk-Rollen ↔ treffsicher-Per-User), `see_also`, `relates_to`.

## Files to change / create

**Neu:** `.claude/graph-projection.mjs` (Manifest) · `.claude/graph-captured.mjs` (Captured) ·
`.claude/build-graph.mjs` (Builder+Validator) · `.claude/doc.mjs` (Fragment-Reader) ·
`.claude/skills/sync-graph/SKILL.md`.

**Geändert:** `.claude/knowledge-graph.json` (ab jetzt gebaut) · `.claude/hooks/memory-surface.mjs`
(Landkarte/Anleitung) · `docs/decisions.md` (ADR-022 + Nachtrag-Verweise 016/021) ·
`.claude/skills/consolidate-lessons/SKILL.md` (REMEMBER → Quelle+Rebuild) · `CLAUDE.md` (Knowledge-Abschnitt
+ kondensierter Konventions-Kern + Phase-4-Stale-Fix) · `docs/architecture.md` · `docs/monorepo-plan.md`
(Header-Stale-Fix).

## Tasks (bite-sized, je ein Commit)

1. **Fragment-Reader** `.claude/doc.mjs` + Slug-Funktion (geteilt nutzbar). Test: druckt einen bekannten
   Abschnitt aus `operations.md`; Exit 1 bei Fake-Slug.
2. **Builder-Grundgerüst** `.claude/build-graph.mjs`: ADR-Parser + Merge + JSONL-Serialisierung +
   Integritäts-Validierung (Dup/Dangling/leer). Slug-Funktion aus Task 1 wiederverwenden.
3. **Pointer-Validator** im Builder ergänzen (Datei+Slug resolved). Eigener Task, weil er das ganze
   Korpus berührt und Autorenfehler früh fängt.
4. **Manifest-Quelle** `.claude/graph-projection.mjs` aus aktuellem Graph extrahieren (Entities mit
   entityType ∉ {decision,incident,state} + ihre Relationen + 4 kuratierte ADR-`amends`-Cross-Refs).
   **Pointer auf Fragment-Granularität heben** (`features.md` → `features.md#<heading>`).
5. **Captured-Quelle** `.claude/graph-captured.mjs`: incident×2 + state×1 + alle 6 Relationen mit ≥1
   captured-Ende (`occurred_in`×2, `applies_to`×2, `refined`, `targets`).
6. **Regenerieren + verifizieren** (Test-Schritte unten). Bei Abweichung außer ADR-Normalisierung:
   Quellen fixen, nie das Artefakt.
7. **Index-Korpus erweitern** — Topic-Entities + Fragment-Pointer für die restlichen Docs (Liste oben),
   inkrementell pro Doc/Doc-Gruppe. Jede neue Entity: Essenz ≤2 Zeilen + `→ datei#slug`.
8. **Relationen anreichern** — Navigations-Relationen (`governed_by`/`contrasts_with`/`see_also`/
   `relates_to`) zwischen Topics, ADRs, Conventions, Incidents. Ziel: dichtes, traversierbares Netz.
9. **SessionStart-Surface** `memory-surface.mjs` aufwerten: kompakte Landkarte (Top-Entities/Typen) +
   explizite Anleitung „Index zuerst via `mcp__memory__search_nodes`/`open_nodes`; Fragment via
   `node .claude/doc.mjs datei#slug`". Token-Budget klein halten.
10. **ADR-022** in `decisions.md` — „Memory-Graph als gebauter Doku-Index (Builder/Manifest/Captured/
    Fragment-Pointer)", Accepted (Juni 2026); Nachtrag-Verweise in ADR-016 §3 + ADR-021.
11. **`/sync-graph`-Skill** — modellgetrieben: geänderte Docs lesen → betroffene Manifest-Topics
    (Essenz+Fragment-Pointer) nachziehen, Captured nie überschreiben → `node .claude/build-graph.mjs` →
    Validierung grün + Round-Trip → an Commit erinnern.
12. **Schreib-Disziplin** — `consolidate-lessons` REMEMBER + Root/App-`CLAUDE.md`-Verweise: Capture =
    Quelle editieren + Rebuild, nicht Live-Write.
13. **@import schrumpfen (kleiner Kern)** — kondensierten „Rules of the road"+Konventions-Cheatsheet in
    Root-`CLAUDE.md` belassen; `architecture.md`/`shared-conventions.md`-Detail aus `@import` nehmen und
    über den Index erreichbar machen (Docs bleiben kanonisch + on-demand). **Zuletzt**, nach bewährtem Index.
14. **Doc-Sync** — `architecture.md` Knowledge-Abschnitt + `monorepo-plan.md`-Header + Root-`CLAUDE.md`
    Phase-4-Stale-Fix.

## Required Docs (vom Implementer zu lesen)

- `docs/decisions.md` — ADR-016 §3, ADR-021, ADR-Format (Parser + ADR-022).
- `.claude/hooks/memory-server.mjs` + `memory-surface.mjs` — Store-Pfad + bestehender Surface-Hook.
- `.claude/skills/consolidate-lessons/SKILL.md` + eine `SKILL.md`-Vorlage (Format Task 11/12).
- Root-`CLAUDE.md` Abschnitt „Harness, Skills & Knowledge" + `docs/architecture.md` „Knowledge & Harness".

## Test steps (explizit)

Nach Task 1: `node .claude/doc.mjs docs/operations.md#<bekannter-slug>` druckt den Abschnitt; Fake-Slug → Exit 1.
Nach Task 6 (Build):
1. `node .claude/build-graph.mjs` → Exit 0, druckt `entities: N, relations: M`.
2. Integrität (Dup/Dangling/leer):
   ```
   node -e 'const fs=require("fs");const L=fs.readFileSync(".claude/knowledge-graph.json","utf8").trim().split("\n").map(JSON.parse);const E=L.filter(x=>x.type==="entity"),R=L.filter(x=>x.type==="relation");const N=new Set(E.map(e=>e.name));console.log("entities",E.length,"relations",R.length,"dangling",R.filter(r=>!N.has(r.from)||!N.has(r.to)).length,"dupes",E.length-N.size);'
   ```
   Erwartung: `dangling 0 dupes 0`; Entity-Zahl ≈ ADR-Anzahl(decisions.md) + 47 Domain + Captured 3 + Task-7-Topics.
3. **Pointer-Resolve**: Builder bricht ab, wenn ein `→ datei#slug` nicht existiert (bewusst einen kaputten
   Pointer einbauen → Exit≠0 mit Datei+Slug-Meldung; revert).
4. **Vollständigkeit**: jeder Pre-Build-Entity-Name + jede Relation ist post-Build vorhanden (sortierte
   Mengen diffen; nur ADR-Observations dürfen sich ändern = Essenz+Pointer-Normalisierung; Topics/Relationen
   kommen dazu).
5. **Idempotenz**: zweiter Build → `git diff --stat .claude/knowledge-graph.json` leer.
6. **MCP-Round-Trip**: `mcp__memory__read_graph` liefert den gebauten Stand; Stichprobe `scoring-engine`
   trägt einen `→ …#…`-Pointer.
Nach Task 11: kleine bewusste Manifest-Änderung → `/sync-graph`/Build → Diff zeigt genau diese Zeile; revert.

## Verification (Done-Kriterien)

- [ ] Graph vollständig aus den 3 Quellen reproduzierbar; Integrität + Pointer-Resolve grün (Test 2–5).
- [ ] Fragment-Reader liefert Abschnitte; jeder Index-Pointer ist auflösbar (Build erzwingt es).
- [ ] Captured-Stratum überlebt Rebuild unverändert.
- [ ] Index deckt das ganze lebende Doku-Korpus; Relationsnetz dicht + traversierbar.
- [ ] SessionStart-Surface erklärt Landkarte + Abfrage/Fragment-Reader.
- [ ] ADR-022 dokumentiert die Architektur; ADR-016/021 Nachtrag-Verweise.
- [ ] `/sync-graph` + aktualisierte `consolidate-lessons`-Disziplin eingecheckt.
- [ ] Kleiner always-loaded Kern bleibt; architecture/conventions-Detail indiziert (Docs kanonisch erhalten).
- [ ] Stale Phase-4-Doc-Stellen gefixt. `pnpm check` unberührt grün (kein App-Code).
- [ ] Alles auf `feat/graph-projection`, Plan = erster Commit, Rest pro Task ein Commit.

## Scope-Grenzen (bewusst NICHT)

- Kein erzwingender Auto-Build-Hook/CI (Builder bleibt skill-/manuell-getrieben; Pre-Commit-Auto-Build =
  optionale Folgearbeit, erst nach bewährter Stabilität).
- Kein Massen-Splitting der Docs (Heading-Pointer + Reader statt Fragment-Dateien).
- Keine `.md`-Ablösung — Docs bleiben kanonisch (ADR-016). Der Index ist die Voraussetzung, diese Frage
  *später* überhaupt seriös stellen zu können.
- Kein App-Code / Deploy-Vertrag berührt.
