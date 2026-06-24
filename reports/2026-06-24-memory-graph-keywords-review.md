# Review-Report — `feat/memory-graph-keywords` (Keyword-Anreicherung + Builder-Gate)

> PIV-Schritt 4. Adversarialer Review (unabhängiger Agent, vereinsheims `code-reviewer`-Kriterien)
> gegen `git diff main...HEAD` (Commits `92242d6` + `172f8d0`).
> Verdict: **APPROVE — merge-fähig**; 0 Blocker, 2 NITs bewusst aufgeschoben.

## Hintergrund

Der Memory-MCP ist der Upstream `@modelcontextprotocol/server-memory`; `search_nodes` macht reines
lowercase-Substring-Matching (kein Stemming/keine Synonyme). Mit rein deutschen Essenzen liefen
Synonym-/Englisch-Suchen ins Leere → der 114-Entity-Graph war faktisch unter-durchsuchbar. Die
Änderung ergänzt pro kuratierter Entity eine `Keywords:`-Observation (87 projection + 4 captured =
91; auto-geparste ADRs ausgenommen), macht die SessionStart-Guidance größen-bewusst und lässt
`build-graph.mjs` **abbrechen**, wenn eine kuratierte Entity keine `Keywords:`-Zeile hat.

## Bestätigt solide (aktiv getestet)

- **Builder-Enforcement korrekt.** Der neue Check läuft **vor** `if (errors.length)` → gated wirklich;
  trifft exakt `projection.entities` + `captured.entities`, nimmt die 23 ADRs aus (0 ADRs tragen
  Keywords, Build dennoch grün). `e.observations?.some(...)` crasht nicht bei `undefined`.
  Read-only → Determinismus/Idempotenz unverändert.
- **Negativtest** (Session): eine `Keywords:`-Zeile entfernt → `build-graph: FEHLER /
  Entity ohne Keywords-Zeile: stechschuss-modell-flip`, **Exit 1** (Stop-Graph-Sync würde blocken);
  via `git checkout` sauber restauriert.
- **Kein Content-Verlust.** 114 Entities / 163 Relationen / Pointer unverändert (main == branch);
  Essenzen und `→ datei#slug`-Pointer byte-gleich (Diff fügt nur je eine `Keywords:`-Zeile ein +
  Header-Kommentare). Store-Rebuild auf dem Branch → `git status` ohne weiteren Diff, d. h.
  `knowledge-graph.json` ist exakt das Rebuild-Artefakt der Quellen. Keine Secrets im Diff.
- **Keyword-Qualität gegrounded.** ~25 Entities quer geprüft (ringwerk: scoring/best-of/playoffs/
  roles/auth; treffsicher: units/mental/dark-mode/isolation; ops: deploy/backup/migration-recovery/
  VPS; Konventionen: component-canon/typography/drift-protection; + alle 4 captured). Jedes Keyword
  zur Essenz rückführbar — keine erfundenen Fähigkeiten, kein irreführender False-Positive-Haken,
  Deutsch + Tech-Englisch konsistent, keine substring-brechenden Tippfehler.
- **Guidance/Skills widerspruchsfrei.** `memory-surface.mjs`, `CLAUDE.md`, `sync-graph/SKILL.md`,
  `consolidate-lessons/SKILL.md` sagen kohärent dasselbe: search_nodes = Substring-only, ein
  Stichwort (nie Phrase), bei 114 Entities `search_nodes`/`open_nodes` statt `read_graph`-Dump
  (Größe dynamisch `${entities}` → driftet nicht). „Neue Entity MIT `Keywords:`-Zeile (Builder
  erzwingt es)" an allen Schreib-Punkten gespiegelt → Schleife mit dem Gate geschlossen.
- **Konventionen.** Beide Commits English & Conventional-Commits, kein `Co-Authored-By`; ADR-022
  respektiert (nur Quellen + Doku hand-editiert, Store = Rebuild-Artefakt; Header sogar verbessert:
  „NICHT den generierten Store editieren — immer hier").
- **Gates.** `node .claude/build-graph.mjs` → exit 0 (114/163/90); `pnpm check` 17/17 FULL TURBO grün.

## Bewusst aufgeschoben (2 NITs)

- **NIT — `build-graph.mjs`:** der Enforcement-Loop spreizt `projection`+`captured` neu, statt das
  bereits gemergte `entities` nach Quelle zu filtern. Funktional korrekt und sogar klarer (schließt
  ADRs explizit aus) — rein kosmetisch.
- **NIT — Keyword-Redundanz:** wenige Listen wiederholen einen Begriff, der schon wörtlich in der
  Essenz steht (z. B. `Monorepo`/`pnpm`/`Turborepo`; `Vitest`). Harmlos; die meisten Zeilen listen
  korrekt die fehlenden Synonyme.

## Merge

FF-sauber: `main` ist Ancestor von `feat/memory-graph-keywords` (linear, `--ff-only` erfolgreich).
Verdict **APPROVE** + Gates grün → **merge-frei**.
