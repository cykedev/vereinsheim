# Context: Dev-Workflow (Monorepo)

On-demand module (ADR-018) — der kanonische Befehlssatz. Von Skills/Agenten bei Bedarf geladen,
damit die immer-aktive CLAUDE.md schlank bleibt.

```bash
corepack enable && pnpm install                   # einmalig
docker compose -f docker-compose.dev.yml up -d    # geteilter Dev-Postgres (DBs: ringwerk + treffsicher)
cp apps/<app>/.env.example apps/<app>/.env         # einmalig pro App
pnpm --filter <app> exec prisma db push           # Schema → Dev-DB

pnpm dev                       # beide Apps (ringwerk :3000, treffsicher :3001)
pnpm dev --filter ringwerk     # nur eine

pnpm check                     # alle 5 Gates (lint, format:check, test, tsc, next build) — turbo-gecacht
pnpm test  --filter <app>      # nur Tests
pnpm build                     # inkrementeller Build beider Apps
```

- `<app>` = `ringwerk` | `treffsicher`.
- Das `test`-Gate braucht den Dev-Postgres oben (ringwerk hat DB-Integrationstests).
- Build/Deploy laufen über die `vereinsheim`-CLI (`vereinsheim build` / `release`) aus dem Monorepo
  (`turbo prune`); Image-Namen/Tags + `compose.yml` unverändert.
- Schema-Migration: Skill **migrate**; DB zurücksetzen: Skill **db-reset**; Qualitätsgates: Skill **check**.
