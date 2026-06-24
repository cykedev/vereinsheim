# Plan: Worktree-Wahl ist Hauptsession-Vorab-Entscheidung (ADR-024, schärft ADR-023 §5)

> PIV-Schritt 1. Handoff für die (interaktive) Umsetzung. **User-Entscheidung (24.06.2026):** die
> Worktree-Wahl trifft **nicht der Autopilot**, sondern die **Hauptsession** — der User entscheidet
> **vorab**, ob in einem Worktree gearbeitet wird. Gewählte Mechanik: **„Du richtest selbst ein"** —
> die Skills bleiben **worktree-agnostisch** (kein aktiver Frage- oder Erstell-Schritt im Skill); der
> User legt (falls gewünscht) den Worktree vorab selbst an, die Skills prüfen nur noch den
> `feat/`-Branch.

## Kontext (warum)

ADR-023 §5 schreibt eine **Worktree-*Pflicht*** für den autonomen `/implement` fest, und das
`/implement`-Preflight ([`SKILL.md:15`](../.claude/skills/implement/SKILL.md)) **HALTET**, wenn es
nicht in `/.claude/worktrees/` auf einem `feat/`-Branch läuft. Drei Gründe, das von **Pflicht** zu
**Hauptsession-Vorab-Entscheidung** zu lockern:

1. **Erzeuger-Lücke.** Den Worktree *erstellt* aktuell niemand: `/plan` (Schritt 5) schlägt nur einen
   `feat/`-Branch vor, **keinen** Worktree; der Autopilot kann sich nicht selbst in einen Worktree
   „umziehen". Die Pflicht prüft also eine Vorbedingung, für deren Herstellung kein Schritt zuständig
   ist — eine Inkonsistenz im Konzept.
2. **DB-Test-Konflikt.** Das Autopilot-Gate ist `pnpm check` (inkl. `test`). Laut Memory
   [`worktree-db-tests-turbo-env`](../../../.claude/projects/-Users-christian-repos-vereinsheim/memory/worktree-db-tests-turbo-env.md)
   **scheitern DB-Tests im Worktree ohne `.env`** (turbo filtert env). Die Pflicht ist für DB-nahe
   Pläne damit nicht nur unnötig, sondern aktiv schädlich.
3. **Die Entscheidung gehört vor den Lauf.** Ob isoliert gearbeitet wird, ist eine Umgebungs-/
   Workflow-Entscheidung, die naturgemäß **vor** dem Autopilot fällt — also in der Hauptsession, beim
   Menschen. Der Autopilot soll sie nicht treffen, sondern den vorgefundenen `feat/`-Tree akzeptieren.

Die **Sicherungen bleiben unverändert**: der `feat/`-Branch (nie `main`, Hard Rule 2), der
`autopilot-guard`-Hook (geschützte Pfade/Kommandos), der Iterations-Cap 20 und der Marker. Der
Worktree war stets *zusätzliche* Isolation (defense-in-depth), nie die einzige Leitplanke.

## Wichtig: diese Umsetzung läuft **interaktiv**, nicht im Autopilot

Selbst-Konsistenz-Hinweis: Diese Änderung berührt fast nur **geschützte Pfade** — `.claude/skills/*`
und `docs/decisions.md` (ADRs) sind im [`autopilot-guard`](../.claude/hooks/autopilot-guard.mjs)
`DENY`-gelistet. Ein autonomer `/implement`-Lauf würde sie (korrekt) blocken. Die Umsetzung erfolgt
deshalb **interaktiv** (direkt bzw. `/implement --step` ohne Marker). Das ist by design — die Harness
schützt ihre eigene Selbstmodifikation; sie wird unter menschlicher Aufsicht geändert.

## Ansatz

Vier kleine, andockende Edits + ein deterministischer Graph-Rebuild. Kern: **Worktree-Pflicht →
Worktree-Wahl der Hauptsession**; die Skills werden agnostisch.

### A) ADR-024 (`docs/decisions.md`)

Neuer Abschnitt **vor** „## Mögliche Folge-ADRs" (aktuell [`Zeile 965`](../docs/decisions.md)). Titel
`## ADR-024 — Worktree-Wahl ist Hauptsession-Vorab-Entscheidung (schärft ADR-023 §5)`, Status
`Accepted (Juni 2026)`. Inhalt:

- **Kontext:** die drei Gründe oben (Erzeuger-Lücke, DB-Test-Konflikt, Entscheidung gehört vor den
  Lauf).
- **Entscheidung:** Worktree ist **keine Pflicht** mehr, sondern eine **Vorab-Entscheidung der
  Hauptsession/des Users**. Die Skills sind **worktree-agnostisch** (sie erstellen/erzwingen keinen
  Worktree, fragen nicht aktiv). `/implement`-Preflight prüft **nur** noch den `feat/`-Branch (nie
  `main`); es arbeitet im vorgefundenen Tree (Worktree oder Haupt-Tree). Restliche ADR-023-
  Sicherungen (Guard, Cap, Marker, Plan-Freigabe, Merge user-gated) **unverändert**.
- **Alternativen:** _„/plan fragt aktiv"_ (geführter Frage-Schritt) — verworfen: der User will keinen
  „Magie-Schritt" im Skill. _„Worktree als Default, abwählbar"_ — verworfen: behält die
  Pflicht-Optik. _Pflicht beibehalten (Status quo)_ — verworfen: Erzeuger-Lücke + DB-Test-Konflikt.
- **Folgen:** `/implement` + `/plan` SKILL.md angepasst; `docs/architecture.md` ADR-Liste ergänzt;
  Doku-Index neu gebaut. **ADR-018 §5** („Worktree-Isolation" als Teil des Loop-Drivers) wird hiermit
  in Prosa von *Pflicht* zu *Option* relativiert (ADR-018 selbst bleibt als historische Vision
  unangetastet).

Der ADR-Parser ([`build-graph.mjs:36-48`](../.claude/build-graph.mjs)) erzeugt aus dem Heading
automatisch die `decision`-Entity `ADR-024` + Pointer; **keine `Keywords:`-Zeile nötig** (die gilt nur
für die kuratierten Quellen, [`build-graph.mjs:101-106`](../.claude/build-graph.mjs)). „schärft" ist
Prosa (wie ADR-023 „schärft ADR-020") → **keine** automatische Relation, konsistent mit dem Bestand.

### B) `/implement`-Preflight worktree-agnostisch (`.claude/skills/implement/SKILL.md`)

Die „Worktree-Pflicht"-Bullet ([`SKILL.md:15-17`](../.claude/skills/implement/SKILL.md)) ersetzen
durch einen reinen Branch-Check:

```markdown
- **Branch-Check:** `git branch --show-current` beginnt mit `feat/` (nie autonom auf `main`/Default —
  Hard Rule 2). Sonst **HALT** („Autopilot nur auf `feat/`-Branch"). **Ob die Umsetzung in einem
  Worktree läuft, hat die Hauptsession vorab entschieden (ADR-024) — der Autopilot prüft/erzwingt das
  nicht, er arbeitet im vorgefundenen Tree.**
```

Marker-/Ledger-/Cap-Logik (Rest des Preflight) **unverändert**.

### C) `/plan` knapper Hinweis (`.claude/skills/plan/SKILL.md`)

An Schritt 5 ([`SKILL.md:24-25`](../.claude/skills/plan/SKILL.md)) **einen** informativen Satz
anhängen (kein aktiver Frage-/Erstell-Schritt — der User wählte „kein Magie-Schritt"):

```markdown
   Whether implementation runs in an isolated worktree is the **user's call, made up front in the main
   session** (ADR-024) — the skills neither create nor require one. If isolation is wanted, the user
   sets up the worktree before `/implement`; otherwise it runs on the `feat/` branch in the current tree.
```

### D) `docs/architecture.md` ADR-Liste

Im Abschnitt „Knowledge & Harness" die Überschrift `(ADR-016/017/018/022/023)` →
`(ADR-016/017/018/022/023/024)` und im Autopilot-Satz einen Halbsatz, dass die Worktree-Wahl
Hauptsession-Vorab ist (ADR-024). Minimal.

### E) Graph-Rebuild

`node .claude/build-graph.mjs` → regeneriert `.claude/knowledge-graph.json` (Artefakt, **nie** von
Hand). Builder validiert Integrität + Pointer selbst; der Stop-Graph-Sync-Hook prüft am Turn-Ende
zusätzlich.

## Dateien (zu ändern)

| Datei | Art | Inhalt |
| --- | --- | --- |
| `docs/decisions.md` | edit | ADR-024 (vor „Mögliche Folge-ADRs") |
| `.claude/skills/implement/SKILL.md` | edit | Preflight: Worktree-Pflicht → reiner `feat/`-Branch-Check |
| `.claude/skills/plan/SKILL.md` | edit | Schritt 5: ein Satz „Worktree = User-Wahl, Skills agnostisch" |
| `docs/architecture.md` | edit | ADR-Liste +024 + Halbsatz im Autopilot-Absatz |
| `.claude/knowledge-graph.json` | generiert | `node .claude/build-graph.mjs` (nicht von Hand) |

**Nicht angefasst:** `CLAUDE.md` (kein Worktree-Bezug im Autopilot-Absatz → keine Änderung nötig);
`autopilot-guard.mjs` (kennt keine Worktree-Logik); ADR-018 (historische Vision).

## Required Docs (vor dem Coden lesen)

- [`docs/decisions.md`](../docs/decisions.md) — **ADR-023** (§5 = das, was geschärft wird) + ADR-017/
  018/020/022 als Format-/Kontext-Vorlage für ADR-024.
- [`.claude/skills/implement/SKILL.md`](../.claude/skills/implement/SKILL.md) +
  [`.claude/skills/plan/SKILL.md`](../.claude/skills/plan/SKILL.md) — Ist-Stand der zu ändernden Stellen.
- [`.claude/build-graph.mjs`](../.claude/build-graph.mjs) — ADR-Parsing/Pointer/Keywords-Mechanik
  (warum ADR-024 keine `Keywords:`-Zeile braucht).
- [`CLAUDE.md`](../CLAUDE.md) Hard Rules 2 + 6 (feat-Branch nie `main`; ADR-Respekt) — und Memory
  [`worktree-db-tests-turbo-env`](../../../.claude/projects/-Users-christian-repos-vereinsheim/memory/worktree-db-tests-turbo-env.md).

## Aufgaben (bite-sized, ein Commit pro Task)

1. **ADR-024 schreiben** (`docs/decisions.md`, Abschnitt A). Status Accepted (Juni 2026); Kontext/
   Entscheidung/Alternativen/Folgen wie oben; Verweise auf ADR-023 (§5), ADR-018 (§5), ADR-017.
   _Test:_ `grep -c '^## ADR-024' docs/decisions.md` == 1; steht vor „## Mögliche Folge-ADRs".
2. **`/implement`-Preflight** (`.claude/skills/implement/SKILL.md`, Abschnitt B): Worktree-Pflicht-
   Bullet → Branch-Check; Rest unverändert.
   _Test:_ `grep -n 'Worktree-Pflicht' .claude/skills/implement/SKILL.md` leer; `grep -n 'feat/' …`
   zeigt den neuen Branch-Check; Frontmatter `name: implement` unverändert.
3. **`/plan`-Hinweis** (`.claude/skills/plan/SKILL.md`, Abschnitt C): ein Satz an Schritt 5.
   _Test:_ `grep -ni 'worktree' .claude/skills/plan/SKILL.md` zeigt genau den neuen Satz.
4. **`docs/architecture.md`** (Abschnitt D): ADR-Liste + Halbsatz.
   _Test:_ `grep -n '024' docs/architecture.md` zeigt die ergänzte ADR-Liste.
5. **Graph-Rebuild + Commit** (Abschnitt E): `node .claude/build-graph.mjs`; `knowledge-graph.json`
   mitcommitten.
   _Test:_ Builder exit 0; Entity-Count +1 ggü. vorher (Builder-Ausgabe).

## Verification (nach allen Tasks, vor `/validate`)

- `node .claude/build-graph.mjs` → **exit 0**, Ausgabe zeigt **115 entities** (114 → +ADR-024) und
  keinen Pointer-/Dangling-Fehler.
- `mcp__memory__open_nodes(["ADR-024"])` (bzw. `grep '"ADR-024"' .claude/knowledge-graph.json`) →
  Entity vorhanden, `entityType: decision`, Pointer `→ docs/decisions.md#adr-024-…`.
- `node .claude/doc.mjs docs/decisions.md#<adr-024-slug>` → liefert den ADR-024-Abschnitt (Pointer
  auflösbar).
- `grep -i 'worktree' .claude/skills/implement/SKILL.md` → **keine** „Pflicht"/HALT-bei-Worktree mehr;
  der `feat/`-Branch-Check ist da.
- `pnpm check` grün (Regression-Sicherung; Stop-Gate erzwingt es ohnehin — reine Doku/Skill/JSON-
  Änderung, kein App-Code betroffen).
- `git log --oneline` zeigt 5 fokussierte Commits (+ Plan-Commit), EN-Conventional-Messages, kein
  `Co-Authored-By`.

## Nicht in diesem Scope

- **Kein** aktiver Worktree-Frage-/Erstell-Schritt in den Skills (bewusste User-Wahl „Du richtest
  selbst ein", 24.06.2026).
- ADR-018 §5 wird **nicht** editiert (historische Vision; ADR-024 relativiert sie nur in Prosa).
- `CLAUDE.md` bleibt unverändert (kein Worktree-Bezug im Autopilot-Absatz).
- Kein autonomer `/implement`-Lauf für diese Umsetzung (geschützte Pfade → interaktiv, s.o.).
