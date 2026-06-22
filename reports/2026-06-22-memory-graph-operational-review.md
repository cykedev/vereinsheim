# Review — Memory-Graph operationalisiert

> PIV step-4 artifact. Branch: `feat/memory-graph-operational`. Delegated to the committed
> `code-reviewer` sub-agent against `git diff main...HEAD` (worktree).

## Verdikt: **Approve** — keine Blocker, keine Majors.

Der Reviewer hat den einzigen echten Code-Teil (`memory-surface.mjs`) **empirisch** gegen jeden
Adversarial-Input geprüft (fehlende/leere/blank-only/korrupte Datei, trailing-partial JSON, non-array
`observations`, `{}`/`[]`/bare-string/number-Zeilen, 200k-Zeilen-/Multi-MB-Store) — jeder Fall `exit 0`,
kein Throw, kein Hang (200k Zeilen in 0,15 s), leerer Graph → **still** (Guard `entities === 0` vor jeder
Ausgabe). Drei unabhängige fail-open-Schichten (read-try / per-line-try / outer-try). Output-Shape
`{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext}}` entspricht der offiziellen
Hooks-Referenz; Direkt-Lesen der Datei (statt MCP) ist korrekt, da SessionStart **vor** MCP-Connect feuert.

Weiter verifiziert (clean): `${CLAUDE_PROJECT_DIR:-.}` ist die per Doku empfohlene Idiom-Form für
project-scoped stdio-Server; `.mcp.json` valides JSON, nur eine Datei (keine stale App-Kopie);
`knowledge-graph.json` 27 Entities/9 Relationen, 0 Parse-Fehler, 0 Duplikate, 0 dangling refs,
byte-kompatibel mit dem realen `server-memory@2026.1.26`-Parser; `settings.json` valide, Allowlist
additive Writes + Deletes bewusst prompt-gated (least privilege — bestätigt); ADR-021 + Nachträge +
Doc-Sync akkurat zum Diff; beide App-CLAUDE.md ohne substanziellen Widerspruch (app-spezifisch, kein
MUST_MATCH). Kein App-Code/turbo-Input/MUST_MATCH-Shared-File berührt.

## Findings

| Sev | Stelle | Befund | Status |
|-----|--------|--------|--------|
| MINOR | plan §Context (Z. 9, 13), report Z. 40 | „24 Entities" statt korrekt **24 Zeilen (21 Entities + 3 Relationen)**. ADR-021 („24 Zeilen") war schon korrekt. | **Behoben** (Commit `docs(review)`); reine PIV-Artefakte, kein operativer Impact, daher keine Re-Validierung. |
| NIT | `knowledge-graph.json:6/7` | Vermutete fehlende `ADR-015 supersedes ADR-001`-Relation. | **Withdrawn** — Relation existiert bereits (Z. 7). |
| NIT | `memory-surface.mjs:46-49` | Tie-break bei gleich-häufigen `entityType`s = Map-Insertion-Order. | **Kein Fix** — deterministisch (stabiler Sort + insertion-ordered Map), reproduzierbar. |

## Ergebnis

Ein Minor (Doku-Genauigkeit) behoben; sonst sauber. Kein Code geändert → keine Re-Validierung nötig
(statische Checks unverändert grün, siehe [Validate-Report](2026-06-22-memory-graph-operational.md)).
Bereit zum `ff-merge` nach `main` (user-gated) + anschließendem Reload für das PENDING-Acceptance-Gate.
