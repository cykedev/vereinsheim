---
name: commit-msg
description: Analyze the current staged/working changes and produce a Conventional-Commits message in English. Use when the user asks for a commit message or to generate one from the diff.
---

Inspect the diff (`git diff`, `git diff --cached`, `git status`) and write a
**Conventional-Commits** message in **English**:

- Subject: `type(scope): summary` — imperative mood, ≤ ~72 chars.
- Body: what changed + **why**, wrapped ~80 cols; bullet list for multiple points.
- **No `Co-Authored-By`** or attribution trailers of any kind.
- **Show the message as a fenced code block before committing** (project hard rule),
  so the user can review it.

Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `build`, `perf`.
Scope = the touched app or area (`ringwerk`, `treffsicher`, `monorepo`, `harness`,
`docker`, `decisions`, …).
