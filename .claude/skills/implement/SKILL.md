---
name: implement
description: Execute an approved plan from plans/<...>.md — implement it task by task with one focused commit per task. Use after /plan is approved and the branch + plan-commit exist.
---

PIV step 2 of 4. Given an approved `plans/<...>.md`:

- Read the plan and its `## Required Docs` (app + `docs/shared-conventions.md`) **before** coding.
- Follow the app's layer order / conventions (`apps/<app>/docs/code-conventions.md`,
  `…/ui-patterns.md`, root `docs/shared-conventions.md`). Reuse existing utilities/patterns.
- **Test-first (TDD) for logic, server actions, and bug fixes**: write the failing test, **run it
  and watch it fail for the right reason**, then the minimal code to pass, then refactor while
  green. Pragmatic exception: pure UI / config / scaffolding ships its tests in the same commit
  (no test-first ritual where it adds no signal).
- Work task by task; **one small, focused commit per task**; every behavior change includes its
  tests in the same commit. Show each commit message as a fenced block first (hard rule).
- For a large plan with **independent** tasks, you may dispatch a fresh subagent per task (Agent
  tool) and review between tasks with the `code-reviewer` agent — opt-in, not the default.
- Keep both apps' byte-identical shared files in sync until `packages/ui` exists
  (the `consistency-check.sh` drift gate enforces it).
- Don't finish red: the **stop-gate** hook runs `pnpm check`; resolve it before ending.

Then proceed to **/validate**.
