# Native PIV Workflow — Plan

> PIV step-1 artifact. Approved by the user on 2026-06-22. Branch: `feat/native-piv-workflow`.

## Context (why)

Superpowers (plugin) and our custom PIV skills currently coexist as two competing top-level
workflows — root `CLAUDE.md` points at PIV, `apps/ringwerk/CLAUDE.md` carries a
"MANDATORY GATE / Superpowers Workflow" section. Conflicting instructions hurt results.

Decision: make PIV the single, tailored spine; rebuild Superpowers' valuable **disciplines**
natively into the PIV skills; remove the Superpowers plugin entirely. One workflow, no external
plugin dependency, tailored to this monorepo (pnpm/turbo, two apps, gates, codegraph, deploy
contract). This **supersedes** ADR-018's "Superpowers as baseline" decision → recorded as ADR-020.

## Approach

Harvest these disciplines into the existing PIV skills (native text, no plugin to invoke):

- **/plan**: brainstorming front-end for fuzzy scope (one question at a time, 2-3 approaches +
  recommendation, present design + get approval **before** writing the plan); writing-plans rigor
  (bite-sized tasks, **no placeholders**, plan self-review against scope/types).
- **/implement**: TDD test-first + *watch it fail* — **pragmatic**: required for logic / server
  actions / bug fixes; **not** for pure UI/config/scaffolding (there: tests-in-same-commit + gates).
  Optional subagent-per-task (native Agent tool + `code-reviewer`) for large, independent task sets.
- **/validate**: evidence-before-claims (no "done/passing" wording without fresh verification output;
  the stop-gate already *enforces* the gate part at harness level).
- **/review**: receiving-review discipline (verify each finding before implementing, no performative
  agreement, clarify ambiguous items first, fix order blockers → simple → complex).
- **/debug** (new): systematic debugging — 4 phases, no fix without root cause, 3+ failed fixes →
  question the architecture, failing-test-first, codegraph for tracing.

Then anchor + remove:

- **Hard Rule 7** in root `CLAUDE.md`: non-trivial change → PIV; bug → `/debug` first; trivial/
  mechanical (typo, one-liner, pure doc) → direct. Plan before the first line of code.
- **Remove Superpowers**: drop `superpowers@claude-plugins-official` from `.claude/settings.json`;
  strip the Superpowers sections from `apps/ringwerk/CLAUDE.md` → point to root PIV. Keep
  `apps/treffsicher/docs/superpowers/` (dated archive) but write no new artifacts there — new
  plans/reports go to root `plans/` + `reports/`.
- **ADR-020** in `docs/decisions.md` (mark ADR-018's Superpowers adoption superseded); update
  `docs/monorepo-plan.md` §12 references.

## Files to change

- `.claude/skills/{plan,implement,validate,review}/SKILL.md` — harvest disciplines.
- `.claude/skills/debug/SKILL.md` — new.
- `CLAUDE.md` (root) — Hard Rule 7; harness section reworded (native PIV; no Superpowers).
- `.claude/settings.json` — remove `superpowers@…` from `enabledPlugins`.
- `apps/ringwerk/CLAUDE.md` — remove Superpowers Workflow / MANDATORY GATE / Docs Location;
  reference root PIV.
- `docs/decisions.md` — ADR-020; ADR-018 partial-superseded note.
- `docs/monorepo-plan.md` — §12 Superpowers references.

## Required Docs

- `docs/decisions.md` ADR-016/017/018/019 (harness rationale, what PIV replaces).
- `docs/shared-conventions.md` (conventions the `code-reviewer` enforces).

## Test steps / Verification

- `.claude/settings.json` stays valid JSON (`node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`).
- `pnpm check` — all 5 gates green (harness/doc edits are not turbo inputs → cache-green expected).
- `grep -ri superpowers CLAUDE.md .claude apps/*/CLAUDE.md` → no **active** references
  (the `apps/treffsicher/docs/superpowers/` archive is the only allowed hit).
- After a Claude Code reload: Superpowers skills gone, PIV + `/debug` present, no broken-plugin error.

## Commits

1. docs(plan): this file.
2. feat(skills): harvest Superpowers disciplines into PIV skills.
3. feat(skills): add /debug (systematic debugging).
4. docs(harness): Hard Rule 7 — PIV as default workflow.
5. chore(harness): remove Superpowers plugin; native PIV only.
6. docs(adr): ADR-020 native PIV (supersedes ADR-018 Superpowers baseline) + monorepo-plan §12.
