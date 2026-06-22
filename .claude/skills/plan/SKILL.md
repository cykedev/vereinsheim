---
name: plan
description: Design an implementation plan for a non-trivial change and write it to plans/<date>-<topic>.md as the handoff artifact for /implement. Use at the start of any feature/refactor before writing code.
---

PIV step 1 of 4 (plan → implement → validate → review). For a non-trivial change:

1. Clarify intent; explore the relevant code (use the **codegraph** MCP — `codegraph_explore`
   / references / routes — instead of broad grep where possible) and the affected
   `apps/<app>/docs/*` + `docs/shared-conventions.md`.
2. Design the approach (reuse existing utils/patterns; name the critical files).
3. Write the plan to **`plans/YYYY-MM-DD-<topic>.md`** with: Context (why), Approach, the
   files to change, a `## Required Docs` list (which app/shared docs the implementer must read),
   explicit **test steps**, and a Verification section.
4. Propose a `feat/<topic>` branch and commit the plan as the **first commit** on it
   (project hard rule), before any implementation.

Superpowers brainstorming primitives may feed this step; the plan file is the shared handoff.
