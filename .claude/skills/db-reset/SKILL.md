---
name: db-reset
description: Fully reset the shared dev database (ALL dev data is lost) — drop + recreate both dev DBs and re-apply the schema. Use only when explicitly asked to reset the dev DB.
---

Resets the **shared** dev Postgres — affects BOTH dev DBs (`ringwerk` + `treffsicher`):

```bash
docker compose -f docker-compose.dev.yml down -v   # drop the volume — ALL dev data lost!
docker compose -f docker-compose.dev.yml up -d     # recreate; db-init makes both DBs
pnpm --filter ringwerk    exec prisma db push      # schema → ringwerk dev DB
pnpm --filter treffsicher exec prisma db push      # schema → treffsicher dev DB
```

First app request re-initialises admin + default disciplines (startup init). For **prod
data** instead of an empty DB, restore a backup with `pg_restore` from `backups/*.dump`.
