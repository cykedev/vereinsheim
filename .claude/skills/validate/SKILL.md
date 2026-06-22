---
name: validate
description: Verify an implementation actually works — run all gates and check real behavior — and write a short report to reports/<date>-<topic>.md. Use after /implement, before /review.
---

PIV step 3 of 4. Validate the change end-to-end. **Evidence before claims**: never write
"done / passing / fixed" without fresh verification output from *this* run — confidence is not
evidence.

1. **Gates:** `pnpm check` → all 5 green (dev Postgres up). Fix anything red.
2. **Behavior:** actually run it — `pnpm dev --filter <app>` and exercise the changed path
   (curl / login / the specific feature), not just unit tests. Confirm the plan's explicit test
   steps pass.
3. Write **`reports/YYYY-MM-DD-<topic>.md`**: what was verified, the gate output, behavior
   checks, anything still open. Every claim in the report must be backed by output you saw.

If something fails, loop back to **/implement**. When green + behavior confirmed, go to **/review**.
