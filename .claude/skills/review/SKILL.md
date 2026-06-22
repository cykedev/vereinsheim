---
name: review
description: Run an adversarial code review of the current branch diff by delegating to the committed code-reviewer sub-agent, and record findings in reports/. Use after /validate, before merging to main.
---

PIV step 4 of 4. Delegate the review to the **`code-reviewer`** sub-agent (in `.claude/agents/`):

- Launch it via the Agent tool (`subagent_type: code-reviewer`) with the branch diff
  (`git diff main...HEAD`) and the relevant conventions (`docs/shared-conventions.md`,
  `apps/<app>/docs/code-conventions.md` + `ui-patterns.md`).
- It checks correctness, convention adherence, drift between the two apps' shared files, and
  uses the **codegraph** MCP for impact/call-graph. It returns a structured verdict
  (confirmed issues + severity + concrete fixes).
- **Acting on findings:** verify each against the code before implementing — no performative
  agreement, and push back with technical reasoning if a finding is wrong for this codebase.
  Clarify anything ambiguous first; then fix in order **blockers → simple → complex**.
- Record confirmed findings in **`reports/YYYY-MM-DD-<topic>-review.md`**; address blockers,
  then re-run **/validate** if code changed.

Only after green gates + a clean review: merge to `main` with `--ff-only` (after user OK).
