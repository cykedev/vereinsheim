# Native PIV Workflow — Validation

> PIV step-3 report. Branch `feat/native-piv-workflow`. 2026-06-22.

## Gates

`pnpm check` → **12/12 tasks green** (lint, format:check, test, check-types, build × 2 apps).

- First run was red: ringwerk DB tests (`publicSlug.test.ts`, 9 tests) errored because the **dev
  Postgres was down** (the prior session stopped it) — environmental, **not** a regression (this
  branch is harness/docs only, no app code). Brought it back up
  (`docker compose -f docker-compose.dev.yml up -d --wait`; container + volume + schema persisted)
  → re-run **green** (607→616 ringwerk tests pass).

## Invariants verified

- Instruction layer is **Superpowers-free**:
  `grep -rin superpowers CLAUDE.md apps/*/CLAUDE.md .claude/skills .claude/settings.json` → empty.
- `.claude/settings.json` valid JSON; `enabledPlugins` **absent** (plugin disabled for the repo).
- Skills present (13): incl. new **`debug`**, plus `plan/implement/validate/review`.
- Intended remaining Superpowers refs: `docs/decisions.md` + `docs/monorepo-plan.md` (document the
  decision), the dated `apps/*/docs/superpowers/` archives (history), `.gitignore` `/.superpowers/`
  (harmless), this plan/report.
- `apps/treffsicher/CLAUDE.md` had no Superpowers workflow section → correctly unchanged (no drift).

## Open

- Full effect (Superpowers skills gone, `/debug` available, no broken-plugin error) takes hold on the
  **next Claude Code reload** — settings/plugins load at session start.
- Merge to `main` (ff-only) + push are **user-gated**.
