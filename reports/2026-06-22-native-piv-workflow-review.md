# Native PIV Workflow — Code Review

> PIV step-4 report. Branch `feat/native-piv-workflow`. Reviewer: committed `code-reviewer`
> sub-agent. 2026-06-22.

Harness/docs-only change (native PIV + Superpowers removal). **No BLOCKER.** Core verified by the
reviewer: Superpowers fully out of the active instruction layer, ADR-020 written, the five
disciplines genuinely harvested, JSON valid, skills internally consistent.

## Findings & resolution

| #   | Sev    | Finding                                                                                                | Resolution                                                                 |
| --- | ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | SHOULD | ADR-020 title says "supersedes ADR-018/**019**" but only ADR-018 got a Nachtrag                        | Added ADR-019 Nachtrag (plugin removed; app-root layout itself unchanged)  |
| 2   | SHOULD | `apps/ringwerk/CLAUDE.md` "During implementation" made subagent-per-task the norm — contradicts `/implement` (opt-in) | Reworded: main-agent task-by-task default, subagent opt-in       |
| 4   | NIT    | "neuer ADR (ADR-019+)" stale (020 exists)                                                              | → ADR-021+                                                                 |
| 5   | NIT    | `[ADR-020](decisions.md)` link resolves to the file, not the heading                                  | → plain-text "ADR-020" (matches the file's convention)                     |
| 3   | NIT    | `worktrees.md` docs-row "orphan"                                                                       | **Not changed** (pushback): worktrees stay valid via the `/implement` opt-in subagent path + ADR-018 §5 (worktree isolation); the doc is accurate. |

## Verified, not issues (per reviewer)

- `apps/treffsicher/CLAUDE.md` correctly unchanged (never carried a Superpowers/MANDATORY-GATE section).
- Both apps' `docs/superpowers/` archives kept as history; ADR-020 covers both.
- Skills internally consistent: PIV 1–4 numbering intact, `/debug` sits outside the numbered spine and
  hands off to `/implement` + `/validate`; root + ringwerk CLAUDE.md both list `/debug`.

Post-fix the changes are docs-only → gates unaffected (`pnpm check` green).
