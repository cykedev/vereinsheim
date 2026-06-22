---
name: debug
description: Root-cause a bug, test failure, or unexpected behavior before proposing a fix. Use whenever something is broken — instead of guessing at patches.
---

Systematic debugging. **No fix without a root cause first** — symptom patches waste time and
add bugs. Work the phases in order; don't jump to a fix.

1. **Root cause.** Read the error / stack trace fully (line, file, code). Reproduce reliably.
   Check recent changes (`git diff`, recent commits). For a multi-layer path, add diagnostic
   logging at each boundary and run once to see *where* it breaks. Use the **codegraph** MCP
   (`codegraph_explore` / callers / references) to trace the bad value back to its source.
2. **Pattern.** Find a working example of the same thing in the repo; list every difference
   between working and broken. Don't assume "that can't matter".
3. **Hypothesis.** State one specific cause ("X because Y"). Test it with the **smallest**
   possible change, one variable at a time. Wrong? Form a new hypothesis — don't stack fixes.
4. **Fix.** Write a **failing test that reproduces the bug first** (TDD), then fix the root
   cause only — no "while I'm here" changes. Verify the test passes and nothing else broke.

**If 3+ fixes have failed**, stop fixing and question the architecture/assumptions with the
user — that pattern means the design is wrong, not the latest hypothesis.

Hand the verified fix to **/implement** conventions (one focused commit, test included) and
**/validate** (gates green + behavior confirmed). Never claim fixed without fresh evidence.
