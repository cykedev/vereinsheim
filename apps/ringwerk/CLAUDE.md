# Ringwerk — Claude Configuration

> **Monorepo:** Diese App liegt in `apps/ringwerk` im `vereinsheim`-Monorepo. Dev/Build/Gates laufen von der Repo-Wurzel (pnpm + Turborepo): `pnpm dev --filter ringwerk` (:3000), `pnpm check`. Das frühere per-App `docker-compose.dev.yml` / npm-im-Container gilt nicht mehr.

**Sprache:** Alle Kommunikation mit dem User auf Deutsch. Code, Commit-Messages und Agent-Prompts bleiben auf Englisch.

**App-übergreifende Konsistenz mit Treffsicher:** siehe die Root-`vault/conventions.md` (Single Source; UI/Config-Drift zwischen den Apps erzwingt `scripts/consistency-check.sh`).

## Hard Rules (non-negotiable, always active)

1. **Feature branches are mandatory.** Every new feature/session starts on a new branch. Propose a name (`feat/<topic>`), wait for user confirmation, then `git checkout -b`.
2. **Never commit directly to `main`.** All commits go on the feature branch.
3. **Never rebase or merge to `main` without explicit user confirmation.**
4. **Commit messages must never include `Co-Authored-By` lines.** No attribution trailers of any kind.
5. **Commit messages MUST be displayed as a fenced code block** before committing, so the user can review them.
6. **Finalize is mandatory** — if the user gives feedback or asks questions mid-implementation, incorporate them and still complete all wrap-up steps. Nothing may be left pending.

---

## Branch & Commit Workflow

### Starting a session

1. Propose a branch name (`feat/<topic>`) and wait for user confirmation.
2. `git checkout -b feat/<topic>`
3. Commit spec + plan files as the first commit on the branch (before implementation starts).

### During implementation

- One small, focused commit per task; every behavior change includes its tests in the same commit.
- For large, **independent** task sets you may dispatch a subagent per task (opt-in; see `/implement`).
- Plans must contain explicit test steps (new tests + updates to existing test mocks).

### Completing a session

- Run `/check` — all gates must be green.
- **Write lessons** — before `/consolidate-lessons`, add new entries to `.claude/tasks/lessons.md` for anything surprising, tricky, or worth remembering from this session. Format: `| YYYY-MM-DD | Was schiefgelaufen ist oder aufgefallen ist | Die Regel die es verhindert |`. Minimum 1 Eintrag pro Session — wenn nichts schiefgelaufen ist, dann eine Beobachtung über das Codebase oder einen nicht-offensichtlichen Entscheid.
- Run `/consolidate-lessons` — promote new learnings to docs.
- Memory-Graph (der Vault, ADR-025): REMEMBER-würdige Projektfakten (Incident/Provenance/Zustand) als `vault/incidents/`-Note festhalten (live editiert, kein Rebuild) — via `/consolidate-lessons` REMEMBER; die Note ist sofort im Graph.
- Doc sync: review session changes and update any stale vault notes for this app (`vault/apps/ringwerk/ringwerk-{features,data-model,architecture,…}.md`) — edit the note live (no rebuild, ADR-025); run `/sync-graph` to close cross-ref gaps. Commit updates.
- Present a summary of all commits on the branch.
- Merge to `main` with `git merge --ff-only` (no merge commit), then delete the branch with `git branch -d`.

---

## Session Start

1. Read `vault/apps/ringwerk/ringwerk-project-brief.md`
2. Read last 5 entries of `.claude/tasks/lessons.md`
3. Brief German onboarding message: "Alles klar" or any relevant context from lessons
4. Der SessionStart-Hook surface't den Memory-Graph (Projektgedächtnis): bei relevantem Vorwissen (Incident/Provenance/Zustand) vor breiter Exploration `mcp__memory__search_nodes`/`open_nodes` abfragen.

---

## Project Context

- **Name:** Ringwerk
- **Quality command:** `/check` — im Monorepo via `pnpm check` (turbo, von der
  Repo-Wurzel): `lint`, `format:check`, `test`, `tsc --noEmit`, `next build`.
  Das frühere `docker compose -f docker-compose.dev.yml run --rm app` gilt nicht
  mehr (per-App-File entfernt).
- **Layer order** (follow when implementing schema changes):
  Schema → Migration → Types → Queries → Actions → Calculate → Components → Page

### Compliance Rules (apply to all `.tsx` files)

1. No `window.confirm` / `alert` / `prompt` — use the project's dialog component
2. No `DropdownMenu` — use inline icon buttons in list rows
3. `rounded-lg border` without `bg-card` breaks dark mode — always add `bg-card`
4. Icon buttons: minimum `h-10 w-10`, never `h-8 w-8`
5. No bare `toLocaleDateString()` — use the project's date formatter

---

## Docs (load on-demand)

| Key               | Path                       | Load when                   |
| ----------------- | -------------------------- | --------------------------- |
| `projectBrief`    | `vault/apps/ringwerk/ringwerk-project-brief.md`    | Session start               |
| `features`        | `vault/apps/ringwerk/ringwerk-features.md`         | Clarifying feature scope    |
| `architecture`    | `vault/apps/ringwerk/ringwerk-architecture.md`     | Routes, directory structure |
| `techStack`       | `vault/apps/ringwerk/ringwerk-technical.md`        | Stack details, deployment   |
| `domainModel`     | `vault/apps/ringwerk/ringwerk-data-model.md`       | Business logic, formulas    |
| `codeConventions` | `vault/apps/ringwerk/ringwerk-code-conventions.md` | Writing code                |
| `uiPatterns`      | `vault/apps/ringwerk/ringwerk-ui-patterns.md`      | Building UI                 |
| `referenceFiles`  | `vault/apps/ringwerk/ringwerk-reference-files.md`  | Finding patterns, templates |
| `worktrees`       | `vault/apps/ringwerk/ringwerk-worktrees.md`        | Before using git worktrees  |

### Subagent Required Reading

If you are a subagent implementing a task, read these docs **before writing any code**:

| Doc                        | When                                      |
| -------------------------- | ----------------------------------------- |
| `vault/apps/ringwerk/ringwerk-code-conventions.md` | Always                                    |
| `vault/apps/ringwerk/ringwerk-reference-files.md`  | Always — find existing patterns first     |
| `vault/apps/ringwerk/ringwerk-data-model.md`       | Always — domain understanding             |
| `vault/apps/ringwerk/ringwerk-architecture.md`     | Always — layer order, directory structure |
| `vault/apps/ringwerk/ringwerk-features.md`         | Always — what features exist and how      |
| `vault/apps/ringwerk/ringwerk-ui-patterns.md`      | When creating or editing any `.tsx` file  |

Additional task-specific docs are listed in the plan under `## Required Docs`.

---

## Workflow

Use the repo-wide **PIV** workflow (root `CLAUDE.md` Hard Rule 7): a non-trivial change runs
`/plan → /implement → /validate → /review` — the plan is committed first on a `feat/<topic>`
branch and shown to the user before any code; bugs go through `/debug` (root-cause) first;
trivial/mechanical fixes go direct. Plans and reports live in the root `plans/` + `reports/`.

---

## Commands

| Command                | When                                    |
| ---------------------- | --------------------------------------- |
| `/check`               | Before every commit — all quality gates |
| `/test`                | Quick feedback — tests only             |
| `/migrate <name>`      | After schema change                     |
| `/seed`                | After `/db-reset`                       |
| `/db-reset`            | Reset dev database                      |
| `/commit-msg`          | Generate commit message from diff       |
| `/consolidate-lessons` | Compress lessons, promote rules to docs |
| `/debug`               | Root-cause a bug before fixing          |
