---
name: implement
description: Execute an approved plan from plans/<...>.md — implement it task by task with one focused commit per task. Use after /plan is approved and the branch + plan-commit exist.
---

PIV step 2 of 4. Given an approved `plans/<...>.md`:

- Read the plan and its `## Required Docs` (app + `docs/shared-conventions.md`) **before** coding.
- Follow the app's layer order / conventions (`apps/<app>/docs/code-conventions.md`,
  `…/ui-patterns.md`, root `docs/shared-conventions.md`). Reuse existing utilities/patterns.
- Work task by task; **one small, focused commit per task**; every behavior change includes its
  tests in the same commit. Show each commit message as a fenced block first (hard rule).
- Keep both apps' byte-identical shared files in sync until `packages/ui` exists
  (the `consistency-check.sh` drift gate enforces it).
- Don't finish red: the **stop-gate** hook runs `pnpm check`; resolve it before ending.

Then proceed to **/validate**.
