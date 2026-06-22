---
name: plan
description: Design an implementation plan for a non-trivial change and write it to plans/<date>-<topic>.md as the handoff artifact for /implement. Use at the start of any feature/refactor before writing code.
---

PIV step 1 of 4 (plan → implement → validate → review). For a non-trivial change:

0. **If the scope is fuzzy, brainstorm first** — don't plan a half-understood idea. Ask
   clarifying questions **one at a time** (purpose, constraints, success criteria); propose
   **2-3 approaches** with trade-offs + your recommendation; present the design and get the
   user's OK **before** writing the plan. Skip only when the scope is already clear.
1. Clarify intent; explore the relevant code (use the **codegraph** MCP — `codegraph_explore`
   / references / routes — instead of broad grep where possible) and the affected
   `apps/<app>/docs/*` + `docs/shared-conventions.md`.
2. Design the approach (reuse existing utils/patterns; name the critical files). Map the files
   first, then decompose into **bite-sized tasks** (each a few minutes, self-contained).
3. Write the plan to **`plans/YYYY-MM-DD-<topic>.md`** with: Context (why), Approach, the
   files to change, a `## Required Docs` list (which app/shared docs the implementer must read),
   explicit **test steps**, and a Verification section. **No placeholders** — every step concrete
   (no "TBD" / "handle errors" / "add validation"; show the actual change or command).
4. **Self-review** the plan against the scope: does every requirement have a task? any
   placeholders left? do names/types in later tasks match earlier ones? Fix inline.
5. Propose a `feat/<topic>` branch and commit the plan as the **first commit** on it
   (project hard rule), then **lay the plan before the user** — before any implementation.
