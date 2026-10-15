---
name: db-reset
description: Fully reset the shared dev database (ALL dev data is lost) — drop + recreate all three dev DBs (ringwerk, treffsicher, spiegel) and re-apply the schema. Use only when explicitly asked to reset the dev DB.
---

Resets the **shared** dev Postgres — affects ALL three dev DBs (`ringwerk`, `treffsicher`, `spiegel`):

```bash
docker compose -f docker-compose.dev.yml down -v   # drop the volume — ALL dev data lost!
docker compose -f docker-compose.dev.yml up -d     # recreate; dev/db-init makes all three DBs
pnpm --filter ringwerk    exec prisma db push      # schema → ringwerk dev DB
pnpm --filter treffsicher exec prisma db push      # schema → treffsicher dev DB
pnpm --filter spiegel     exec prisma db push      # schema → spiegel dev DB
```

The same schema push runs in `./scripts/vereinsheim dev-setup` (`scripts/bootstrap-dev.sh`).
First app request re-initialises admin + default disciplines (startup init; Spiegel creates its
admin at server start). For **prod data** instead of an empty DB, restore a backup with
`pg_restore` from `backups/*.dump`.
