---
id: architecture
type: guide
title: "Architektur — High-Level-Karte"
aliases: ["Architektur — High-Level-Karte"]
keywords: [architektur, high-level-karte]
part_of: ["[[overview]]"]
---

**TL;DR** Hand-gepflegte Orientierung über das Monorepo (ADR-016, Schicht 1-Ergänzung). Die **Detail**-Architektur

# Architektur — High-Level-Karte

Hand-gepflegte Orientierung über das Monorepo (ADR-016, Schicht 1-Ergänzung). Die **Detail**-Architektur
je App steht in `apps/<app>/docs/architecture.md`; den **lebenden** Symbol-/Call-Graph liefert der
CodeGraph-MCP (`codegraph_explore`). Diese Datei ist die schnelle Karte, kein Vollindex.

## Repo-Karte

```
vereinsheim/                Code- + Deployment-Monorepo (pnpm + Turborepo)
├── apps/ringwerk/          Liga & Wettkämpfe (Next.js 16, Prisma 7, NextAuth v4)  → :3000
├── apps/treffsicher/       Trainings-App      (Next.js 16, Prisma 7, NextAuth v4)  → :3001
├── apps/spiegel/           Schussrohdaten aus Meyton (Next.js 16, Prisma 7, NextAuth v4)  → :3002; Schema,
│                           Zugriffe und Projektion (SP-1.6 a, ADR-031), Anmeldung und Konten, Start, Scheiben,
│                           Seite einer Scheibe, Fortschritt und Profil aus shot-ui (N7); Start, Liste, Fortschritt
│                           und Blättern rechnen auf dem Server aus der Projektion (SP-1.8); Ingest-API v1 für die Brücke
│                           mit Kopplung, Geräte-Token, Adapter `meyton-ssmdb2@9` und Admin „Anlage und Brücken“
│                           (SP-1.6 b); noch ohne Deploy (SP-1.9).
├── packages/config/        @vereinsheim/config — geteilte Tooling-Configs: tsconfig/eslint/prettier/
│                           postcss/next (Phase 2).
├── packages/lib/           @vereinsheim/lib — geteilte Utils + Form-Hooks: cn (utils), forms/fieldErrors
│                           (+ getErrorMessage), useUnsavedChangesGuard, useNavigationConfirm
│                           (Phase 4/Zyklus 1); dateTime (server-only) + format (isomorph, Locale de-DE,
│                           Zeitzone als Parameter) sowie der Auth-Kern auth/validation +
│                           auth/rate-limit/* (September 2026); Anmeldeablauf, IP aus Proxy-Headern, Store
│                           und Admin-Auswertung der Sperren für alle drei Apps (Oktober 2026).
├── packages/ui/            @vereinsheim/ui — geteilte UI-Schicht: ui-Primitives (inkl. table + skeleton)
│                           + 4 shell/ + admin/ (Login-Rate-Limit-Oberfläche) + theme.css (Tailwind-Theme,
│                           semantische Tokens success/warning/info/rank-1..3, App-Akzent via data-app).
├── packages/shot-core/     @vereinsheim/shot-core — Spiegel-Fachkern: Scheibenbilder, Wertung wie Meyton,
│                           Disziplinen, Gegenprobe (SP-1.1), Geometrie und Kennzahlen-Registry (SP-1.2),
│                           Analyse einer Scheibe (SP-1.10), Projektion je Scheibe für die Datenbank
│                           (`./projection`, SP-1.6 a); die Projektion nutzt apps/spiegel.
├── packages/meyton-pdf/    @vereinsheim/meyton-pdf — liest aus Meyton-Ausdrucken (PDF) nur ID im Fuß und
│                           Erstellzeit, ohne Layout-Wissen (SP-1.3, Oktober 2026); noch von keiner App genutzt.
├── packages/ingest-contract/ @vereinsheim/ingest-contract — Vertrag Brücke ↔ Spiegel: Snapshot v1
│                           (Zod, daraus JSON-Schema), Prüfsumme über RFC 8785, Testvektoren und
│                           eingefrorene Beispiele (SP-1.0a); seit SP-1.6 b auch die API v1 (Kopplung, Heartbeat,
│                           Zustand, Antworten); apps/spiegel nimmt darüber an.
├── packages/ssmdb2-cases/  @vereinsheim/ssmdb2-cases — Sonderfall-Testdaten (SP-1.0b): echtes SSMDB2-Schema,
│                           Baukasten, der wie Meyton schreibt, 31 Fälle mit Snapshots v1, SQL je Schritt und
│                           erwartetem Ergebnis unter `cases/v1`; `replay` spielt sie in MariaDB 10.6 ab;
│                           `./frozen` liest die eingefrorenen Snapshots (Tests von apps/spiegel).
├── packages/shot-help/     @vereinsheim/shot-help — Hilfe zu jeder Kennzahl und Auswertung in
│                           einfacher Sprache (Themen, Einstieg, Glossar, Fehlschlüsse); Quelle für App
│                           und Vault-Leitfaden, den `pnpm --filter @vereinsheim/shot-help docs` erzeugt
│                           (SP-1.11); apps/spiegel nutzt sie über shot-ui und im Fortschritt.
├── packages/shot-ui/       @vereinsheim/shot-ui — Bausteine von Spiegel als React-Komponenten: Scheibe
│                           (Nummern in Ebenen, Auswahl), Serien als kleine Scheiben, Kennzahl-Kacheln,
│                           Ablesung, Kopf mit Ergebnis, Schusstabelle, Wertung, Hilfe (Blatt), Zustand der
│                           Ansicht, Analyse einer Scheibe in sechs Reitern mit Diagrammen, Seitenaufbau
│                           (Kopf, Sprungleiste, Scheibe fest ab 768 px, Rücksprung), Seite eines Zeitraums
│                           (Verlauf, Umfang, Liste, Vergleich, Rekorde; L3), Adressen (`nav`, N1) und
│                           Scheiben-Liste nach Abend (`list`, N2), Rahmen der App mit Links und
│                           Blättern (`AppFrame`, `RouteLink`, N3), Start mit dem letzten Abend im
│                           Formband (`start`, N5); Design 2 (ADR-030, Oktober 2026);
│                           Start, Liste, Scheibe, Zeitraum und Rahmen nutzt apps/spiegel; Bedienung im Browser prüft
│                           `pnpm --filter spiegel pruefen` (Labor und Spielwiese entfernt, 13. Oktober 2026).
├── tools/ssmdb2-erkunden/  Erkundung der Meyton-SSMDB2 vor Ort (SP-0.1/0.6): Checkliste, Kopie, Schießprotokoll;
│                           Bash, nur lesend, Selbsttest gegen mariadb:11 (Oktober 2026).
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
