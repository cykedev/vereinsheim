Analyze current workspace changes and create an appropriate commit message.

Steps:

1. Run `git diff --staged`. If empty, run `git diff HEAD` to see all uncommitted changes.
2. Run `git status` to see new (untracked) files.
3. Analyze the changes: what was changed, added, or removed? What is the purpose?
4. Output **only** the finished commit message — no explanatory text around it.

## Commit Message Rules

**Format:**

```
type: short imperative summary

- Bullet point describing what and why
- Another bullet point if needed
```

**Types:**

- `feat` — new functionality
- `fix` — bug fix
- `refactor` — restructuring without behavior change
- `style` — formatting, no logic change
- `docs` — documentation only
- `chore` — build, dependencies, configuration
- `test` — adding or changing tests
- `perf` — performance improvement

**Rules:**

- All English
- First line: imperative, no period, max 72 characters
- Bullet points with `-`, describe WHAT changed and WHY
- No "various changes", "updates", "fixes" without context
- For multiple independent areas: choose the dominant type and cover all areas in bullets
- No Co-Authored-By line
