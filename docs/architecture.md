# Architektur — High-Level-Karte

Hand-gepflegte Orientierung über das Monorepo (ADR-016, Schicht 1-Ergänzung). Die **Detail**-Architektur
je App steht in `apps/<app>/docs/architecture.md`; den **lebenden** Symbol-/Call-Graph liefert der
CodeGraph-MCP (`codegraph_explore`). Diese Datei ist die schnelle Karte, kein Vollindex.

## Repo-Karte

```
vereinsheim/                Code- + Deployment-Monorepo (pnpm + Turborepo)
├── apps/ringwerk/          Liga & Wettkämpfe (Next.js 16, Prisma 7, NextAuth v4)  → :3000
├── apps/treffsicher/       Trainings-App      (Next.js 16, Prisma 7, NextAuth v4)  → :3001
├── packages/config/        @vereinsheim/config — geteilte Tooling-Configs: tsconfig/eslint/prettier/
│                           postcss/next (Phase 2).
├── packages/lib/           @vereinsheim/lib — geteilte Utils + Form-Hooks: cn (utils), forms/fieldErrors,
│                           useUnsavedChangesGuard, useNavigationConfirm (Phase 4/Zyklus 1). ui → Zyklus 2.
├── docs/                   spec, decisions (ADRs), monorepo-plan, operations, plan,
│                           architecture (dies), shared-conventions, consistency
├── .claude/                Harness: settings(+hooks), skills/, agents/, context/, knowledge-graph.json
├── .mcp.json               codegraph + memory MCP (Knowledge-Graph, ADR-016)
├── compose.yml + Caddyfile + db-init/        Prod-Deploy-Vertrag (VPS, unverändert)
├── docker-compose.dev.yml  geteilter Dev-Postgres (DBs: ringwerk + treffsicher)
├── Dockerfile              EIN parametrisiertes Build-File (turbo prune, --build-arg APP)
└── scripts/vereinsheim     Ops-CLI (build/release/deploy/backup/restore/…)
```

## Build & Deploy (ADR-005/006/007/015)

Lokaler Build aus dem Monorepo: `vereinsheim build` → `turbo prune <app> --docker` → Root-`Dockerfile`
(deps→builder→runner/migrator) → Docker Hub (`<user>/<app>:<sha>` + `:<sha>-migrator` + `:latest*`).
Der VPS pullt; `compose.yml` startet pro App `migrate-*` (one-shot `prisma migrate deploy`) **vor**
`app-*` (Next standalone, `node server.js`). Caddy terminiert TLS und proxyt die zwei Subdomains.

```
Internet ──443──> Caddy ─┬─ ringwerk.<domain>    → app-ringwerk:3000
                         └─ treffsicher.<domain> → app-treffsicher:3000
Netze: web {caddy, app-*}   data {db, app-*, migrate-*}   (db NICHT im web-Netz, ADR-003)
DB: 1 Postgres, 2 DBs + 2 Owner-User (ringwerk, treffsicher), Cross-DB technisch unmöglich (ADR-002)
```

## Routen (Überblick)

- **ringwerk:** `/` · `/competitions/[id]{/schedule,/standings,/ranking,/playoffs}` · `/participants` ·
  `/disciplines` · `/admin` · `/account` · `/api/public/c/[slug]/pdf` (öffentlich).
- **treffsicher:** `/` · `/sessions{/[id]{/edit,/export/pdf},/new}` · `/shot-routines` · `/statistics` ·
  `/disciplines` · `/account` (alles auth-gated, Dark-Mode-only).

Detail (Komponenten, lib-Module, Datenfluss): je `apps/<app>/docs/architecture.md`.

## Cross-App-Konsistenz

Beide Apps teilen eine bewusst byte-identische UI-/Pattern-Schicht. **Single Source der Konventionen:**
`docs/shared-conventions.md`. UI-/Config-Drift zwischen den Apps erzwingt `scripts/consistency-check.sh`
(Release-Gate). Das echte Code-Teilen (`packages/ui`/`lib`, dann entfällt das Gate) ist **Phase 4**
([monorepo-plan.md](monorepo-plan.md)).

## Knowledge & Harness (ADR-016/017/018)

- **CodeGraph-MCP** (`.mcp.json`): Live-Symbol-/Call-Graph/Routen, on-demand (Ground Truth).
- **Memory-MCP** (`.mcp.json`, Store `.claude/knowledge-graph.json`): Cross-Session-Projektgedächtnis,
  bei SessionStart via `memory-surface.mjs`-Hook gesurface't, beschrieben über `/consolidate-lessons`
  REMEMBER (Incident/Provenance/Zustand, ADR-017/021). Maschinen-/ops-lokales → natives Auto-Memory.
- **CLAUDE.md-Hierarchie:** Root (universelle Regeln, @import) → `apps/<app>/CLAUDE.md` (scope-spezifisch).
- **Skills/Hooks/Agents** unter `.claude/`: ein Satz für beide Apps; Stop-Gate erzwingt grüne `pnpm check`.
