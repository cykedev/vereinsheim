Run all quality gates and report the result.

Runner: `docker compose -f docker-compose.dev.yml run --rm app`

Gates (run ALL, even if one fails):

1. `npm run lint`
2. `npm run format:check`
3. `npm run test`
4. `npx tsc --noEmit`
5. `npm run build`

Gate 5 (`next build`) is mandatory: it catches build-only errors that `lint`/`tsc`/`test` do **not** — e.g. the Next.js rule that a `"use server"` file may only export directly-declared async functions (no re-exports/barrels). Required especially for any change touching Server Actions.

Report concisely: which gates are green, which are red, and if red: the relevant error messages. Suggest concrete fixes if the cause is clear.
