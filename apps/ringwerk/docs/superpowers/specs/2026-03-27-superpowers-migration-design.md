# Superpowers Migration Design

**Goal:** Replace the custom 4-stage pipeline with the superpowers plugin as the workflow engine, while preserving all project-specific context, quality gates, and documentation.

**Architecture:** Slim CLAUDE.md with hard rules + project context + superpowers skill references. All project-specific knowledge stays in `.claude/docs/`. Custom agents, hooks, and pipeline.json are removed.

**Scope:** Configuration and documentation changes only — no application code changes.

---

## What Gets Removed

| Asset                              | Action                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pipeline.json`                    | Deleted — content migrated into CLAUDE.md                                                                      |
| `.claude/agents/*` (9 files)       | Deleted — generic ones replaced by superpowers subagents; project-specific guidance folded into CLAUDE.md/docs |
| `.claude/hooks/code-compliance.sh` | Deleted — superpowers quality process replaces enforcement                                                     |
| `.claude/hooks/schema-gate.sh`     | Deleted — schema guidance moves into CLAUDE.md                                                                 |
| `.claude/hooks/completeness.sh`    | Deleted — `finishing-a-development-branch` skill handles this                                                  |
| `.claude/hooks/session-init.sh`    | Deleted — session start defined in CLAUDE.md                                                                   |
| `settings.json` hooks config       | Removed — only plugin activation entry remains                                                                 |

Content migrated from `pipeline.json` into new CLAUDE.md:

- Quality gates (lint, format, test, typecheck via `/check`)
- Layer order (Schema → Migration → Types → Queries → Actions → Calculate → Components → Page)
- 5 compliance rules (native dialogs, DropdownMenu, bg-card, touch targets, date formatter)
- Docs path table (on-demand loading)

## What Stays

| Asset                                                    | Reason                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.claude/docs/*`                                         | Valuable project knowledge — loaded on-demand                                                                |
| `.claude/tasks/todo.md`, `lessons.md`, `todo-archive.md` | Continuity — learning log and task history                                                                   |
| `.claude/commands/*` (8 commands)                        | `/check`, `/test`, `/migrate`, `/seed`, `/db-reset`, `/commit-msg`, `/cleanup-todos`, `/consolidate-lessons` |
| `settings.json` (plugin entry)                           | Superpowers stays enabled                                                                                    |
| Memory system                                            | User preferences and feedback                                                                                |

## New CLAUDE.md Structure

Target: ~80 lines. Six sections:

### 1. Hard Rules (always active)

- Never create a git commit
- Commit messages as fenced code blocks
- All communication in German
- Clean up todo.md on task completion (move to Abgeschlossen)

### 2. Session Start

1. Read `.claude/docs/project-brief.md`
2. Check `.claude/tasks/todo.md` for open tasks
3. Read last 5 entries of `.claude/tasks/lessons.md`
4. Brief onboarding message in German (one line: open tasks or "all clear")

### 3. Project Context

- **Name:** Ringwerk | **Language:** de
- **Quality:** `/check` → runs via `docker compose -f docker-compose.dev.yml run --rm app` with npm run lint / format:check / test + tsc
- **Layer order:** Schema → Migration → Types → Queries → Actions → Calculate → Components → Page
- **Compliance rules** (inline):
  1. No native browser dialogs — use project dialog component
  2. No DropdownMenu — use inline icon buttons in list rows
  3. `rounded-lg border` requires `bg-card` (dark mode)
  4. Icon buttons minimum h-10 w-10 (not h-8 w-8)
  5. No bare `toLocaleDateString()` — use project date formatter

### 4. Docs (on-demand)

Same table as before — load only when needed:

| Key               | Path                               | Load when                   |
| ----------------- | ---------------------------------- | --------------------------- |
| `projectBrief`    | `.claude/docs/project-brief.md`    | Always (session start)      |
| `features`        | `.claude/docs/features.md`         | Clarifying feature scope    |
| `architecture`    | `.claude/docs/architecture.md`     | Routes, directory structure |
| `techStack`       | `.claude/docs/technical.md`        | Stack details               |
| `domainModel`     | `.claude/docs/data-model.md`       | Business logic, formulas    |
| `codeConventions` | `.claude/docs/code-conventions.md` | Writing code                |
| `uiPatterns`      | `.claude/docs/ui-patterns.md`      | Building UI                 |
| `referenceFiles`  | `.claude/docs/reference-files.md`  | Finding patterns            |

### 5. Superpowers Workflow

| Task type                  | Skills to use                                                     |
| -------------------------- | ----------------------------------------------------------------- |
| New feature / modification | `brainstorming` → `writing-plans` → `subagent-driven-development` |
| Bug                        | `systematic-debugging`                                            |
| Branch completion          | `finishing-a-development-branch`                                  |
| Requesting review          | `requesting-code-review`                                          |
| Receiving review           | `receiving-code-review`                                           |
| Parallel independent tasks | `dispatching-parallel-agents`                                     |

### 6. Commands Reference

`/check` · `/test` · `/migrate <name>` · `/seed` · `/db-reset` · `/commit-msg` · `/cleanup-todos` · `/consolidate-lessons`

---

## Migration Steps (for implementation plan)

1. Write new CLAUDE.md
2. Delete `pipeline.json`
3. Delete all files in `.claude/agents/`
4. Delete all files in `.claude/hooks/`
5. Update `settings.json` — remove hooks config, keep plugin entry
6. Create `.claude/docs/superpowers/` directory structure (for future specs/plans)
7. Verify: session start works, `/check` command works, superpowers skills load

## Success Criteria

- Session start gives brief German onboarding message
- `/check` runs all quality gates correctly
- Superpowers brainstorming/planning/executing skills work in this project
- No references to pipeline.json or custom agents remain
- All existing docs still accessible on-demand
- todo.md and lessons.md intact
