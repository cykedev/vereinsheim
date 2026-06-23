---
name: implement
description: Execute an approved plan from plans/<...>.md — autonomously by default (ADR-022). Grinds the plan task by task (one focused commit each, pnpm check as gate), halting only at circuit-breakers and the user-gated merge. Use after /plan is approved and the branch + plan-commit exist.
---

PIV step 2 of 4. **Autonom-by-default (ADR-022):** Plan-Freigabe = die einzige Opt-in-Grenze; danach
läuft die Umsetzung durch, bis ein Breaker greift oder der Plan fertig ist. Merge/Push/Deploy nach
`main` bleiben user-gated. Für bewussten Einzelschritt: `/implement --step` (kein Marker → Guard
No-Op, Halt nach einem Task).

Vor dem ersten Task: Plan + dessen `## Required Docs` (App + `docs/shared-conventions.md`) lesen.

## Preflight (einmal pro Lauf)

- **Worktree-Pflicht:** `git rev-parse --show-toplevel` enthält `/.claude/worktrees/` **und**
  `git branch --show-current` beginnt mit `feat/`. Sonst **HALT** („Autopilot nur im isolierten
  Worktree auf `feat/`-Branch").
- Plan unter `plans/<…>.md`; **Ledger** `reports/<plan-stem>-autopilot.md` lesen/anlegen (Plan-Pfad,
  Branch, Cap `20`, Iterations-Zähler, Fortschritts-Checkliste, Ereignis-Log).
- **Marker** `.claude/.autopilot-active` schreiben (außer bei `--step`): aktiviert den
  `autopilot-guard`-Hook. Bei `--step` keinen Marker setzen.

## Iteration = ein Plan-Task

1. **Nächsten Task** aus dem Ledger wählen (erster nicht-`done`). Keiner offen → **FINALIZE**.
   Iterations-Zähler `+1`; `> Cap` → **HALT** (Breaker: Cap).
2. **Ambiguität (Breaker):** Task nicht konkret umsetzbar (keine klare Datei/Änderung, „TBD", offene
   Designfrage) → **HALT**.
3. **Scope (Breaker):** Änderung muss in den vom Plan gelisteten, nicht-geschützten Pfaden bleiben.
   Geschützter Pfad / plan-fremde Datei → **HALT**. (Zusätzlich hart durch `autopilot-guard` erzwungen.)
4. **Implementieren** — genau diesen einen Task. **Test-first (TDD) für Logik, Server-Actions,
   Bugfixes**: failing test → für den richtigen Grund fallen sehen → minimaler Code → grün refactoren.
   Pragmatische Ausnahme: reine UI/Config/Scaffolding bringt Tests im selben Commit. App-Konventionen
   befolgen (`apps/<app>/docs/code-conventions.md`, `…/ui-patterns.md`, `docs/shared-conventions.md`),
   vorhandene Utilities/Patterns wiederverwenden. Byte-identische Shared-Dateien beider Apps synchron
   halten, bis `packages/ui` greift (`consistency-check.sh`).
5. **Gate:** `pnpm check`. Grün → 6. Rot → self-heal, **max. 3 Versuche** insgesamt für den Task; danach
   weiter rot → WIP verwerfen (`git checkout -- . && git clean -fd`, Branch bleibt grün), Fehlschlag
   ins Ledger → **HALT** (Breaker: Gate rot).
6. **Commit** — ein kleiner, fokussierter Commit (Conventional Commits, EN; kein `Co-Authored-By`).
   **Hard-Rule-4-Ausnahme im autonomen Modus** (ADR-022): die Message wird **nicht** vorab als fenced
   block gezeigt, sondern ins Ledger + `git log` geschrieben (vor dem Merge revidierbar). Bei `--step`
   gilt Hard Rule 4 normal. Task im Ledger als `done` mit SHA markieren.
7. **Weiter** (mehr Tasks, Cap nicht erreicht) → nächste Iteration. Bei `--step`: hier HALT.

## HALT / FINALIZE

- **Bei jedem HALT:** Marker `.claude/.autopilot-active` **entfernen** (re-armt interaktives Editieren),
  Grund ins Ledger, dem User melden (kurz: welcher Breaker, welcher Task, was er entscheiden muss). Der
  User löst auf / passt den Plan an / überspringt; ein erneutes `/implement` nimmt den Lauf aus dem
  Ledger wieder auf.
- **FINALIZE** (Plan abgearbeitet): Marker entfernen, Ledger-Zusammenfassung schreiben + committen,
  dann **/validate**.

Das **Stop-Gate** läuft ohnehin am Turn-Ende (`pnpm check`) — nie rot aufhören.

Sub-Agenten-Option (opt-in, nicht Default): bei großen, **unabhängigen** Task-Sets eine frische Agent
pro Task; zwischen Tasks der `code-reviewer`-Agent.
