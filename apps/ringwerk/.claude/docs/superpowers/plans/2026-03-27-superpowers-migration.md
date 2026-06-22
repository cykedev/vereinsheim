# Superpowers Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom 4-stage pipeline (CLAUDE.md + pipeline.json + custom agents + hooks) with superpowers skills as the workflow engine, while preserving all project docs, commands, quality gates, and task history.

**Architecture:** Delete pipeline.json, all custom agents, and all hooks. Rewrite CLAUDE.md as a slim, self-contained config file (~80 lines) that embeds hard rules, project context, compliance rules, docs table, and superpowers skill references. Update settings.json to remove hook registrations.

**Tech Stack:** Markdown (CLAUDE.md), JSON (settings.json), Bash (none after migration)

## Required Docs

Beyond the baseline, no additional docs required for this plan.

---

## File Structure

**Modified:**

- `.claude/CLAUDE.md` — complete rewrite (pipeline → superpowers)
- `.claude/settings.json` — remove hooks config, keep plugin entry

**Deleted:**

- `.claude/pipeline.json`
- `.claude/agents/action-audit.md`
- `.claude/agents/code-compliance.md`
- `.claude/agents/codebase-scout.md`
- `.claude/agents/docs-sync.md`
- `.claude/agents/feature-builder.md`
- `.claude/agents/impact-analyzer.md`
- `.claude/agents/lessons-check.md`
- `.claude/agents/schema-analyzer.md`
- `.claude/agents/test-writer.md`
- `.claude/hooks/code-compliance.sh`
- `.claude/hooks/schema-gate.sh`
- `.claude/hooks/completeness.sh`
- `.claude/hooks/session-init.sh`

**Preserved (no changes):**

- `.claude/docs/*` (all project docs)
- `.claude/tasks/todo.md`, `lessons.md`, `todo-archive.md`
- `.claude/commands/*` (all 8 commands)

---

### Task 1: Write new CLAUDE.md

**Files:**

- Modify: `.claude/CLAUDE.md` (complete rewrite)

- [ ] **Step 1: Replace CLAUDE.md with the new slim version**

Write the following content to `.claude/CLAUDE.md` (replacing everything):

```markdown
# Ringwerk — Claude Configuration

**Sprache:** Alle Kommunikation mit dem User auf Deutsch. Code, Commit-Messages und Agent-Prompts bleiben auf Englisch.

## Hard Rules (non-negotiable, always active)

1. **NEVER create a git commit.** The user commits manually. Not under any circumstances.
2. **Commit messages MUST be displayed as a fenced code block** so the user can copy them easily.
3. **todo.md must be cleaned up** — at the end of every task, completed items must be moved to `## Abgeschlossen` in `.claude/tasks/todo.md`.

---

## Session Start

1. Read `.claude/docs/project-brief.md`
2. Check `.claude/tasks/todo.md` — open tasks?
3. Read last 5 entries of `.claude/tasks/lessons.md`
4. Brief German onboarding message: "X offene Tasks" or "Alles klar"

---

## Project Context

- **Name:** Ringwerk
- **Quality command:** `/check` — runs via `docker compose -f docker-compose.dev.yml run --rm app`:
  - `npm run lint`
  - `npm run format:check`
  - `npm run test`
  - `npx tsc --noEmit`
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

| Key               | Path                               | Load when                   |
| ----------------- | ---------------------------------- | --------------------------- |
| `projectBrief`    | `.claude/docs/project-brief.md`    | Session start               |
| `features`        | `.claude/docs/features.md`         | Clarifying feature scope    |
| `architecture`    | `.claude/docs/architecture.md`     | Routes, directory structure |
| `techStack`       | `.claude/docs/technical.md`        | Stack details, deployment   |
| `domainModel`     | `.claude/docs/data-model.md`       | Business logic, formulas    |
| `codeConventions` | `.claude/docs/code-conventions.md` | Writing code                |
| `uiPatterns`      | `.claude/docs/ui-patterns.md`      | Building UI                 |
| `referenceFiles`  | `.claude/docs/reference-files.md`  | Finding patterns, templates |

---

## Superpowers Workflow

Use superpowers skills for all development work:

| Task type                  | Skill sequence                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| New feature / change       | `brainstorming` → `writing-plans` → `subagent-driven-development` |
| Bug                        | `systematic-debugging`                                            |
| Branch completion          | `finishing-a-development-branch`                                  |
| Parallel independent tasks | `dispatching-parallel-agents`                                     |
| Requesting review          | `requesting-code-review`                                          |
| Receiving review           | `receiving-code-review`                                           |

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
| `/cleanup-todos`       | Clean up todo.md                        |
| `/consolidate-lessons` | Compress lessons, promote rules to docs |
```

- [ ] **Step 2: Verify line count is reasonable**

Run: `wc -l .claude/CLAUDE.md`
Expected: output shows ~75-85 lines

- [ ] **Step 3: Verify all 5 compliance rules are present**

Run: `grep -c "No \|without\|minimum\|bare" .claude/CLAUDE.md`
Expected: 5

---

### Task 2: Delete pipeline.json and all custom agents

**Files:**

- Delete: `.claude/pipeline.json`
- Delete: `.claude/agents/` (all 9 files)

- [ ] **Step 1: Delete pipeline.json**

Run: `rm .claude/pipeline.json`

- [ ] **Step 2: Delete all custom agent files**

Run: `rm .claude/agents/action-audit.md .claude/agents/code-compliance.md .claude/agents/codebase-scout.md .claude/agents/docs-sync.md .claude/agents/feature-builder.md .claude/agents/impact-analyzer.md .claude/agents/lessons-check.md .claude/agents/schema-analyzer.md .claude/agents/test-writer.md`

- [ ] **Step 3: Verify both are gone**

Run: `ls .claude/pipeline.json 2>&1; ls .claude/agents/ 2>&1`
Expected: "No such file or directory" for pipeline.json; empty output or "No such file or directory" for agents/

---

### Task 3: Delete all hooks

**Files:**

- Delete: `.claude/hooks/code-compliance.sh`
- Delete: `.claude/hooks/schema-gate.sh`
- Delete: `.claude/hooks/completeness.sh`
- Delete: `.claude/hooks/session-init.sh`

- [ ] **Step 1: Delete all hook scripts**

Run: `rm .claude/hooks/code-compliance.sh .claude/hooks/schema-gate.sh .claude/hooks/completeness.sh .claude/hooks/session-init.sh`

- [ ] **Step 2: Verify hooks directory is empty**

Run: `ls .claude/hooks/`
Expected: empty output (no files listed)

---

### Task 4: Update settings.json

**Files:**

- Modify: `.claude/settings.json`

Current content:

```json
{
  "hooks": {
    "UserPromptSubmit": [...],
    "PreToolUse": [...],
    "Stop": [...]
  },
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  }
}
```

- [ ] **Step 1: Replace settings.json with hooks-free version**

Write the following content to `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  }
}
```

- [ ] **Step 2: Verify the file is valid JSON**

Run: `cat .claude/settings.json | python3 -m json.tool`
Expected: pretty-printed JSON with only the `enabledPlugins` key, no errors

---

### Task 5: Verify migration

No automated tests exist for Claude configuration. Verification is done by inspection.

- [ ] **Step 1: Confirm no references to pipeline.json remain in CLAUDE.md**

Run: `grep -i "pipeline" .claude/CLAUDE.md`
Expected: no output (zero matches)

- [ ] **Step 2: Confirm no references to custom agents remain in CLAUDE.md**

Run: `grep -E "feature-builder|test-writer|codebase-scout|impact-analyzer|docs-sync|lessons-check|action-audit|schema-analyzer|code-compliance" .claude/CLAUDE.md`
Expected: no output (zero matches)

- [ ] **Step 3: Confirm all project docs still exist**

Run: `ls .claude/docs/*.md`
Expected: lists architecture.md, code-conventions.md, data-model.md, features.md, project-brief.md, reference-files.md, technical.md, ui-patterns.md (and open-issues.md)

- [ ] **Step 4: Confirm all commands still exist**

Run: `ls .claude/commands/`
Expected: check.md, cleanup-todos.md, commit-msg.md, consolidate-lessons.md, db-reset.md, migrate.md, seed.md, test.md

- [ ] **Step 5: Confirm superpowers skill table is present in CLAUDE.md**

Run: `grep "brainstorming" .claude/CLAUDE.md`
Expected: line containing `brainstorming → writing-plans → subagent-driven-development`

- [ ] **Step 6: Generate commit message**

Run `/commit-msg` to generate the commit message for this migration.
Expected: fenced code block with a descriptive commit message covering the migration.
