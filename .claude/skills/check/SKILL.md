---
name: check
description: Run all 5 monorepo quality gates (lint, format:check, test, tsc, next build) across the affected apps and report which are green/red. Use before every commit, or when the user asks to check/verify/confirm the build is clean.
---

Run all gates from the repo root — turbo-cached, over both apps:

```bash
pnpm check
```

Per app this runs: `lint` (eslint src), `format:check` (prettier), `test` (vitest),
`check-types` (`tsc --noEmit`), `build` (`next build`). **`next build` is mandatory** —
it catches build-only errors (e.g. the Next rule that a `"use server"` file may only
export directly-declared async functions) that lint/tsc/test do **not** see.

The `test` gate needs the shared dev Postgres up (ringwerk has DB-integration tests):

```bash
docker compose -f docker-compose.dev.yml up -d
```

Scope to one app: `pnpm check --filter ringwerk` (or `treffsicher`).

Report concisely: which gates are green, which are red, and — if red — the relevant
error message(s). Suggest concrete fixes when the cause is clear.

**Dev-Server vorher stoppen.** Das Gate (`next build`) und ein laufender `next dev` teilen sich
`apps/<app>/.next`; der Build zerlegt dabei `.next/types/validator.ts` und `check-types` wird rot,
obwohl der Diff sauber ist (`TS2307 './routes.js'`). Nach einem abgebrochenen Build erst `.next`
räumen — bei **gestopptem** Server, sonst verliert der Dev-Server sein `.next/dev` und antwortet bis
zum Neustart mit `Cannot read properties of undefined (reading 'call')`.
Siehe `vault/incidents/next-dist-dir-shared-with-dev-server.md`.
