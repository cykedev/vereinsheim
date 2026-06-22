# Monorepo-Migration — Plan

> Status: **geplant** (noch keine Code-Migration). Verbindliche Entscheidung: [ADR-015](decisions.md).
> Dieses Dokument ist der Umsetzungsplan; `decisions.md` hält das „Warum".

## 1. Ziel

Ringwerk und Treffsicher werden als `apps/*` in `vereinsheim` integriert, geteilter Code wandert
nach `packages/*`. Ergebnis:

- **Konsistenz strukturell** statt reaktiv (das Drift-Gate `consistency-check.sh` wird überflüssig).
- **Schnelle, inkrementelle Builds** — unveränderte Apps werden nicht neu gebaut.
- **Ein Dev-Workflow / ein Befehlssatz** für beide Apps, mit echten Daten wie heute.
- **Deploy-Vertrag unverändert** → Live ohne Risiko.

## 2. Getroffene Entscheidungen (Locked)

| Thema | Entscheidung |
| --- | --- |
| Workspace + Orchestrator | **pnpm Workspaces + Turborepo** (Migration npm → pnpm) |
| Docker-Build | **`turbo prune --docker`** pro App, Build im Image |
| Git-History | **erhalten** via einmaligem `git filter-repo`-Import (kein Subtree-Sync) |
| CI / Remote-Cache | **später** — MVP bleibt lokaler Build (ADR-006); CI/Turbo-Remote-Cache als optionale Phase 5 |
| Deploy-Vertrag | **unverändert** (Image-Namen/Tags, compose.yml, Caddy, db-init, Backup/Restore) |

## 3. Zielstruktur

```
vereinsheim/
├── apps/
│   ├── treffsicher/      # eigenes prisma/ (schema, migrations, generierter Client), db.ts, auth.ts, Dockerfile
│   └── ringwerk/
├── packages/
│   ├── ui/               # geteilte Komponenten (shell/, ui/), Hooks
│   ├── lib/              # cn, dateTime, forms/fieldErrors, ActionResult-Typ — reine Utils (KEIN "use server")
│   └── config/           # next.config, eslint, tsconfig-base, prettier, postcss, tailwind/globals
├── compose.yml, Caddyfile, db-init/, scripts/, backups/   # bestehende Ops, unverändert
├── turbo.json
├── pnpm-workspace.yaml
└── package.json          # geteilte Deps gehoben; app-spezifische bleiben in apps/*
```

**App-lokal bleibt** (nie geteilt): Prisma-Schema/Migrations/`src/generated/prisma`, `db.ts`, `auth.ts`,
`src/types/next-auth.d.ts`, fachliche Komponenten, app-spezifische Deps (`recharts`/`react-hook-form`
bei Treffsicher, `@react-pdf/renderer` bei Ringwerk).

## 4. Der schnelle Build

Heute: 4 Images sequentiell (2 Apps × runner+migrator), jedes mit eigenem `npm ci` + `prisma generate`
+ `next build`, ohne geteilten Cache → jeder Release baut alles neu.

Monorepo-Hebel:

1. **Turbo-Task-Cache** — `turbo build` überspringt unveränderte Apps (Cache-Hit).
2. **`turbo prune <app> --docker`** — minimaler, cache-stabiler Build-Kontext pro App; der Deps-Layer
   hängt nur am geprunten Lockfile.
3. **BuildKit Cache-Mount** auf den pnpm-Store → Installs nahezu instant bei warmem Cache.
4. **Nur Geändertes** — `turbo build --filter='[HEAD^1]'`; Images parallel statt sequentiell.

Docker-Muster (Turborepo-Standard, cache-stabil, gleicher Deploy-Artefakt):

```
deps    : COPY out/json + lockfile → pnpm install --frozen-lockfile   (--mount=type=cache pnpm-store)
builder : COPY out/full → pnpm turbo build --filter=<app>             (prisma generate + next build → .next/standalone)
runner  : COPY .next/standalone → node server.js                      (unverändert)
migrator: prisma CLI + prisma/ + run-migrations-with-recovery.sh      (unverändert, ADR-007)
```

Image-Namen/Tags (`$DOCKER_USER/<app>` + `:<sha>` + `:<sha>-migrator`) **bleiben identisch**.

Erwartung: Ein Release, der nur eine App ändert, baut nur deren Image neu, ohne Dep-Neuinstallation,
die andere App übersprungen → realistisch **3–10× schnellere inkrementelle Releases**.

## 5. Dev-Workflow & Kommandos

Von der Wurzel, alles turbo-gecacht:

```
pnpm dev                      # beide Apps   (pnpm dev --filter ringwerk für eine)
pnpm check                    # alle 5 Gates (lint, format:check, test, tsc, next build) über betroffene Apps
pnpm build                    # vollständiger, inkrementeller Build
pnpm test --filter ringwerk
```

Die `vereinsheim`-CLI (ADR-011) bleibt das Ops-Frontend und wrappt das: `vereinsheim dev`,
`vereinsheim build [app]`, `vereinsheim release`, `vereinsheim db:restore`.

`next build` ist Pflicht-Gate (fängt Build-only-Fehler ab, die lint/tsc/test nicht sehen, z.B.
`"use server"`-Re-Export-Regel) — turbo cacht es, also nur für geänderte Apps teuer.

## 6. Echte Daten im Dev

Unverändert zum heutigen Mechanismus: gemeinsamer Postgres (zwei DBs `treffsicher`+`liga`, `db-init`
isoliert, ADR-002) im Root-`docker-compose.dev.yml`; `vereinsheim local-up --restore` bzw.
`db:restore` spielt `backups/*.dump` per `pg_restore` in die Dev-DBs. Ein Kommando → beide Apps lokal
mit Prod-Daten.

## 7. Deploy bleibt vertragsgleich → Live ohne Probleme

Design-Prinzip: **rein build-seitige Migration**. Gleiche Image-Namen/Tags, unverändertes `compose.yml`,
`Caddyfile`, `db-init`, Backup/Restore, getrennte DBs/Migrations (ADR-002/003/004/007/009/010 unberührt).
Der VPS sieht keinen Unterschied. Cutover-Verifikation: gebautes Image gegen aktuelles Prod-Image diffen
+ Staging-Deploy (Caddy-Staging-ACME-Schalter).

## 8. Migration in Phasen (jederzeit lauffähig)

| Phase | Inhalt | Risiko | Gewinn |
| --- | --- | --- | --- |
| **1** | pnpm + turbo Skelett; beide Apps **as-is** nach `apps/*` via `git filter-repo` (History erhalten); geteilte Deps heben; Root-`docker-compose.dev.yml` | niedrig | ein Repo, schnelle inkrementelle Builds, ein Dev-Befehl |
| **2** | `packages/config` (next/eslint/tsconfig-base/prettier/postcss/tailwind-globals) | niedrig | Konfig-Duplikate weg |
| **3** | `turbo prune`-Docker-Build; `build-and-push.sh` umstellen; **Staging-Deploy-Test** | mittel | der schnelle, korrekte Build-/Deploy-Pfad |
| **4** | `packages/ui` + `packages/lib`: byte-identische Schicht **echt** teilen (Imports `@/components/ui` → `@vereinsheim/ui`, schrittweise) → **Drift-Gate entfällt** | mittel | Tier-1-Ziel: Drift strukturell unmöglich |
| **5** (optional, später) | CI (GitHub Actions) + Turbo Remote-Cache → supersedes ADR-006 | niedrig | maschinenübergreifender Cache |

Phase 1+3 liefern bereits „ein Monorepo, viel schnellerer Build". Phase 4 ist der größere Refactor und
kann komponentenweise laufen.

## 9. Risiken & Gotchas

- **Prisma-7-Client-Pfad** bleibt app-lokal (`output: ../src/generated/prisma`); in `turbo.json` als
  Build-`outputs` + `prisma/**` als `inputs` deklarieren (sonst Cache-Staleness). Schemata/Migrations
  nie teilen.
- **pnpm-Strenge**: geteilte Pakete explizit als `"@vereinsheim/ui": "workspace:*"` deklarieren
  (verhindert Phantom-Deps).
- **Tailwind v4 content/`@source`**: bei UI im Paket müssen die `packages/ui`-Sourcen ins Class-Scanning
  aufgenommen werden, sonst fehlen Klassen (Grund für Phase 4 separat).
- **`"use server"` in Paketen**: geteilte Dateien dürfen keine Server-Action-Re-Exports sein; `"use
  server"` bleibt in den Apps. `next build`-Gate fängt Regressionen.
- **shadcn-CLI** läuft weiter im App-Kontext (`components.json` pro App).
- **VPS-RAM** unangetastet (Runner-Images weiter per-App-standalone; Build lokal, ADR-006).

## 10. Offene Folgepunkte (nicht in dieser Migration)

- ActionResult-Typ-Vereinheitlichung (Treffsicher) — passt gut in `packages/lib`.
- Env-Var-Angleichung `ADMIN_*` ↔ `SEED_ADMIN_*` (deploy-breaking, separat).
- CI/Remote-Cache (Phase 5).
