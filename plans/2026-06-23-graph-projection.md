# Plan — Memory-Graph als abgeleitete, regenerierbare Projektion der Dokumentation

> PIV-Plan (Schritt 1/4). Handoff für `/implement`. Branch: `feat/graph-projection`.

## Context (warum)

Der Memory-Graph (`.claude/knowledge-graph.json`, MCP-Layer-3, ADR-016) wurde bisher **von Hand**
gepflegt (Live-`mcp__memory__*`-Writes). Das hat drei Probleme, die der User adressiert haben will:

1. **Nicht selbstaktualisierend** — wächst nur, wenn ein Agent dran denkt (ADR-021: Schreiben bleibt
   modellgetrieben). War deshalb monatelang ein No-Op.
2. **Doppelpflege/Drift** — Volltext im Graph *und* in den Docs. (In dieser Session bereits auf
   Essenz+Pointer geschrumpft, aber die Pflege blieb manuell.)
3. **Nicht reproduzierbar** — der Graph lebte nur im gebauten Artefakt; „löschen + neu bauen" verlor
   alles.

Ziel: **Docs bleiben die kanonische, reviewbare Wahrheit; der Graph wird ein gebautes Artefakt**, das
deterministisch aus eingecheckten Quellen regeneriert wird. Genau wie CodeGraph eine Projektion des
Codes ist, wird der Memory-Graph eine Projektion der Dokumentation.

**Determinismus-Grenze (ehrlich):** Prosa hat keine AST-Struktur. Daher zweistufig:
`Docs → Manifest` ist **modellgetrieben** (seltener `/sync-graph`-Skill, bei Doc-Änderungen);
`Manifest+ADRs+Captured → Graph` ist **deterministisch** (häufiger Builder, hook-/CI-fähig, kein Modell).

ADR-Bezug: ADR-016 (Graph = Layer 3, *nicht* Struktur-Autorität — bleibt gewahrt). ADR-021 (Pfad-Fix,
modellgetriebenes Schreiben — dessen *Schreib-Mechanik* wird durch dieses Vorhaben ersetzt → **ADR-022**).

## Approach

Drei eingecheckte **Quellen** → ein deterministischer **Builder** → das **Artefakt**:

```
docs/decisions.md            ──(deterministisch geparst)──┐
.claude/graph-projection.mjs ──(Manifest: kuratiert)──────┼─▶ .claude/build-graph.mjs ─▶ .claude/knowledge-graph.json
.claude/graph-captured.mjs   ──(Session-Provenance)───────┘                                  (MCP-Artefakt, nie von Hand editiert)
        ▲
        └──(modellgetrieben: /sync-graph-Skill, bei Doc-Änderungen)── docs/*.md, apps/*/docs/*.md
```

**Strata & Zuständigkeit:**

| Stratum | Quelle | Inhalt | Wer pflegt |
| --- | --- | --- | --- |
| ADRs | `docs/decisions.md` (geparst) | `decision`-Entities (Essenz+Pointer) + `supersedes`-Relationen | automatisch beim Build |
| Projektion | `.claude/graph-projection.mjs` | `project`/`app`/`feature`/`subsystem`/`domain-rule`/`operation`/`ops-constraint` + deren Relationen + kuratierte ADR-Cross-Refs (`amends`) | `/sync-graph` (Modell) bzw. Hand |
| Captured | `.claude/graph-captured.mjs` | `incident`/`state` + deren Relationen (stehen in **keiner** Doc) | `/consolidate-lessons` REMEMBER |

**Builder-Vertrag** (`build-graph.mjs`):
- Liest die drei Quellen, merged: ADRs (numerisch aufsteigend) → Projektion (Manifest-Reihenfolge) →
  Captured. Dann alle Relationen (gleiche Gruppenreihenfolge). Stabile Sortierung → saubere Git-Diffs.
- Serialisiert **kompaktes JSONL** im server-memory-Format: Entity-Zeile
  `{"type":"entity","name":…,"entityType":…,"observations":[…]}`, Relation-Zeile
  `{"type":"relation","from":…,"to":…,"relationType":…}`, je `JSON.stringify` (UTF-8 literal — keine
  `\u`-Escapes; non-ASCII wie `für`/`→`/`✅` bleiben), eine Zeile pro Objekt, **abschließendes `\n`**.
- **Validiert** (Exit≠0 bei Verstoß): keine doppelten Entity-Namen; jede Relation `from`/`to` referenziert
  eine existierende Entity (keine Dangling); jede Entity hat ≥1 Observation.
- Idempotent: zweiter Lauf ohne Quelländerung erzeugt byte-gleiche Datei.

**ADR-Parser-Regeln** (deterministisch, aus `decisions.md`):
- Sektion = `^## ADR-(\d{3}) — (.+)$` → Entity `ADR-NNN`, Titel = Capture-Gruppe.
- Status = erste `^\*\*Status\*\*: (.+)$` der Sektion.
- Observations = `["Titel: <titel>", "Status: <status>", "Detail: docs/decisions.md (ADR-NNN)"]`
  (Essenz+Pointer; gehandcopierte Prosa/Nachträge **nicht** mehr im Graph — kanonisch in decisions.md).
- `supersedes` = aus Titel-Regex `\(supersedes ADR-(\d+)\)`. (Die feineren `amends`-Cross-Refs
  [021→016/017, 020→018/019] sind **editorial** → liegen im Manifest, nicht im Parser.)

**Schreib-Mechanik neu (ADR-022):** Neues Projektgedächtnis wird **nicht** mehr per Live-`mcp__memory__`-
Write erzeugt (das ein Rebuild überschriebe), sondern als Eintrag in die passende Quelle (`graph-captured.mjs`
für Incidents/State; `graph-projection.mjs` für abgeleitete Fakten) + Rebuild + Commit. Der laufende
MCP-Server bleibt **lesend** (er liest die Datei pro Operation, ADR-021 — Builds sind also sofort sichtbar).

## Files to change / create

**Neu:**
- `.claude/graph-projection.mjs` — `export default { entities:[…], relations:[…] }` (plain literals, keine
  Logik). Seed = aktueller Graph **minus** ADRs/Captured: die 2 `app` + 1 `project` + 44
  feature/subsystem/domain-rule/operation/ops-constraint-Entities + alle ihre Relationen + die 4 kuratierten
  ADR-`amends`/`supersedes`-Cross-Refs, die nicht aus Titeln folgen (genau: `ADR-021 amends ADR-016`,
  `ADR-021 amends ADR-017`, `ADR-020 amends ADR-018`, `ADR-020 amends ADR-019`).
- `.claude/graph-captured.mjs` — `export default { entities:[…], relations:[…] }`. Seed = die 2 `incident`
  + 1 `state` Entities + alle 6 Relationen mit ≥1 captured-Ende (`occurred_in`×2, `applies_to`×2
  [`treffsicher-actionresult-migration→treffsicher`, `stechschuss-modell-flip→best-of-single`], `refined`
  [`ruleset-lock-granularity→phase-locking-and-editability`], `targets`
  [`treffsicher-actionresult-migration→action-result-convention`]).
- `.claude/build-graph.mjs` — der deterministische Builder (Vertrag oben).
- `.claude/skills/sync-graph/SKILL.md` — modellgetriebener Re-Sync (siehe Task 6).

**Geändert:**
- `.claude/knowledge-graph.json` — wird ab jetzt **gebaut** (Task 4 regeneriert es; Inhalt ≈ heute, ADRs
  normalisiert).
- `docs/decisions.md` — **ADR-022** anhängen (Projektionsarchitektur; amendiert ADR-016 §3 + ADR-021-Schreibmechanik).
- `.claude/skills/consolidate-lessons/SKILL.md` — REMEMBER-Stufe: Eintrag in `graph-captured.mjs` + Rebuild
  (statt Live-`mcp__memory__`-Writes).
- `CLAUDE.md` (Root) — Knowledge-Graph-Abschnitt: Projektion + Build-Befehl; **zugleich** den veralteten
  „Nächster Schritt: Phase 4"-Text fixen (Phase 4 erledigt).
- `docs/architecture.md` — Knowledge-&-Harness-Abschnitt: Graph = gebaute Projektion (1 Satz + Build-Befehl).
- `docs/monorepo-plan.md` — Header („Phase 4 offen" → erledigt; §8 ist schon korrekt).

## Tasks (bite-sized, je ein Commit)

1. **Manifest-Quelle anlegen** — `.claude/graph-projection.mjs` aus dem aktuellen Graph extrahieren
   (Skript: lese `knowledge-graph.json`, filtere Entities mit entityType ∉ {decision,incident,state},
   plus alle Relationen, deren beide Enden NICHT incident/state sind und die nicht reine ADR-`supersedes`
   aus Titeln sind → in `export default`). Verifizieren: 47 Entities (1 project + 2 app + 44 domain),
   plus die 4 kuratierten ADR-Cross-Refs manuell ergänzt.
2. **Captured-Quelle anlegen** — `.claude/graph-captured.mjs`: 3 Entities (incident×2, state×1) + alle 6
   Relationen mit ≥1 captured-Ende, aus dem Graph extrahiert (Extraktions-Filter: Relation gehört zu
   Captured ⟺ `from` oder `to` ∈ {incident,state}-Namen; alle übrigen → Manifest bzw. ADR-Parser).
3. **Builder schreiben** — `.claude/build-graph.mjs` nach Vertrag. ADR-Parser + Merge + Validierung +
   JSONL-Serialisierung. `node .claude/build-graph.mjs` schreibt `knowledge-graph.json`.
4. **Regenerieren + verifizieren** — Builder laufen lassen; gegen den aktuellen Stand prüfen
   (Test-Schritte unten). Bei Abweichung außer ADR-Normalisierung: Quellen korrigieren, nicht das Artefakt.
5. **ADR-022** in `docs/decisions.md` — Titel „Memory-Graph als gebaute Projektion (Builder + Manifest +
   Captured)", Status Accepted (Juni 2026), Kontext/Entscheidung/Alternativen/Folgen; Nachtrag-Verweise in
   ADR-016 §3 und ADR-021 ergänzen. (ADR-022-Entity erscheint automatisch beim nächsten Build.)
6. **`/sync-graph`-Skill** — `.claude/skills/sync-graph/SKILL.md` (frontmatter `name`/`description`,
   `invocation: [user, Claude]`-Stil wie andere Skills): Ablauf = (a) geänderte Docs lesen, (b)
   betroffene Manifest-Entities auf Essenz+Pointer-Disziplin nachziehen (Captured nie überschreiben),
   (c) `node .claude/build-graph.mjs`, (d) Validierung grün + MCP-Round-Trip, (e) an Commit erinnern.
7. **Schreib-Disziplin nachziehen** — `consolidate-lessons/SKILL.md` REMEMBER + Root-`CLAUDE.md` +
   `apps/*/CLAUDE.md`-Verweise: Capture = Quelle editieren + Rebuild, nicht Live-Write.
8. **Doc-Sync** — `architecture.md` + `monorepo-plan.md`-Header + Root-`CLAUDE.md` Phase-4-Stale-Fix.

## Required Docs (vom Implementer zu lesen)

- `docs/decisions.md` — ADR-016 §3, ADR-021 (Mechanik + 06-23-Nachtrag), ADR-Format (für Parser + ADR-022).
- `.claude/hooks/memory-server.mjs` — wie der Store gelesen wird (absoluter Pfad; Build muss diese Datei treffen).
- `.claude/skills/consolidate-lessons/SKILL.md` — REMEMBER-Stufe (Task 7).
- Eine bestehende `SKILL.md` (z.B. `check/` oder `consolidate-lessons/`) als Format-Vorlage (Task 6).
- `docs/architecture.md` Abschnitt „Knowledge & Harness" + Root-`CLAUDE.md` Abschnitt „Harness, Skills & Knowledge".

## Test steps (explizit)

Nach Task 4 (Builder):
1. `node .claude/build-graph.mjs` → Exit 0, druckt `entities: N, relations: M`.
2. Zähl-/Integritätscheck:
   ```
   node -e 'const fs=require("fs");const L=fs.readFileSync(".claude/knowledge-graph.json","utf8").trim().split("\n").map(JSON.parse);const E=L.filter(x=>x.type==="entity"),R=L.filter(x=>x.type==="relation");const N=new Set(E.map(e=>e.name));const dang=R.filter(r=>!N.has(r.from)||!N.has(r.to));const dup=E.length-N.size;console.log("entities",E.length,"relations",R.length,"dangling",dang.length,"dupes",dup);'
   ```
   Erwartung: `entities 71 relations 71 dangling 0 dupes 0`. (71, weil ADR-022 +1 Entity ⇒ falls ADR-022
   committet ist: 72/72-ff. — Zahl gegen die ADR-Anzahl in decisions.md gegenprüfen, nicht hart 71.)
3. **Vollständigkeit**: jeder Entity-Name + jede Relation aus dem Pre-Build-Stand ist im Post-Build-Stand
   vorhanden (Diff der sortierten Namens-/Relationen-Mengen — nur ADR-*-Observations dürfen sich ändern
   = Normalisierung auf Essenz+Pointer):
   ```
   git stash; node -e '…dump sorted names…' > /tmp/before.txt; git stash pop; node .claude/build-graph.mjs; node -e '…dump…' > /tmp/after.txt; diff /tmp/before.txt /tmp/after.txt
   ```
   Erwartung: keine fehlenden Namen/Relationen (nur Zugänge wie ADR-022).
4. **Idempotenz**: Builder zweimal laufen → `git diff --stat .claude/knowledge-graph.json` nach dem 2. Lauf leer.
5. **MCP-Round-Trip** (in dieser Session, da server-memory pro Operation liest): `mcp__memory__read_graph`
   liefert die gebauten Entities/Relationen; Stichprobe `scoring-engine` = Essenz+Pointer.

Nach Task 6 (`/sync-graph`): Trockenlauf — kleine, bewusste Manifest-Änderung (1 Observation) →
`/sync-graph` bzw. Builder → Diff zeigt genau diese eine Zeile; revert.

## Verification (Done-Kriterien)

- [ ] `knowledge-graph.json` ist vollständig aus den drei Quellen reproduzierbar (Test 3+4 grün).
- [ ] Keine Dangling-Relationen, keine Dup-Namen, jede Entity ≥1 Observation.
- [ ] Captured-Stratum (Incidents/State) überlebt einen Rebuild unverändert.
- [ ] ADR-022 dokumentiert die Architektur; ADR-016/021 haben Nachtrag-Verweise.
- [ ] `/sync-graph`-Skill + aktualisierte `consolidate-lessons`-REMEMBER-Disziplin eingecheckt.
- [ ] Stale Phase-4-Doc-Stellen (Root-CLAUDE.md, monorepo-plan-Header) gefixt.
- [ ] `pnpm check`-Gates unberührt grün (kein App-Code angefasst; reine `.claude/`+`docs/`-Änderung).
- [ ] Alles auf `feat/graph-projection`, Plan = erster Commit, Rest pro Task ein Commit.

## Scope-Grenzen (bewusst NICHT)

- Kein Hook/CI, der den Build automatisch erzwingt (Builder bleibt manuell/skill-getrieben; Auto-Build als
  Pre-Commit-Hook ist optionale Folgearbeit — erst beweisen, dass der Build stabil ist).
- Keine `.md`-Ablösung — Docs bleiben kanonisch (ADR-016). Die Projektion ist die Voraussetzung dafür,
  diese Frage *später* überhaupt seriös stellen zu können.
- Keine Änderung am Deploy-Vertrag/App-Code.
