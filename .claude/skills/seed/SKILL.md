---
name: seed
description: Run Treffsicher's database seed manually. Usually unnecessary — Ringwerk and Treffsicher self-seed the first admin + default disciplines on first request, Spiegel creates its first admin at server start; use only after a full db-reset if needed.
---

```bash
pnpm --filter treffsicher exec prisma db seed
```

Only Treffsicher has a seed (`apps/treffsicher/prisma/seed.ts`: default disciplines). Ringwerk and
Treffsicher initialise the first admin account and default disciplines automatically on the first
request (startup init, `src/lib/startup.ts`); Spiegel creates its first admin at server start
(`src/instrumentation.ts`, from `SEED_ADMIN_*`). A manual seed is rarely needed.
