---
id: architecture
type: guide
title: "Architektur — High-Level-Karte"
aliases: ["Architektur — High-Level-Karte"]
keywords: [architektur, high-level-karte, repo-karte, monorepo, apps, pakete, routen, build, deploy]
part_of: ["[[overview]]"]
---

**TL;DR** Hand-gepflegte Orientierung über das Monorepo: drei Next.js-Apps, eine Go-Brücke, geteilte Pakete, ein VPS. Die Detail-Architektur je App steht im Vault (`vault/apps/<app>/`, `vault/spiegel/`); den lebenden Symbol- und Call-Graph liefert der CodeGraph-MCP.

# Architektur — High-Level-Karte

Hand-gepflegte Orientierung über das Monorepo (ADR-016). Die **Detail**-Architektur je App steht im Vault
(`vault/apps/ringwerk/`, `vault/apps/treffsicher/`, `vault/spiegel/`); den **lebenden** Symbol-/Call-Graph liefert der
CodeGraph-MCP (`codegraph_explore`). Diese Datei ist die schnelle Karte, kein Vollindex.

## Repo-Karte

```
vereinsheim/                Code- + Deployment-Monorepo (pnpm + Turborepo)
├── apps/ringwerk/          Liga & Wettkämpfe (Next.js 16, Prisma 7, NextAuth v4)  → :3000
├── apps/treffsicher/       Trainings-App      (Next.js 16, Prisma 7, NextAuth v4)  → :3001
├── apps/spiegel/           Schussrohdaten aus Meyton (Next.js 16, Prisma 7, NextAuth v4)  → :3002: Rohdaten als
│                           Zeilenversionen, Revisionen und Projektion je Scheibe (ADR-031); Start, Scheiben, Seite einer
│                           Scheibe, Fortschritt, Profil, Admin; Übersichten rechnen auf dem Server aus der Projektion;
│                           Ingest-API v1 für die Brücke (Kopplung, Geräte-Token, Adapter `meyton-ssmdb2@10`).
├── apps/spiegel-bridge/    Brücke im Schützenhaus (Go, ein statisches Binary, ADR-027): liest die SSMDB2 nur lesend,
│                           erkennt Änderungen, baut Snapshots v1 und lädt sie hoch; Dienst für systemd (`deploy/`).
├── packages/config/        @vereinsheim/config — geteilte Tooling-Configs: tsconfig, eslint, prettier, postcss, next,
│                           vitest.
├── packages/lib/           @vereinsheim/lib — geteilte Utils + Form-Hooks: cn, forms/fieldErrors, useUnsavedChangesGuard,
│                           useNavigationConfirm, dateTime (server-only), format (isomorph, Locale de-DE, Zeitzone als
│                           Parameter) und der Auth-Kern (Validierung, Anmeldeablauf, IP aus Proxy-Headern,
│                           Ratenbegrenzung mit Store und Admin-Auswertung) für alle drei Apps.
├── packages/ui/            @vereinsheim/ui — ui-Primitives, shell/, admin/ (Rate-Limit-Oberfläche) und
│                           design2.css + design2/* (ADR-030, ADR-032) für alle Apps: Tokens mit Akzent je
│                           App, Darstellung, Rahmen, Seite, Folgen-Dialog, Rückgängig, Hilfe, Toasts, Trefferfarben.
├── packages/shot-core/     @vereinsheim/shot-core — Fachkern von Spiegel: Scheibenbilder, Wertung wie Meyton,
│                           Disziplinen, Gegenprobe, Geometrie, Kennzahlen-Registry, Analyse einer Scheibe, Projektion
│                           je Scheibe (`./projection`).
├── packages/shot-ui/       @vereinsheim/shot-ui — Bausteine von Spiegel als React-Komponenten: Scheibe, Serien,
│                           Kennzahl-Kacheln, Ablesung, Schusstabelle, Analyse in sechs Reitern, Seite eines Zeitraums,
│                           Adressen (`nav`), Scheiben-Liste (`list`), Rahmen der App (`AppFrame`), Start (`start`).
├── packages/shot-help/     @vereinsheim/shot-help — Hilfe zu jeder Kennzahl in einfacher Sprache; Quelle für App und
│                           Vault-Leitfaden (`pnpm --filter @vereinsheim/shot-help docs`).
├── packages/ingest-contract/ @vereinsheim/ingest-contract — Vertrag Brücke ↔ Spiegel: Snapshot v1 (Zod, daraus
│                           JSON-Schema), Prüfsumme über RFC 8785, Testvektoren, eingefrorene Beispiele, API v1.
├── packages/ssmdb2-cases/  @vereinsheim/ssmdb2-cases — Sonderfall-Testdaten: echtes SSMDB2-Schema, Baukasten, der wie
│                           Meyton schreibt, Fälle mit Snapshots v1 unter `cases/v1`; `replay` spielt sie in MariaDB ab.
├── packages/pruefen/       @vereinsheim/pruefen — Skriptprüfung im Browser für alle Apps: Chrome über das
│                           DevTools-Protokoll, eigener Build als Server, gemeinsame Prüfungen, PDF als Text und Bilder.
├── packages/meyton-pdf/    @vereinsheim/meyton-pdf — liest aus Meyton-Ausdrucken (PDF) ID im Fuß und Erstellzeit;
│                           Spiegel nutzt `printout-id` für „Scheibe holen“ und liest Ausdrucke im
│                           Kindprozess (`printout-reader.mjs`).
├── tools/ssmdb2-erkunden/  Erkundung der Meyton-SSMDB2 vor Ort: Checkliste, Kopie, Schießprotokoll; nur lesend.
├── tools/stack-e2e/        der ganze Stack lokal Ende zu Ende mit den echten Images, samt Brücke und Last.
├── vault/                  Doku als Obsidian-Vault = Memory-Graph (ADR-025): overview, decisions (ADRs), architecture,
│                           operations, apps/<app>, spiegel, meyton, incidents, conventions.md, SCHEMA.md
├── plans/                  offene Pläne (PIV-Handoff); reports/ lokal, gitignored
├── .claude/                Harness: settings (+hooks), skills/, agents/, vault-loader/-lint, Suche
├── .mcp.json               codegraph + memory MCP
├── compose.yml + Caddyfile + db-init/   Prod-Deploy-Vertrag (VPS): drei Apps, drei DBs
├── compose.local.yml       Override für den Prod-Stack auf der lokalen Maschine (`local-up`)
├── docker-compose.dev.yml  geteilter Dev-Postgres (DBs: ringwerk, treffsicher, spiegel)
├── Dockerfile              EIN parametrisiertes Build-File (turbo prune, --build-arg APP)
└── scripts/                Ops-CLI `vereinsheim` und die Skripte, die es aufruft (Apps in `lib/apps.sh`;
                            `bootstrap-dev.sh` für `dev-setup`, `db-ensure.sh`, Backup, Restore, Deploy)
```

## Build & Deploy (ADR-005/006/007/015)

Lokaler Build aus dem Monorepo: `vereinsheim build` → `turbo prune <app> --docker` → Root-`Dockerfile`
(deps→builder→runner/migrator) → Docker Hub (`<user>/<app>:<sha>` + `:<sha>-migrator` + `:latest*`). Der VPS pullt;
`compose.yml` startet pro App `migrate-*` (one-shot `prisma migrate deploy`) **vor** `app-*` (Next standalone,
`node server.js`), die Apps nacheinander. Caddy terminiert TLS und proxyt die drei Subdomains. Grenzen: Ringwerk und
Treffsicher 256 MB (Heap 160), Spiegel 320 MB (Heap 160, die Luft darüber für den Leser der Ausdrucke), Migratoren
192 MB, Caddy 96 MB, Postgres 384 MB ([[vps-resource-sizing]]). Lokal prüft `tools/stack-e2e/run.sh` den ganzen Stack
mit den echten Images, bevor etwas auf den VPS geht.

```
Internet ──443──> Caddy ─┬─ ringwerk.<domain>    → app-ringwerk:3000
                         ├─ treffsicher.<domain> → app-treffsicher:3000
                         └─ spiegel.<domain>     → app-spiegel:3000   (max. 5 MiB je Anfrage)
Netze: web {caddy, app-*}   data {db, app-*, migrate-*}   (db NICHT im web-Netz, ADR-003)
DB: 1 Postgres, 3 DBs + 3 Owner-User (ringwerk, treffsicher, spiegel), Cross-DB technisch unmöglich (ADR-002)

Schützenhaus: Meyton-Server (SSMDB2) ←nur lesend── Brücke ──HTTPS, nur ausgehend──> spiegel.<domain>/api/ingest/v1
```

## Routen (Überblick)

- **ringwerk:** `/` · `/competitions/[id]{/schedule,/standings,/ranking,/playoffs}` · `/participants` ·
  `/disciplines` · `/admin` · `/account` · `/api/public/c/[slug]/pdf` (öffentlich).
- **treffsicher:** `/` → `/dashboard` · `/sessions{/[id]{/edit,/export/pdf},/new}` · `/shot-routines` · `/statistics` · `/goals` ·
  `/disciplines` · `/admin` · `/profile` (`/account` leitet weiter; alles auth-gated, Design 2 hell und dunkel).
- **spiegel:** `/` (Start) · `/cards{/[id]}` · `/progress` · `/open` · `/profile{/trash}` · `/admin{/users,/disciplines,/site}` ·
  `/share/[shareId]` (geteilte Scheibe, ohne Anmeldung) · `/api/ingest/v1/{pair,state,snapshots,heartbeat}` (Brücke,
  Geräte-Token).

Detail (Komponenten, lib-Module, Datenfluss): die App-Notes im Vault und die `CLAUDE.md` je App.

## Cross-App-Konsistenz

Alle drei Apps laufen auf Design 2 (ADR-030, ADR-032) und teilen die UI-/Pattern-Schicht über `@vereinsheim/ui`,
`@vereinsheim/lib` und `@vereinsheim/config`. **Single Source der Konventionen:** [[conventions]]. Den Rest
(`components.json`, `globals.css`-Stub, Error-Boundaries, den Wrapper der Rate-Limit-Oberfläche) und die Regeln von
Design 2 erzwingt `scripts/consistency-check.sh` als Release-Gate über alle drei Apps ([[drift-protection]]).

## Knowledge & Harness (ADR-016/017/018/023/024/025)

- **CodeGraph-MCP** (`.mcp.json`): Live-Symbol-/Call-Graph/Routen, on-demand (Ground Truth über den Code).
- **Memory-MCP = der Vault** ([[adr-025]]): `vault-loader.mjs` liest die Notes direkt, ohne Build und ohne Store;
  Suche über BM25 (`search-index.mjs`), Abschnitte über `document_map`/`section_read`. `vault-lint.mjs` prüft Schema,
  Anker und Orphans. Pflege: Notes direkt editieren, `/sync-graph`, `/consolidate-lessons` (REMEMBER →
  `vault/incidents/`). Bei SessionStart via `memory-surface.mjs` gesurface't. Maschinen-/ops-lokales → natives
  Auto-Memory.
- **CLAUDE.md-Hierarchie:** Root (universelle Regeln, @import) → `apps/<app>/CLAUDE.md` und `packages/<pkg>/CLAUDE.md`
  (scope-spezifisch).
- **Skills/Hooks/Agents** unter `.claude/`: ein Satz für alle Apps; das Stop-Gate erzwingt grüne `pnpm check`, der
  Stop-Graph-Sync (`graph-sync.mjs`) blockt bei invalidem Vault. Die PIV-Implement-Phase läuft **autonom-by-default**
  (ADR-023): `/implement` arbeitet den freigegebenen Plan task-by-task ab, der marker-gated `autopilot-guard`-Hook
  erzwingt dabei hart die geschützten Pfade/Kommandos; Plan-Freigabe + Merge bleiben user-gated. Die Worktree-Wahl trifft
  die **Hauptsession vorab** (ADR-024); das Preflight prüft nur den `feat/`-Branch.
