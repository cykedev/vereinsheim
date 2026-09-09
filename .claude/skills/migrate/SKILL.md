---
name: migrate
description: Create a new Prisma schema migration for an app after a schema change. Use when the user asks to migrate, or after editing apps/<app>/prisma/schema.prisma.
---

After a schema change in `apps/<app>/prisma/schema.prisma`, create + commit a migration
(`<app>` = `ringwerk` or `treffsicher`):

```bash
pnpm --filter <app> exec prisma migrate dev --name <descriptive-name>
```

- Needs the shared dev Postgres up (`docker compose -f docker-compose.dev.yml up -d`).
- Needs `CREATEDB` on the dev roles — `migrate dev` creates a temporary shadow database per
  migration and fails with **P3014** without it. `scripts/bootstrap-dev.sh` grants it
  idempotently; run that script if you hit P3014. Prod migrates via `migrate deploy` and
  deliberately gets no such grant (see `vault/incidents/dev-shadow-db-createdb.md`).
- Commit the generated `apps/<app>/prisma/migrations/**` **together with** the schema change.
- Migrations are append-only history — never edit an already-applied migration; add a new one.
