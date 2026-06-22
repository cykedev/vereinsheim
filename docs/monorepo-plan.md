# Monorepo-Migration — Plan

> Status: **Phasen 1 + 3 erledigt** (Juni 2026). Phase 1: Skelett (pnpm + Turborepo), beide Apps als
> `apps/*` via `git filter-repo` (Git-History erhalten), Catalog, geteilter Dev-Postgres. Phase 3:
> Produktions-Build aus dem Monorepo via `turbo prune` (Image-Namen/Tags + Deploy-Vertrag bit-gleich),
> lokal voll verifiziert; der erste Monorepo-Deploy auf den VPS ist **gelaufen**. Gates grün.
> **Phase 2:** Harness/Knowledge (ADR-016/017/018/019) **+ `packages/config`** erledigt (Juni 2026).
> **Phase 4** (packages/ui) offen. Verbindliche Entscheidung:
> [ADR-015](decisions.md). Dieses Dokument ist der Umsetzungsplan; `decisions.md` hält das „Warum".

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
| Knowledge Graph für Claude Code | **3 Schichten**: generierter Projekt-Graph + hierarchische CLAUDE.md + MCP-Memory ([ADR-016](decisions.md)) |

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
├── CLAUDE.md             # Wurzel-Kontext; je apps/* und packages/* eigene CLAUDE.md (scope-weise)
├── .mcp.json             # MCP Knowledge-Graph-Memory-Server (project scope, eingecheckt)
├── .claude/skills/       # Projekt-Skills: check, graph, db-restore, release
├── docs/architecture.md  # hand-gepflegte High-Level-Karte (Detail-Graph: CodeGraph MCP, .codegraph/ gitignored)
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

Unverändert zum heutigen Mechanismus: gemeinsamer Postgres (zwei DBs `treffsicher`+`ringwerk`, `db-init`
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
| **1** ✅ | pnpm + turbo Skelett; beide Apps **as-is** nach `apps/*` via `git filter-repo` (History erhalten); geteilte Deps heben; Root-`docker-compose.dev.yml` | niedrig | ein Repo, schnelle inkrementelle Builds, ein Dev-Befehl |
| **2** ✅ | Harness/Knowledge (ADR-019) + `packages/config`: next/eslint/tsconfig-base/prettier/postcss als `@vereinsheim/config` (tailwind-globals → Phase 4) | niedrig | Konfig-Duplikate weg |
| **3** ✅ (Build) | `turbo prune`-Docker-Build; `build-and-push.sh` umgestellt; lokal verifiziert. **Staging-/VPS-Deploy ausstehend** | mittel | der schnelle, korrekte Build-/Deploy-Pfad |
| **4** | `packages/ui` + `packages/lib`: byte-identische Schicht **echt** teilen (Imports `@/components/ui` → `@vereinsheim/ui`, schrittweise) → **Drift-Gate entfällt** | mittel | Tier-1-Ziel: Drift strukturell unmöglich |
| **5** (optional, später) | CI (GitHub Actions) + Turbo Remote-Cache → supersedes ADR-006 | niedrig | maschinenübergreifender Cache |

Phase 1+3 liefern bereits „ein Monorepo, viel schnellerer Build". Phase 4 ist der größere Refactor und
kann komponentenweise laufen.

### Phase 1 — Umsetzungsnotizen (erledigt, Juni 2026)

Geliefert: Skelett (`pnpm-workspace.yaml` + Catalog, `package.json`, `turbo.json`, `.npmrc`), beide Apps
als `apps/*` via `git filter-repo --to-subdirectory-filter` (History erhalten, 316 + 148 Commits,
Merge mit `--allow-unrelated-histories`, **kein** Subtree-Sync), Catalog-Integration, Root-
`docker-compose.dev.yml` + `dev/db-init/` (zwei DBs `ringwerk` + `treffsicher`). **Alle 5 Gates grün** für
beide Apps, beide laufen lokal (`pnpm dev` → :3000 / :3001), Deploy-Vertrag bit-gleich.

Schlüsselentscheidungen / bewusste Abweichungen vom wörtlichen Plan:

- **„Geteilte Deps heben" = pnpm-Catalog** (in `pnpm-workspace.yaml`), nicht literale Deps in der
  Root-`package.json`. Grund: pnpm-Strenge — Root-only-Deps wären für die Apps Phantom-Deps. Catalog
  zentralisiert die Versionen (Drift-Schutz, ADR-015), Apps deklarieren weiter ihre Imports via
  `catalog:`. App-spezifische Deps bleiben literal in `apps/*`.
- **`@radix-ui/react-slider` explizit deklariert** (Catalog + beide Apps): `slider.tsx` importiert es
  direkt; npm-Hoisting kaschierte das, pnpm-Strenge deckte es auf (genau §9). Fixte `tsc`-TS2307 + einen
  Folge-`implicit-any` in treffsicher. **Einziger** Phantom-Dep — sonst nutzt alles das `radix-ui`-Umbrella.
- **Host-Dev statt In-Container-Dev**: Apps laufen via `pnpm dev` auf dem Host; `.env.example` zeigt auf
  `localhost:5432`. Dev-DBs heißen `ringwerk` + `treffsicher` — **an Prod angeglichen**, der Alt-Dev-Name
  `liga` wurde fallengelassen (App hardcodet keinen DB-Namen, nur `DATABASE_URL`). `vitest.config.ts`
  (ringwerk) lädt `.env` (`import "dotenv/config"`), damit die DB-Integrationstests (`publicSlug`)
  `DATABASE_URL` sehen — früher kam die Env aus dem Container.
- **Dev-Postgres = eigenes compose-Projekt** (`name: vereinsheim-dev`, eigenes Volume) → kein Eingriff in
  den Prod-Stack (`compose.yml`).
- **Build-Quelle (Phase 1 → Phase 3)**: in Phase 1 lief der Produktions-Build noch über `../ringwerk` /
  `../treffsicher`. **Mit Phase 3 baut `build-and-push.sh` aus dem Monorepo** (`turbo prune`) — die
  Standalone-Repos sind **keine Build-Quelle mehr** (granulare History dort via Tag `pre-monorepo-import`
  archiviert; sie können archiviert/entfernt werden). Der VPS läuft mit den alten Images bis zum nächsten
  `vereinsheim release`.

Bewusst **nicht** in Phase 1 (Scope-Grenze):

- ADR-016/017/018-Artefakte (CodeGraph-MCP, Memory-MCP, Hooks/Stop-Gate, PIV-Skills, Sub-Agents) → Phase 2.
- `packages/config|ui|lib` + Konfig-Hoisting → Phase 2/4. Die Apps tragen noch je eigene Configs.
- `turbo prune`-Docker-Build + `build-and-push.sh`-Umstellung → **in Phase 3 erledigt** (Build umgestellt +
  lokal verifiziert; Staging/VPS-Deploy ausstehend). `outputFileTracingRoot` (Monorepo-Wurzel) gesetzt +
  Dockerfile-COPY-Pfade an den genesteten Standalone-Output angepasst → NFT-Warnung weg.
- App-`CLAUDE.md`/`docs` referenzieren noch npm + In-Container-`/check` (Doc-Sync) → Phase 2.
- Per-App `apps/*/docker-compose.dev.yml` (Single-App-Dev-Build) **entfernt** — obsolet durch
  Root-`docker-compose.dev.yml` + `pnpm dev`. Die App-`.claude`/`docs` referenzieren den alten
  In-Container-Flow (`docker compose … run app`) noch → Phase-2-Doc-Sync.

### Phase 2 — Umsetzungsnotizen (packages/config erledigt, Juni 2026)

Geliefert: die fünf byte-identischen Tooling-Configs als geteiltes Paket `@vereinsheim/config`
(`packages/config`); pro App nur noch dünne Stubs. `globals.css` + `components.json` bleiben app-lokal
(Phase 4). Alle 5 Gates grün, Docker-Prune-Build geprüft.

- **Empirie-first bestätigt (offener Punkt aus §10):** zuerst nur der tsconfig-Slice
  (`extends "@vereinsheim/config/tsconfig/nextjs.json"`) + Workspace-Dep `"@vereinsheim/config":
  "workspace:*"` → `pnpm check-types` grün ⇒ pnpm löst Cross-Package-`extends` unter Strenge auf. Erst
  danach die übrigen vier.
- **Nur der *driftende* Kern wandert.** tsconfig: `compilerOptions` ins Paket, aber `paths`/`include`/
  `exclude` **müssen** im App-Stub bleiben — relative Pfade aus einer extended Config lösen gegen die
  *definierende* Datei auf (TS ≥5.0), sonst zeigt `@/*` aufs Paket statt auf `apps/<app>/src`.
- **Pro Config:** eslint/postcss = Re-Export-Stub (`export { default } from "@vereinsheim/config/…"`).
  prettier = `package.json`-Feld `"prettier": "@vereinsheim/config/prettier"`, `.prettierrc` gelöscht.
  next.config = `createNextConfig(__dirname)`-Factory; die App liefert `__dirname`, damit
  `outputFileTracingRoot = join(__dirname, "../../")` **rechnerisch byte-identisch** bleibt
  (Phase-3-Build-Vertrag gewahrt).
- **`eslint-config-next` app→Paket:** der Stub importiert es nicht mehr, das Paket hält es als `dependency`
  (löst transitiv unter pnpm-Strenge). `eslint` (Binary) bleibt in den Apps. `next build` ist grün **ohne**
  app-lokales `eslint-config-next` (Next 16 linted beim Build nicht).
- **next-Factory: selbst-enthaltene `.d.ts`** (bewusst **kein** `import from "next"`) → die App-Typprüfung
  braucht keine Cross-Package-„next"-Auflösung aus dem Paket-Kontext — relevant, weil `next build` die
  `next.config.ts` (liegt in tsconfig-`include`) mit-typprüft, auch im geprunten Docker-Build.
  `bodySizeLimit` als Literal `"12mb"` (zuweisbar zu Next's `SizeLimit`, nicht zum breiteren `string`).
- **vitest unberührt:** beide `vitest.config.ts` redeklarieren den `@`-Alias manuell
  (`path.resolve(__dirname, "./src")`) — vitest liest tsconfig nicht, also immun gegen die Extraktion.
- **Docker-Prune-Build:** `turbo prune <app> --docker` zieht `packages/config` über die Workspace-Dep-Kante
  in `out/json` + `out/full`; in-container `next build` löst tsconfig-`extends`/next.config/postcss auf. Per
  lokalem `PUSH=0`-Build geprüft (kein Deploy).
- **Gate/Docs:** die 5 Configs aus `consistency-check.sh` `MUST_MATCH` entfernt (Drift strukturell weg);
  `components.json` + `globals.css` bleiben. `shared-conventions.md` §1, `architecture.md` und Root-CLAUDE.md
  nachgezogen.

Bewusst **nicht** in Phase 2 (Scope-Grenze): `globals.css`/`components.json` teilen + `packages/ui|lib`
(echtes Code-Teilen, danach entfällt das Drift-Gate ganz) → Phase 4.

### Phase 3 — Umsetzungsnotizen (Build erledigt, Juni 2026)

Geliefert: Produktions-Build aus dem Monorepo via `turbo prune <app> --docker`. Image-Namen/Tags +
`compose.yml`/Caddy/`db-init` unverändert (Deploy-Vertrag gewahrt). Lokal voll verifiziert.

- **Ein parametrisiertes Root-`Dockerfile`** (`--build-arg APP=<app>`, Kontext `out/`): `deps` (pnpm
  install aus `out/json`, BuildKit-Cache-Mount auf den pnpm-Store) → `builder` (`turbo run build` =
  prisma generate + next build) → `runner` (Next standalone, `node apps/<app>/server.js`) → `migrator`.
- **`outputFileTracingRoot` = Repo-Wurzel** → Standalone nestet unter `apps/<app>/.next/standalone/` mit
  `server.js` unter `apps/<app>/`; runner-COPY-Pfade entsprechend. Generierter Prisma-Client wird in
  `.next/server` gebündelt (kein separates Kopieren nötig).
- **Migrator via `npm` (nicht pnpm)**: flacher Install nur von `prisma`+`pg`+`dotenv` → prisma-CLI unter
  `/app/node_modules/prisma` (vom Recovery-Skript per absolutem Pfad erwartet). pnpm 10 blockierte hier die
  Engine-Build-Scripts (`ERR_PNPM_IGNORED_BUILDS`; Allowlist griff weder in package.json noch
  pnpm-workspace.yaml) — npm hat kein solches Gate. Kein `@prisma/client`/`tsx` (Seeding läuft per
  App-Startup, nicht im Migrator).
- **`<sha>` = Monorepo-HEAD** (beide Apps teilen ihn); Tag-Schema unverändert. `build-and-push.sh`
  zentralisiert die Logik; `PUSH=0` → lokale `--load`-Testbuilds (kein Push/Gate), `vereinsheim
  local-build` ruft genau das.
- **Image-Größen**: runner ~300 MB (node:24-alpine + Standalone, wie zuvor), migrator ~950 MB (prisma 7
  zieht effect/electric-sql als eigene Deps — vergleichbar zum alten Full-App-Migrator).
- **Verifikation lokal**: runner serviert (HTTP 200), migrator `migrate deploy` (Exit 0, alle Migrationen),
  und der **ganze `compose.yml`-Stack** (db-init → migrate → app) kommt sauber hoch. **Offen: echter
  VPS-/Staging-Deploy** (user-gated).

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

## 10. Knowledge Graph für Claude Code (siehe ADR-016)

> **Status: implementiert** (Juni 2026, [ADR-019](decisions.md)). Root-`.claude/` (Skills/Hooks/Agents/
> Context), `.mcp.json` (CodeGraph + Memory), geseedeter `.claude/knowledge-graph.json`,
> `docs/architecture.md`, CLAUDE.md-Hierarchie (Root @import + `apps/<app>/CLAUDE.md`/`docs/`). Hooks +
> MCP greifen ab dem nächsten Claude-Code-Reload.

Drei komplementäre Schichten, in die Migration eingebettet:

| Schicht | Was | Wo | Phase |
| --- | --- | --- | --- |
| **1. Code-Graph (CodeGraph MCP)** | `@colbymchenry/codegraph` (lokal, SQLite): Symbole/Call-Graph/Referenzen/Routen, auto-aktuell via File-Watcher; Agenten via `codegraph_explore`. `.codegraph/` gitignored, Telemetrie aus. Dazu kleine hand-gepflegte `docs/architecture.md` (High-Level-Karte) | `.mcp.json` | 2 |
| **2. Hierarchische CLAUDE.md** | Root + `apps/*/CLAUDE.md` + `packages/*/CLAUDE.md` (on-demand), `@import` auf architecture/conventions/decisions; Skills unter `.claude/skills/` | repo-weit | 1–2 |
| **3. MCP-Knowledge-Graph** | `@modelcontextprotocol/server-memory` in `.mcp.json` (project, eingecheckt), Store `.claude/knowledge-graph.json`; Seed-Skript aus Schicht 1 + ADRs | `.mcp.json` + `scripts/` | 2 |

**Zusammenspiel**: Schicht 1 (CodeGraph) = „was der Code _ist_" (live, auto-aktuell, on-demand
abgefragt). Schicht 3 (Memory) = „was wir _entschieden/gelernt_ haben" (aus ADRs/Konventionen
geseedet, wächst über Sessions). Orthogonal; Schicht 2 (CLAUDE.md, scope-weise + `@import`) macht beide
für Agenten auffindbar.

**Wartung/Risiko**: Schicht 1 ist ein fertiges Tool (kein Eigencode); neuer Eigencode nur das
Seed-Skript für Schicht 3. CodeGraph ist Dev-Hilfe, keine Build-Abhängigkeit. pnpm-Cross-Package in Phase 2
empirisch verifiziert (`@vereinsheim/config`: tsconfig-`extends` + Re-Exports unter
pnpm-Strenge, `pnpm check` grün). `next build`/`check` bleiben Pflicht-Gates.

**Lessons-/Wissens-Capture ([ADR-017](decisions.md))**: `/consolidate-lessons` triagiert Learnings nach
**ENFORCE > DOCUMENT > REMEMBER** — REMEMBER landet in Schicht 3 (Memory-Graph), ENFORCE wird
Gate/Lint/Test, DOCUMENT in CLAUDE.md/Konventionen. Ein einziges Skill für beide Apps.

## 11. Team-Readiness (nicht lokal-only)

Für mehrere parallele Entwickler muss alles **eingecheckt + reproduzierbar** sein, nichts
maschinengebunden:

- **Eingecheckt (geteilt):** `.claude/` (CLAUDE.md-Hierarchie + Skills), `.mcp.json` (MCP-Server,
  Project-Scope), `docs/*` (Konventionen, ADRs, `architecture.md`), `turbo.json`,
  `pnpm-workspace.yaml`, alle Ops-Skripte. **Keine Secrets** in `.mcp.json`.
- **Bewusst lokal (gitignored, pro Dev):** `.codegraph/`-Index (re-buildbar), `.env*` /
  `.vereinsheim.local` / `.claude/settings.local.json` (persönlich), `node_modules`.
- **CodeGraph-Onboarding reproduzierbar:** ein `setup`-Schritt (README / `postinstall` /
  `vereinsheim setup-dev`) installiert die CLI + `codegraph init`, damit der Graph auf jeder Maschine
  entsteht — nicht nur lokal.
- **Memory-Graph (Schicht 3) + parallele Devs:** der eingecheckte `.claude/knowledge-graph.json` ist
  bei gleichzeitigem Schreiben merge-konflikt-anfällig. Strategie: Einträge additiv/append halten,
  Konflikte wie Daten zusammenführen (nicht überschreiben); die **autoritative** Wahrheit bleibt in
  promoteten Docs/ADRs/Gates (ENFORCE/DOCUMENT) — der Graph ist abrufbares Beiwerk, kein
  Single-Point-of-Truth.
- **Lessons-System geteilt:** im Monorepo **ein** `/consolidate-lessons` für beide Apps (ADR-017) —
  löst die heutige ringwerk-only-Asymmetrie.

## 12. Offene Folgepunkte (nicht in dieser Migration)

- ActionResult-Typ-Vereinheitlichung (Treffsicher) — passt gut in `packages/lib`.
- Env-Var-Angleichung `ADMIN_*` ↔ `SEED_ADMIN_*` (deploy-breaking, separat).
- CI/Remote-Cache (Phase 5).
- **Dev-Tooling-Baseline vereinheitlicht (erledigt, [ADR-020](decisions.md)):** **ein** Satz am Root für
  beide Apps — der native **PIV-Workflow** (`/plan → /implement → /validate → /review` + `/debug`) mit
  den geharvesteten Superpowers-Disziplinen (brainstorming, TDD, evidence-before-claims, receiving-review,
  systematic-debugging), verzahnt mit den Schichten: CodeGraph speist Planung/Impact, Lessons speisen den
  Memory-Graph, das Stop-Gate erzwingt promotete Regeln. Das **Superpowers-Plugin ist entfernt** (kein
  zweiter, abweichender Workflow); die datierten `docs/superpowers/`-Archive bleiben als Historie.
