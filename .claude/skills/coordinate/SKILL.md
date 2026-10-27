---
name: coordinate
description: Run a multi-part project (several sub-plans) as the coordinating session — plan each part via /plan, keep a coordination plan as ledger, start one child session per approved sub-plan in its own worktree, take over finished branches. Use when a project splits into several plans (ADR-035); a single change stays plain PIV.
---

The level **above** PIV (ADR-035). Every part still runs `/plan → /implement → /validate → /review`; this session
plans and coordinates, child sessions build. **This session writes no code.** It runs in the main checkout, without a
worktree, on the base branch `feat/<topic>`.

## Setup (once per project)

1. Base branch `feat/<topic>` from `main`, checked out in the main checkout.
2. Coordination plan `plans/<date>-<topic>.md`, committed on the base branch, with:
   - **Principles** — always these three, plus the project's own:
     - Removing removes only what is removed (dependent data stays).
     - Always store the maximum of data (store what the source gives, judge in the view).
     - Build on what exists instead of inventing new.
   - **Branches** — which parts go to `main` one by one (useful on their own, branch from `main`), which stay on the
     base branch (only go live together). No merge commits.
   - **Rules for child sessions** — §4 of ADR-035, adapted.
   - **Parts** and a **Status** table: part · plan · branch · session · status. Update it after every step.

## Per part

1. **Plan** via `/plan`. Hand exploration to sub-agents (Explore, Plan) so this context stays lean over the whole
   project. Commit the sub-plan on the base branch; lay it before the user.
2. **Start the child** only on a message from the user (otherwise propose it as a card). Fresh context, own worktree,
   the brief below. A child the user starts from a card does not get its base branch (the card drops
   `source_branch`): after the start, check with `git merge-base --is-ancestor <base> <child-branch>` that its
   worktree sits on the right base, otherwise correct it by message. Run in parallel only what does not touch each other: at most one child changes an app's schema at
   a time (shared dev DB), assign dev-server and script-check ports, never reset the dev DB, two to three children
   at once.
3. **While it runs:** decide technical questions yourself, take domain questions to the user. Judge user ideas
   critically (verdict, risks, counter-proposal). Review every diff to a protected path (ADR-023) before the child
   commits it.
4. **Take over** a finished branch (checklist below), then update the status table.
5. **Clean up:** remove implemented plans; after a child archived itself, remove leftovers (worktree only after
   checking it for unsaved changes: `git -C <wt> status --short`, unpushed commits).

## Brief for a child session

```
You are a child session of <coordinating session id>. Implement exactly the approved sub-plan <plan>.

Setup: git branch -m feat/<short>-<part> (base: <main | feat/<topic>>). First commit is the plan:
git show feat/<topic>:plans/<plan>.md > plans/<plan>.md. Node: <PATH export>, pnpm install --frozen-lockfile,
symlink apps/*/.env from the main checkout. Dev server / script check on port <n>. The Stop hook checks the main
checkout — run pnpm check and node .claude/vault-lint.mjs in your worktree yourself.

Work: /implement <autonomous | --step / by hand, because <protected paths>>, then /validate and /review. Do not
re-plan: report deviations and wait. Protected paths: send me the diff, commit only after my OK. Talk only to me via
SendMessage, never to the user. Start no sessions (sub-agents are fine). No merge, push, release, deploy. Never reset
the dev DB. No personal data outside reports/.

Finish: vault notes and lessons first, remove the implemented plan in the last commit, rebase onto <base>, gate green,
then report: branch, commits, report path, what is not verified, whether a new bridge or a deploy step is needed.
No commits after that.

Clean up after I say "taken over": copy your reports/ into the main checkout's reports/, delete branch and
worktree, archive yourself.
```

## Checklist: take over a branch

- [ ] Fast-forward possible: `git merge-base --is-ancestor <base> <branch>`.
- [ ] Gate in the child's worktree with the right Node version, via `git -C <wt> …` or a subshell
      (`(cd <wt> && pnpm check)`), never a bare `cd` that moves this session's shell.
- [ ] Diff free of personal data (ADR-029): `git diff <base>...<branch>`.
- [ ] Migrations additive only (no drop/rename of data-bearing columns).
- [ ] Plan removed in the branch's last commit; vault notes and lessons present.
- [ ] Into the base branch: `git merge --ff-only <branch>`.
- [ ] Into `main`: only with the user's OK, ff-only; `git fetch . <branch>:main` when `main` is checked out nowhere.
- [ ] Then at once: `git rebase main` on the base branch, resolve conflicts, `pnpm install --frozen-lockfile`, gate.
- [ ] Tell the child "taken over"; update the status table.
