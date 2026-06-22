# Validate — Memory-Graph operationalisiert

> PIV step-3 artifact. Branch: `feat/memory-graph-operational` (worktree). Plan:
> [plans/2026-06-22-memory-graph-operational.md](../plans/2026-06-22-memory-graph-operational.md).
> Commits validated: `50962da..e39d908` (7).

## Scope & Constraints

Änderung ist **reine Harness/Doku/JSON** — null App-Code, keine turbo-Inputs. Daraus folgt für die
Validierung:

- **Statische Checks** (unten) sind die maßgebliche Evidenz für diese Änderung — alle frisch in diesem
  Lauf gegen den Worktree erzeugt.
- **`pnpm check` (5 Gates)** prüft App-Code/Build — von dieser Änderung nicht berührt. Zudem läuft das
  Session-**Stop-Gate** mit `CLAUDE_PROJECT_DIR` = **Original-Repo** (`/Users/christian/repos/vereinsheim`,
  von einer Parallel-Session belegt), **nicht** gegen diesen Worktree — es validiert hier also nicht die
  eigene Änderung.
- **MCP-Round-Trip** (read_graph liefert Entities; create→Datei-modified→delete) ist **reload-gated**:
  `.mcp.json`-Änderungen greifen erst nach Claude-Code-Reload. → **PENDING Acceptance-Gate** (s.u.),
  diese Session nicht ausführbar.

## Verifiziert (frischer Output, 2026-06-22)

| # | Check | Ergebnis |
|---|-------|----------|
| 1 | `.mcp.json` valides JSON, Pfad-Wert | ✓ `MEMORY_FILE_PATH = ${CLAUDE_PROJECT_DIR:-.}/.claude/knowledge-graph.json` |
| 1 | `settings.json` valides JSON, SessionStart-Hooks | ✓ `codegraph-ensure.mjs, memory-surface.mjs`; 6 memory-Tools allowlisted |
| 2 | `node --check memory-surface.mjs` | ✓ Syntax OK |
| 3 | JSONL-Integrität + Relation-Refs | ✓ 36 Zeilen valide: **27 Entities, 9 Relationen, 0 dangling refs** |
| 4 | Hook-Verhalten, befüllter Graph | ✓ emittiert `SessionStart` additionalContext: „… 27 Entities (decision×21 …)" |
| 5 | Hook-Verhalten, fehlende Datei | ✓ Output leer, exit 0 (fail-open, kein Rauschen) |
| 6 | Pfad-Fix zielt auf den befüllten Store | ✓ `${CLAUDE_PROJECT_DIR:-.}`-Expansion → populierte Datei, **27 entities** |

Check 6 ist der bestmögliche Pre-Reload-Beweis, dass der Fix die **richtige, befüllte** Datei adressiert
(statt des früheren npx-dist-Pfads). Der frühere Defekt war in dieser Session direkt belegt:
`read_graph` → `{entities:[],relations:[]}`, `create_entities` → `ENOENT …/server-memory/dist/.claude/…`.

## PENDING — Acceptance-Gate (nach Merge + Reload)

Wichtig: Die laufende Session benutzt die **Original-Repo**-Config (alter relativer Pfad, 24-Entity-Seed).
Die Worktree-Artefakte werden **erst nach `ff-merge` nach `main` + Claude-Code-Reload** wirksam (dann liest
der Memory-Server `…/vereinsheim/.claude/knowledge-graph.json` = re-geseedeter Stand). Akzeptanz-Schritte
(in `/validate` der Folge-Session oder durch den User):

1. Neue Session: SessionStart-Surface erscheint („27 Entities …").
2. `mcp__memory__read_graph` liefert die 27 Entities (Lesen gefixt — vorher `{entities:[]}`).
3. Probe-Write: `mcp__memory__create_entities` (Wegwerf) → `git status` zeigt `knowledge-graph.json`
   modified → `delete_entities` → zurück auf Seed. (Vorher: ENOENT.)

## Offen / Übergabe

- **Merge nach `main`** (user-gated, Hard Rule 2): 7 Commits, linear auf `main`-Tip basiert. Zu
  beachten: `main` wird derzeit von der Parallel-Session bewegt → vor Merge ggf. rebasen.
- **Stray-Commit** `593f5c6` (identischer Plan) steckt in `feat/packages-lib`-History (Parallel-Session
  hat darauf weitergebaut) — Bereinigung ist deren/Users Entscheidung. Mein Commit ist sauber als
  `50962da` auf diesem Branch + via Tag `pin/memory-graph-plan` gesichert.
- **Worktree** `/Users/christian/repos/vereinsheim-memory-graph` nach Merge entfernbar
  (`git worktree remove`).

## Fazit

Statisch **grün** (alle 6 Checks, frische Evidenz). Die behaviorale Akzeptanz (MCP-Round-Trip) ist
strukturell erst nach Merge+Reload prüfbar und als PENDING dokumentiert — **kein** „fixed/passing"-Claim
ohne diesen Schritt. Nächster PIV-Schritt: `/review`.
