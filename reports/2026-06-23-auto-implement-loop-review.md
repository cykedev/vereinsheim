# Review-Report: Autonome `/implement`-Phase (ADR-022)

> PIV-Schritt 4. Branch: `feat/auto-implement-loop`. Adversariale Review via `code-reviewer`-Sub-Agent
> gegen `git diff main...HEAD`. Datum: 2026-06-23. Validate: [`2026-06-23-auto-implement-loop.md`](2026-06-23-auto-implement-loop.md).

## Verdict des Reviewers

„One BLOCKER (safety hole), otherwise solid and merge-worthy after the fix." Marker-Gate, Fail-open,
in-Worktree-Pfadnormalisierung und Bash-Reduktion korrekt; die im Briefing vermutete
Worktree-`.claude/`-False-Positive **tritt nicht auf** (empirisch bestätigt vom Reviewer).

## Befunde + Behandlung (alle vor dem Fix empirisch reproduziert)

| # | Sev | Befund | Status |
| --- | --- | --- | --- |
| **B1** | Blocker | **Pfad-Escape umgeht jeden Protected-Path-Check.** Absolute Eltern-Tree-Pfade (`/…/vereinsheim/.claude/settings.json`, `…/scripts/vereinsheim`, ADRs, Schema) und `../`-Pfade ergeben `rel` mit `..` → früher `return false` → **ALLOW**. Die geschützten Ressourcen liegen physisch im Eltern-Tree (Worktree hängt unter `<repo>/.claude/worktrees/`), also ist das ein echtes Loch in der Hard-Enforcement-Schicht. | **Behoben** `19b836a` |
| **M1** | Major | **Stale-Marker** bei abnormalem Abbruch (Crash/Kill/Ctrl-C vor HALT): Marker bleibt liegen, ist gitignored (unsichtbar in `git status`) → Guard bleibt scharf, DENYt im nächsten interaktiven Lauf still. | **Behoben** `19b836a` |
| **m1** | Minor | **Getarnte Kommandos**: `git -C <path> push` (Flag zwischen `git` und `push`) + `docker image push` rutschten durch. | **Behoben** `19b836a` |
| **m2** | Minor | `prisma migrate` blockt auch read-only `migrate status`/`diff`. | **Bewusst belassen** (konservativer Default; ein HALT ist sicher, nur milde Reibung). |
| **n1** | Nit | ADR-022 „Folgen" sagte „8-Schritt-Iteration", SKILL hat Preflight + 7 Schritte. | **Behoben** `19b836a` (Wording „Preflight + Task-Iteration"). |
| **n2/n3** | Nit | Doku-Wiring akkurat, `--step`-Semantik kohärent. | Keine Aktion. |

## Fixes (Commit `19b836a`)

- **B1:** Bei Pfad-Escape (`rel` beginnt mit `..`) nicht mehr durchwinken, sondern den vollen
  normalisierten Pfad (`probe`) gegen alle Basename-/Segment-Regexes prüfen; `docs/decisions.md` als
  Regex statt Gleichheit (matcht auch den absoluten Pfad). In-Worktree-Verhalten unverändert.
- **M1:** `MARKER_TTL_MS = 8h` — Marker älter als TTL → als verwaist behandelt (fail-open, stderr-Hinweis).
  SKILL: Marker pro Iteration auffrischen (`touch`), Resume frischt ihn auf, manuelle Recovery
  (`rm .claude/.autopilot-active`) dokumentiert.
- **m1:** `git\s+(?:-C\s+\S+\s+)?<verb>` + `docker\s+(?:image\s+)?push`.

## Re-Verifikation nach Fix (frisch, diese Runde)

```
B1 geschlossen (DENY=2): abs Parent .claude/settings.json | ../../../docs/decisions.md |
                         abs scripts/vereinsheim | abs prisma/schema.prisma
m1 geschlossen (DENY=2): git -C <path> push | docker image push
keine neuen FP (OK=0):   /tmp/x.ts | in-worktree app-datei (rel+abs) | git log | normaler commit
in-worktree DENY (=2):   compose.yml | .claude/settings.json
fail-open (OK=0):        kaputtes JSON
TTL (OK=0):              protected path mit altem Marker → No-Op
```

`node --check` grün; `pnpm check` nach dem Fix grün (s. Validate-Report-Update).

## Reviewer-bestätigt-sauber (nicht re-litigieren)

- Worktree-`.claude/`-False-Positive **tritt nicht auf** (empirisch).
- Fail-open auf allen Throw-Pfaden; keine Crash-/exit-1-Pfade.
- Reduktion über-blockt nicht (Commit-Messages/Heredocs mit `git push`-Erwähnung erlaubt).

## Fazit

Blocker + Major + relevanter Minor behoben und re-verifiziert; m2 bewusst belassen. **Merge-reif**
(ff-only nach `main`, **user-gated**). Live-Wiring des Hooks greift nach Claude-Code-Reload
(Repo-Konvention).
