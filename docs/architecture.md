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
│                           useUnsavedChangesGuard, useNavigationConfirm (Phase 4/Zyklus 1).
├── packages/ui/            @vereinsheim/ui — geteilte UI-Schicht: 17 ui-Primitives + 4 shell/ +
│                           theme.css (Tailwind-Theme + @source). Phase 4/Zyklus 2 — Drift-Gate ~entfällt.
├── docs/                   spec, decisions (ADRs), monorepo-plan, operations, plan,
│                           architecture (dies), shared-conventions, consistency
├── .claude/                Harness: settings(+hooks), skills/, agents/, context/, knowledge-graph.json
├── .mcp.json               codegraph + memory MCP (Knowledge-Graph, ADR-016)
├── compose.yml + Caddyfile + db-init/        Prod-Deploy-Vertrag (VPS, unverändert)
├── docker-compose.dev.yml  geteilter Dev-Postgres (DBs: ringwerk + treffsicher)
├── Dockerfile              EIN parametrisiertes Build-File (turbo prune, --build-arg APP)
├── scripts/bootstrap-dev.sh  Dev-Onboarding: frische Workstation arbeitsfähig (Toolchain, codegraph, Dev-DB, .env, Schema; idempotent)
└── scripts/vereinsheim     Ops-CLI (dev-setup/build/release/deploy/backup/restore/…)
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
(Release-Gate). Das echte Code-Teilen (`packages/ui`/`lib`) ist seit **Phase 4** umgesetzt → das Gate
deckt nur noch triviale Next/shadcn-Reste ([monorepo-plan.md](monorepo-plan.md)).

## Knowledge & Harness (ADR-016/017/018/022/023/024)

- **CodeGraph-MCP** (`.mcp.json`): Live-Symbol-/Call-Graph/Routen, on-demand (Ground Truth über den Code).
- **Memory-MCP = gebauter Doku-Index** (`.mcp.json`, Store `.claude/knowledge-graph.json`, **ADR-022**):
  deterministisch gebaut (`.claude/build-graph.mjs`) aus drei Quellen — `docs/decisions.md` (ADRs geparst),
  `.claude/graph-projection.mjs` (kuratiertes Manifest), `.claude/graph-captured.mjs` (Incidents/State). Jede
  Entity = Essenz + Fragment-Pointer `→ datei#slug`; gezieltes Lesen via `node .claude/doc.mjs datei#slug`.
  Pflege: `/sync-graph` (Docs→Manifest, modellgetrieben) + `/consolidate-lessons` REMEMBER (Captured). Bei
  SessionStart via `memory-surface.mjs` gesurface't. **Store ist Artefakt — nie von Hand editieren.**
  Maschinen-/ops-lokales → natives Auto-Memory.
- **CLAUDE.md-Hierarchie:** Root (universelle Regeln, @import) → `apps/<app>/CLAUDE.md` (scope-spezifisch).
- **Skills/Hooks/Agents** unter `.claude/`: ein Satz für beide Apps; Stop-Gate erzwingt grüne `pnpm check`,
  Stop-Graph-Sync (`graph-sync.mjs`) baut den Doku-Index am Turn-Ende und blockt bei invalidem Index (ADR-022).
  Die PIV-Implement-Phase läuft **autonom-by-default** (ADR-023): `/implement` grindet den freigegebenen
  Plan task-by-task, der marker-gated `autopilot-guard`-Hook erzwingt dabei hart die geschützten
  Pfade/Kommandos; Plan-Freigabe + Merge bleiben user-gated. Die Worktree-Wahl trifft die **Hauptsession
  vorab** (ADR-024) — die Skills erstellen/erzwingen keinen Worktree, das Preflight prüft nur den
  `feat/`-Branch.
