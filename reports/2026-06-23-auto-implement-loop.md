# Validate-Report: Autonome `/implement`-Phase (ADR-022)

> PIV-Schritt 3. Branch: `feat/auto-implement-loop`. Plan:
> [`plans/2026-06-23-auto-implement-loop.md`](../plans/2026-06-23-auto-implement-loop.md).
> Datum: 2026-06-23. **Evidence before claims** — jede Aussage ist durch Output aus *diesem* Lauf belegt.

## Was geliefert wurde (5 Commits)

| Commit | Inhalt |
| --- | --- |
| `71e6ec0` | Plan (PIV-Schritt 1) |
| `638f84f` | ADR-022 (`docs/decisions.md`) |
| `0c5544f` | Hook `autopilot-guard.mjs` + `.claude/settings.json`-Verdrahtung |
| `e751a2e` | `/implement` autonom-by-default umgeschrieben + `.gitignore`-Marker |
| `3f64e21` | Doku-Wiring (`CLAUDE.md`, `docs/architecture.md`) |

## 1) Gates — grün

`pnpm check` (lint/format:check/test/check-types/build, beide Apps):

```
 Tasks:    17 successful, 17 total
Cached:    17 cached, 17 total
  Time:    515ms >>> FULL TURBO
```

Der neue Hook ist im interaktiven Betrieb ein No-Op (s. §2A) → **keine Regression**; FULL-TURBO-Cache
bestätigt, dass nichts am Build-Verhalten der Apps berührt wurde.

## 2) Verhalten — `autopilot-guard.mjs` (Laufzeit, frisch ausgeführt)

`node --check` grün; `.claude/settings.json` valides JSON. Direkte Hook-Aufrufe mit stdin-JSON:

**A) OHNE Marker = striktes No-Op** (der entscheidende Regressions-Schutz für normales Arbeiten):
```
exit=0  protected path (compose.yml), kein Marker
exit=0  git push, kein Marker
```

**B) MIT Marker `.claude/.autopilot-active` = harte DENY (exit 2)** — alle geschützten Pfade + Kommandos:
```
exit=2  compose.yml | Caddyfile | Dockerfile | db-init/01-users-and-dbs.sh
exit=2  apps/ringwerk/prisma/schema.prisma | apps/treffsicher/prisma/migrations/x/migration.sql
exit=2  docs/decisions.md | .claude/settings.json | scripts/vereinsheim
exit=2  git push | git merge | git reset --hard | docker push | prisma migrate deploy | vereinsheim deploy
```

**C) MIT Marker = erlaubt (exit 0)** — was der Autopilot legitim tun darf:
```
exit=0  apps/ringwerk/src/x.ts (normale App-Datei)
exit=0  git add -A && git commit -m feat:x (normaler Commit)
exit=0  git commit -m "do not git push" (Erwähnung in Message, kein echtes Kommando — Quote-Reduktion)
exit=0  kaputtes JSON (fail-open, wie pretool-guard/stop-gate)
```

**D) Verdrahtung** — beide PreToolUse-Hooks in der Kette, Reihenfolge erhalten:
```
pretool-guard.mjs + autopilot-guard.mjs
```

**E) Marker gitignored** — `git check-ignore .claude/.autopilot-active` matcht → kein versehentliches Commit.

## 3) Hard-Rule-Konformität

- **Hard Rule 2/3:** 5 fokussierte Commits auf `feat/auto-implement-loop`, **kein** `Co-Authored-By`
  (`git log … | grep -ci co-authored-by` → `0`); kein Merge/Push (user-gated).
- **Hard Rule 4:** interaktiv eingehalten (alle Commit-Messages hier vorab als fenced block gezeigt);
  die *autonome Ausnahme* ist in ADR-022 + `CLAUDE.md` dokumentiert.
- **Hard Rule 6:** ADR-022 als kanonische Quelle ergänzt (vor „Mögliche Folge-ADRs"); realisiert
  ADR-018 §5, schärft ADR-020.

## 4) Offen / Caveats (ehrlich)

- **Live-Wiring erst nach Claude-Code-Reload:** `.claude/settings.json`-Hooks werden bei SessionStart
  geladen; der `autopilot-guard` ist in *dieser* Session daher nur **standalone** verifiziert (oben),
  die Kette als valides JSON belegt. Das ist konsistent mit der Repo-Konvention für Hook-Änderungen
  („Greifen ab dem nächsten Claude-Code-Reload"). Dass die PreToolUse-Kette grundsätzlich live ist,
  zeigte sich in dieser Session, als `pretool-guard` ein grep mit Secret-Namen blockte.
- **Kein echter autonomer Lauf** in diesem PR (bewusste Scope-Grenze) — die 8-Schritt-Iteration ist
  durch Plan + Skill spezifiziert, aber noch nicht gegen einen realen Folge-Plan gefahren. Empfehlung
  für den ersten Live-Lauf: ein mechanischer Plan (z.B. ActionResult-Vereinheitlichung Treffsicher) im
  Worktree, Review des Ledgers + Diffs vor Merge.
- **`autopilot-guard` deckt nur Edit/Write/NotebookEdit/Bash** — der Schreib-/Deploy-Vektor. Andere
  Tool-Typen sind kein Schutz-relevanter Pfad.

## Fazit

Alle Plan-Verification-Punkte erfüllt, Evidenz frisch. **Merge-reif nach Review** — weiter mit
`/review` (PIV-Schritt 4). Merge nach `main` bleibt user-gated.
