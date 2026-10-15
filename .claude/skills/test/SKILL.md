---
name: test
description: Run only the test suite (vitest) — no lint, format, tsc, or build. Use for quick test feedback. Optionally scope to one app.
---

```bash
pnpm test                      # all apps and packages (turbo-cached)
pnpm test --filter ringwerk    # one app (or treffsicher, spiegel, spiegel-bridge, a package)
```

Needs the shared dev Postgres up for the DB-integration tests of Ringwerk and Spiegel:
`docker compose -f docker-compose.dev.yml up -d`.

For the full pre-commit suite (lint/format/tsc/build too), use **check** instead.
