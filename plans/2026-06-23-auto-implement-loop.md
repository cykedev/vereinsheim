# Plan: Autonome `/implement`-Phase als Default (ADR-022)

> PIV-Schritt 1. Handoff für `/implement`. Branch: `feat/auto-implement-loop` (im Worktree
> `.claude/worktrees/ecstatic-benz-466691`). **User-Entscheidung (23.06.2026):** der teilautonome
> Loop soll **kein Opt-in-Kommando** sein, das man sich merken muss — der Vorteil soll **der Default**
> sein. Daher: **`/implement` selbst wird autonom-by-default.** Die eine Einwilligungsgrenze ist die
> **Plan-Freigabe** (die der User ohnehin gibt); Merge nach `main` bleibt user-gated.

## Kontext (warum)

Der klassische Ralph-Loop (`while :; do cat PROMPT.md | claude; done`) ist gefährlich, weil **nichts
ihn stoppt**, wenn er Mist baut, und sein Gedächtnis eine formlose Datei ist. Dieses Repo hat die drei
Zutaten für eine *sichere* Variante aber bereits:

- **Selbstkorrektur-Substrat:** das **Stop-Gate** ([`.claude/hooks/stop-gate.mjs`](../.claude/hooks/stop-gate.mjs))
  blockt das Turn-Ende, bis `pnpm check` (lint/format/test/tsc/build) grün ist. Ein autonomer Loop
  *kann* nicht mit kaputtem Code „fertig" sein.
- **Persistentes Cross-Iteration-Gedächtnis:** [`plans/`](.) (task-für-task) + [`reports/`](../reports)
  statt formloser `PROMPT.md`.
- **Den Loop-Body:** [`/implement`](../.claude/skills/implement/SKILL.md) ist bereits „Plan task-by-task,
  ein fokussierter Commit pro Task" — heute nur *manuell getaktet*. Es fehlt also keine Infrastruktur,
  sondern nur (a) die **autonome Taktung** in `/implement` (es pausiert nicht mehr zwischen Tasks,
  sondern grindet bis Breaker/fertig) und (b) eine **erzwungene** Schutz-Schicht, damit Autonomie nie
  an die gefährlichen Pfade kommt (ADR-017: ENFORCE > DOCUMENT — eine *weiche* Regel ist genau das,
  was unter unbeaufsichtigtem Grinden versagt).

**Warum Default statt Opt-in:** der User will sich nicht pro Task/Plan aktiv „dafür" entscheiden, sondern
**immer** vom Autopiloten profitieren. Die Plan-Freigabe ist bereits eine bewusste menschliche
Einwilligung — ein *zweites* Kommando (`/auto-implement`, `/loop …`) wäre eine redundante Entscheidung.
Also wird Autonomie der Normalfall von `/implement`; der Mensch wird nur noch geholt, wenn es darauf
ankommt (Breaker) bzw. am Merge.

## Sicherheitsmodell & Scope-Grenzen

Die Einwilligungsgrenzen von PIV bleiben menschlich — nur **an weniger, aber den richtigen Stellen**:

1. **Plan-Freigabe = die eine Opt-in-Grenze** (Struktur-Invariante, kein Entscheidungspunkt pro Lauf):
   Autonomie greift **nur über einen bereits per `/plan` freigegebenen Plan**. Der Plan-als-Spec ist
   das, was den Loop sicher macht (die Breaker messen „Scope = Plan"). „Autonom ohne Plan" gibt es
   bewusst nicht — das wäre kein Loop, sondern „mach irgendwas".
2. **Merge nach `main` bleibt user-gated** (Hard Rule 2) — der Loop committet nur lokal auf den
   `feat/`-Branch im Worktree; er pusht/merged/deployed nie.
3. **Geschützte Pfade sind tabu** (hart erzwungen, s.u.): Deploy-Vertrag, Schema/Migrationen, ADRs,
   Secrets, die Harness selbst, `scripts/`.
4. **Triviale Fixes** (Hard Rule 7: Typo/One-Liner/Doku) laufen wie bisher direkt, ohne PIV/Autopilot.

## Ansatz

**Drei Bausteine**, alle an Vorhandenes andockend (CLAUDE.md: „wrappt vorhandene Bausteine,
dupliziert nicht"):

### A) `/implement` wird autonom-by-default (kein neues Skill)

`.claude/skills/implement/SKILL.md` wird überarbeitet: statt „task by task, dazwischen pausieren" jetzt
**autonom durchlaufen** über einen freigegebenen Plan. **Eine Iteration = ein Plan-Task.** Der Loop
läuft in-Turn; für *sehr lange* Pläne darf `/implement` intern via ScheduleWakeup pacen (built-in
`/loop`-Mechanik, **keine eigene Loop-Infra**, **kein** vom User getipptes Kommando). Zustand im
**Ledger** (= Ralph-„Stack"-Datei). Ablauf:

1. **Preflight:**
   - **Worktree-Pflicht:** sicherstellen, dass wir in einem Worktree auf einem `feat/`-Branch sind
     (`git rev-parse --show-toplevel` enthält `/.claude/worktrees/` **und** `git branch --show-current`
     beginnt mit `feat/`). Sonst **HALT** („Autopilot nur im isolierten Worktree auf `feat/`-Branch").
   - Plan unter `plans/<…>.md` lesen; Ledger `reports/<plan-stem>-autopilot.md` lesen/anlegen.
   - **Marker** `.claude/.autopilot-active` schreiben/aktualisieren (Inhalt: Plan-Pfad, Cap,
     Iterations-Zähler). Zähler `+1`; wenn `> Cap` → **HALT** (Breaker: Cap erreicht).
2. **Nächsten Task wählen:** erster Plan-Task, der im Ledger noch nicht `done` ist.
   - Keiner mehr offen → **FINALIZE** (s.u.).
3. **Ambiguitäts-Check (Breaker):** ist der Task nicht konkret umsetzbar (keine klare Datei/Änderung,
   „TBD", offene Designfrage) → **HALT** (Breaker: mehrdeutig).
4. **Scope-Check (Breaker):** die Änderung muss innerhalb der im Plan unter „Dateien" gelisteten,
   **nicht-geschützten** Pfade bleiben. Braucht sie einen geschützten Pfad oder eine plan-fremde
   Datei → **HALT** (Breaker: Scope). (Zusätzlich hart durch B erzwungen.)
5. **Implementieren:** genau diesen einen Task, TDD wo Logik (wie das bisherige `/implement`).
6. **Gate:** `pnpm check`. Grün → 7. Rot → self-heal, **max. 3 Versuche** insgesamt für den Task.
   Danach immer noch rot → WIP verwerfen (`git checkout -- . && git clean -fd`, Branch bleibt grün),
   Fehlschlag im Ledger notieren → **HALT** (Breaker: Gate rot).
7. **Commit:** ein fokussierter Commit (Conventional Commits, EN; kein `Co-Authored-By`). Die
   Commit-Message wird ins Ledger geschrieben — im autonomen Modus entfällt Hard Rule 4 („fenced block
   *vor* dem Commit") bewusst, weil sie die Autonomie zunichtemachen würde; die Message ist im Ledger
   + `git log` **vor dem Merge** revidierbar (der ADR hält diese Ausnahme fest). Task im Ledger als
   `done` mit SHA markieren.
8. **Weiter/Stop:** mehr offene Tasks **und** Cap nicht erreicht → nächste Iteration. Sonst FINALIZE.

**FINALIZE** (Plan abgearbeitet): Marker entfernen, Ledger-Zusammenfassung schreiben + committen,
an **`/validate`** übergeben.

**Bei jedem HALT:** Marker `.claude/.autopilot-active` **entfernen** (das re-armt normales interaktives
Editieren geschützter Pfade), Grund ins Ledger, dem User melden. Der User entscheidet (Breaker
auflösen, Plan anpassen, Task überspringen) und stößt `/implement` erneut an — es nimmt den Lauf aus
dem Ledger wieder auf.

**Manueller Einzelschritt (Escape-Hatch):** `/implement --step` (bzw. „nur ein Task")-Hinweis im Skill —
für den seltenen Fall, dass der User doch Task-für-Task fahren will. Default ist autonom.

**Ledger-Format** (`reports/<plan-stem>-autopilot.md`, transient während des Laufs, beim
FINALIZE/HALT committet — der Audit-Trail des autonomen Laufs):

```markdown
# Autopilot-Ledger: <topic>
- Plan: plans/<…>.md
- Branch: feat/<…>
- Iterations-Cap: 20
- Iteration: <n>/<cap>

## Fortschritt
- [x] Task 1 — <kurztitel> — <sha> (Iter 1)
- [ ] Task 2 — <kurztitel>

## Ereignisse
- Iter 3: HALT (Breaker: protected-path) — Task 5 will compose.yml ändern.
```

**Cap:** Default `20` Iterationen (Runaway-Backstop); pro Lauf im Ledger fixiert.

### B) Hook `autopilot-guard.mjs` — die ERZWUNGENE Schutz-Schicht

Neues `.claude/hooks/autopilot-guard.mjs`, verdrahtet in `.claude/settings.json` als **PreToolUse**
(`Edit|Write|Bash`). Spiegelt Stil + Fail-open-Prinzip von [`pretool-guard.mjs`](../.claude/hooks/pretool-guard.mjs).
**Nur aktiv, wenn der Marker `.claude/.autopilot-active` existiert** — im normalen interaktiven
Betrieb (und bei `/implement --step` ohne Marker) ist der Hook ein No-Op. So ist der Scope-/
Protected-Path-Breaker ein **hartes Gate**, kein Wunsch (ADR-017 ENFORCE).

- **Geschützte Pfade (Edit/Write/NotebookEdit → DENY, exit 2):** `compose.yml`, `Caddyfile`,
  `Dockerfile`, alles unter `db-init/`, jede `**/prisma/schema.prisma`, alles unter
  `**/prisma/migrations/`, `docs/decisions.md` (ADRs), `.env`/`.vereinsheim.local` (Secrets; doppelt
  zu pretool-guard, bewusst), alles unter `.claude/` (Harness-Selbstmodifikation: settings, hooks,
  skills, agents — Autopilot darf seine eigenen Leitplanken nicht umschreiben), alles unter
  `scripts/` (Ops-CLI + Deploy-/Gate-Skripte).
- **Geschützte Kommandos (Bash → DENY, exit 2):** `git push`, `git merge`, `git rebase`,
  `git reset --hard`, `./scripts/vereinsheim` mit `deploy|build|release|backup|restore`, `docker push`,
  `prisma migrate` (deploy/dev/reset). Erkennung wie in pretool-guard: Heredocs + gequotete Strings
  vorher ausblenden (nur echte Kommandos zählen, keine bloße Erwähnung in Commit-Messages/`echo`).
- **Fail-open:** jeder Parse-/IO-/Logikfehler → `exit 0` (nie bricken), exakt wie die anderen Hooks.

### C) Doku + Verdrahtung

- `.claude/settings.json`: den neuen Hook in den vorhandenen `PreToolUse`-Block aufnehmen (zweiter
  `command` neben `pretool-guard.mjs`; Matcher deckt `Edit|Write|…|Bash` bereits ab).
- `.gitignore`: `.claude/.autopilot-active` (transienter, maschinen-lokaler Marker).
- `docs/decisions.md`: **ADR-022** (s. Task 1).
- `CLAUDE.md` + `docs/architecture.md`: in der Harness-/PIV-Beschreibung festhalten, dass die
  Implement-Phase **autonom-by-default** ist (Plan-Freigabe = Einwilligungsgrenze, Merge user-gated,
  Breaker, Verweis ADR-022). Hard-Rule-Block: Notiz zur autonomen Ausnahme von Hard Rule 4.

## Dateien (zu ändern/anzulegen)

| Datei | Art | Inhalt |
| --- | --- | --- |
| `docs/decisions.md` | edit | ADR-022 (neuer Abschnitt vor „Mögliche Folge-ADRs") |
| `.claude/hooks/autopilot-guard.mjs` | neu | erzwungene Schutz-Schicht, marker-gated, fail-open |
| `.claude/settings.json` | edit | Hook in PreToolUse verdrahten |
| `.claude/skills/implement/SKILL.md` | edit | autonom-by-default: 8-Schritt-Iteration, Breaker, Ledger, Cap, Worktree-Pflicht, Escape-Hatch |
| `.gitignore` | edit | `.claude/.autopilot-active` |
| `CLAUDE.md` | edit | PIV-/Harness-Absatz + Hard-Rule-4-Ausnahme: Implement autonom-by-default |
| `docs/architecture.md` | edit | Knowledge-&-Harness-Abschnitt: Autopilot-Default erwähnen |

## Required Docs (vor dem Coden lesen)

- [`docs/decisions.md`](../docs/decisions.md) — ADR-016/017/018/020/021 (Harness/PIV/ENFORCE-Prinzip),
  als Vorlage für ADR-022-Format. **ADR-020** (nativer PIV) wird durch ADR-022 ergänzt/nachgeschärft.
- [`.claude/hooks/pretool-guard.mjs`](../.claude/hooks/pretool-guard.mjs) — Stil/Fail-open/Heredoc-
  Reduktion, die `autopilot-guard.mjs` spiegeln muss.
- [`.claude/hooks/stop-gate.mjs`](../.claude/hooks/stop-gate.mjs) — das Gate, das die Iteration als
  Erfolgskriterium nutzt.
- [`.claude/skills/implement/SKILL.md`](../.claude/skills/implement/SKILL.md) (Ist-Stand) +
  [`.claude/skills/validate/SKILL.md`](../.claude/skills/validate/SKILL.md) — Body-Semantik + Übergabe.
- [`CLAUDE.md`](../CLAUDE.md) Hard Rules (insb. 2, 3, 4, 6, 7) — die der Autopilot bewusst (4) bzw.
  strikt (2, 3, 6, 7) behandelt.

## Aufgaben (bite-sized, ein Commit pro Task)

1. **ADR-022 schreiben** (`docs/decisions.md`): Status Accepted (Juni 2026); Kontext (Ralph unsicher,
   wir haben die Zutaten; User will Autonomie als Default, nicht als Opt-in); Entscheidung
   (Implement-Phase autonom-by-default; Plan-Freigabe = einzige Opt-in-Grenze; Merge+Push+Deploy
   user-gated; fünf Breaker; erzwungene Schutz-Schicht (Hook); Worktree-Pflicht; Cap=20;
   Hard-Rule-4-Ausnahme im autonomen Modus; Escape-Hatch `--step`); Alternativen (voller Ralph /
   reines PIV / separates Opt-in-Skill `/auto-implement` — verworfen, weil redundante Entscheidung);
   Folgen (überarbeitetes `/implement` + neuer Hook + Marker + .gitignore + Doku). Verweise auf
   ADR-017/018/020.
   _Test:_ `grep -c '^## ADR-022' docs/decisions.md` == 1; ADR-022 vor „Mögliche Folge-ADRs".
2. **Hook `autopilot-guard.mjs` + settings-Verdrahtung**: Hook anlegen (marker-gated, geschützte
   Pfade + Kommandos, fail-open), in `.claude/settings.json` PreToolUse ergänzen.
   _Tests (manuell, via stdin-JSON):_
   - `node .claude/hooks/autopilot-guard.mjs` mit `{"tool_name":"Edit","tool_input":{"file_path":"compose.yml"}}` **ohne** Marker → exit 0.
   - Marker anlegen (`touch .claude/.autopilot-active`), gleicher Input → exit 2 (DENY).
   - Marker da, `{"tool_name":"Write","tool_input":{"file_path":"apps/ringwerk/src/x.ts"}}` → exit 0 (erlaubt).
   - Marker da, `{"tool_name":"Bash","tool_input":{"command":"git push origin feat/x"}}` → exit 2.
   - Marker da, `{"tool_name":"Bash","tool_input":{"command":"git commit -m \"mention git push in msg\""}}` → exit 0 (nur Erwähnung).
   - Marker da, kaputtes JSON → exit 0 (fail-open). Marker danach wieder entfernen.
   - `node --check .claude/hooks/autopilot-guard.mjs`.
3. **`/implement` überarbeiten + `.gitignore`**: `SKILL.md` umschreiben (autonom-by-default: die
   8-Schritt-Iteration, Breaker, FINALIZE/HALT, Ledger-Format, Cap=20, Worktree-Pflicht,
   Escape-Hatch `--step`; Übergabe an `/validate`); `.gitignore` um `.claude/.autopilot-active`
   ergänzen.
   _Test:_ `node --check`-Äquiv. entfällt (Markdown); Frontmatter `name: implement` unverändert;
   `git check-ignore .claude/.autopilot-active` matcht.
4. **Doku-Wiring** (`CLAUDE.md`, `docs/architecture.md`): Implement-Phase als autonom-by-default
   beschreiben (Plan-Freigabe = Grenze, Breaker, Verweis ADR-022); Hard-Rule-4-Ausnahme notieren.
   _Test:_ `grep -l 'autonom\|autopilot\|ADR-022' CLAUDE.md docs/architecture.md`.

## Verification (nach allen Tasks, vor `/validate`)

- `node --check .claude/hooks/autopilot-guard.mjs` grün; alle Hook-Smoke-Tests aus Task 2 zeigen das
  erwartete exit-Verhalten (DENY nur bei Marker, fail-open bei Müll).
- `.claude/.autopilot-active` ist nach den Tests entfernt **und** gitignored (kein versehentliches
  Commit des Markers).
- `pnpm check` grün (Stop-Gate; der neue Hook ist im interaktiven Betrieb No-Op → keine Regression).
- `git log --oneline` zeigt 4 fokussierte Commits (+ Plan-Commit) mit EN-Conventional-Messages, kein
  `Co-Authored-By`.
- **Trockenlauf-Plausibilität (kein echter autonomer Lauf in diesem PR):** im Review prüfen, ob die
  8-Schritt-Iteration einen realen, mechanischen Folge-Plan (z.B. die ActionResult-Vereinheitlichung
  in Treffsicher) sauber abarbeiten würde — inkl. korrektem HALT bei einem Schema-/Deploy-Pfad.

## Nicht in diesem Scope

- Ein echter autonomer Lauf gegen einen Produktiv-Plan (separater Schritt nach dem Merge).
- Token-/Kosten-Telemetrie über den Iterations-Cap hinaus.
- Änderung des built-in `/loop` (intern als Pacing-Mechanik nutzbar, unverändert).
