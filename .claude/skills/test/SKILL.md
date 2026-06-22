---
name: test
description: Run only the test suite (vitest) — no lint, format, tsc, or build. Use for quick test feedback. Optionally scope to one app.
---

```bash
pnpm test                      # both apps (turbo-cached)
pnpm test --filter ringwerk    # one app (or treffsicher)
```

Needs the shared dev Postgres up for ringwerk's DB-integration tests:
`docker compose -f docker-compose.dev.yml up -d`.

For the full pre-commit suite (lint/format/tsc/build too), use **check** instead.
