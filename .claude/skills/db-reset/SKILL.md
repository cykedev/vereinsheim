---
name: db-reset
description: Fully reset the dev databases of Ringwerk and Spiegel (ALL their dev data is lost) — drop + recreate both and re-apply the schema; the treffsicher dev DB stays. Use only when explicitly asked to reset the dev DB.
---

Resets the dev DBs `ringwerk` and `spiegel` in the shared dev Postgres. ALL their dev data is lost:

```bash
docker compose -f docker-compose.dev.yml up -d
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
for app in ringwerk spiegel; do
  docker compose -f docker-compose.dev.yml exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "DROP DATABASE IF EXISTS $app WITH (FORCE);" -c "CREATE DATABASE $app OWNER $app;" \
    -c "REVOKE ALL ON DATABASE $app FROM PUBLIC;"
done
pnpm --filter ringwerk exec prisma db push   # schema → ringwerk dev DB
pnpm --filter spiegel  exec prisma db push   # schema → spiegel dev DB
```

The dev DB `treffsicher` is **not** reset: Treffsicher has no code any more (ADR-033, stage 5), and the DB is a prod
copy that the account transfer reads in dev until the deletion date (1 February 2027). Never drop the volume
(`down -v`) for a reset, that would lose it too.

The same schema push runs in `./scripts/vereinsheim dev-setup` (`scripts/bootstrap-dev.sh`).
First app request re-initialises admin + default disciplines (startup init; Spiegel creates its
admin at server start). For **prod data** instead of an empty DB, restore a backup with
`pg_restore` from `backups/*.dump`.
