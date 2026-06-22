# vereinsheim

Gemeinsames Repo für zwei Next.js-Apps — **Code-Monorepo** (Entwicklung)
und **Deployment** (Ops) in einem:

- **Ringwerk** (Liga & Wettkämpfe) — [`apps/ringwerk`](apps/ringwerk)
- **Treffsicher** (Trainingsapp) — [`apps/treffsicher`](apps/treffsicher)

Beide Apps laufen auf einem einzelnen VPS, geteilter
Postgres-Container (separate Datenbanken + User), Caddy als Reverse Proxy
mit automatischem Let's-Encrypt-TLS.

## Status

🟢 **Produktiv.** Beide Apps laufen seit Ende Mai 2026 auf dem VPS
(IONOS, Debian 13) — geteilter Postgres, Caddy mit Let's-Encrypt-TLS,
täglicher Backup-Cron um 03:00. Alle Roadmap-Phasen (1–6) sind
abgeschlossen.

🟡 **Monorepo-Migration — Phase 1 erledigt** (Juni 2026): beide Apps sind via
`git filter-repo` (Git-History erhalten) als `apps/*` integriert — Workspace
mit **pnpm + Turborepo**, geteilte Dep-Versionen im pnpm-Catalog, geteilter
Dev-Postgres ([`docker-compose.dev.yml`](docker-compose.dev.yml)). Der
**Deploy-Vertrag ist unverändert**: der Produktions-Build läuft bis **Phase 3**
weiter über die Standalone-Repos `../ringwerk` / `../treffsicher`
(`vereinsheim build`) — bis dahin sind sie die Quelle für Releases. Plan &
Phasen: [`docs/monorepo-plan.md`](docs/monorepo-plan.md).

Detaillierter Stand und Roadmap: [`docs/plan.md`](docs/plan.md).

## Monorepo-Entwicklung (lokal)

Beide Apps werden im Monorepo entwickelt — ein Befehlssatz von der Wurzel,
turbo-gecacht, Apps laufen auf dem Host:

```bash
corepack enable                                   # pnpm via packageManager-Pin
pnpm install                                      # Workspace-Deps (Catalog)
docker compose -f docker-compose.dev.yml up -d    # geteilter Postgres (2 DBs)
cp apps/ringwerk/.env.example  apps/ringwerk/.env        # einmalig
cp apps/treffsicher/.env.example apps/treffsicher/.env   # einmalig
pnpm --filter ringwerk exec prisma db push        # Schema → Dev-DB (analog treffsicher)
pnpm dev                                          # beide Apps: :3000 + :3001

pnpm check    # alle 5 Gates (lint, format:check, test, tsc, next build)
pnpm build    # inkrementeller Build beider Apps
```

Echte Prod-Daten kommen wie bisher über `backups/*.dump` (`pg_restore` in die
Dev-DBs `liga` + `treffsicher`).

## Doku

| Doc                                       | Inhalt                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| [`docs/spec.md`](docs/spec.md)             | Anforderungen, Zielarchitektur, VPS-Sizing, Out-of-Scope              |
| [`docs/decisions.md`](docs/decisions.md)   | ADRs — alle Architektur-Entscheidungen mit Begründung & Alternativen |
| [`docs/monorepo-plan.md`](docs/monorepo-plan.md) | Monorepo-Migration (ADR-015–018): Phasen 1–5, aktiver Plan       |
| [`docs/plan.md`](docs/plan.md)             | Roadmap: was ist fertig, was kommt als nächstes, Verifikation        |
| [`docs/operations.md`](docs/operations.md) | Daily Ops: Deploy, Backup, Restore, Migration-Recovery, Rollback      |
| [`CLAUDE.md`](CLAUDE.md)                   | Onboarding für Folgesessions / Coding-Agenten                         |

## Bedienkonzept

Ein Werkzeug, zwei Modi: [`./scripts/vereinsheim`](scripts/vereinsheim).

- **Lokal-Mode** wird aktiviert, sobald `.vereinsheim.local` existiert
  (auf deiner Arbeitsmaschine). Bietet `build`, `release`, `ssh`,
  `remote`, `local-setup`.
- **VPS-Mode** ist der Default. Bietet `setup`, `deploy`, `rollback`,
  `backup`, `restore`, `migrations`, `status`, `cron`, `psql`, `logs`, … .

Ohne Argument startet das passende interaktive Menü, mit Subcommand
läuft es nicht-interaktiv. `./scripts/vereinsheim help` zeigt die
vollständige Liste.

Die zwei Konfigurations-Dateien sind beide gitignored:

| Datei                | Maschine | Inhalt                                                |
| -------------------- | -------- | ----------------------------------------------------- |
| `.env`               | VPS      | Postgres-Passwörter, NEXTAUTH_SECRETs, Domain, …      |
| `.vereinsheim.local` | lokal    | `VPS_HOST`, `VPS_REPO_PATH`, `DOCKER_USER`            |

## Quick Reference

### Erstes Aufsetzen

```bash
# 1. VPS bestellen (Debian 13, S+/M).
# 2. Als root, einmalig:
bash bootstrap-vps.sh "ssh-ed25519 AAAA... du@workstation" \
  "https://github.com/cykedev/vereinsheim.git"

# 3. Als deploy-User:
ssh deploy@<vps>
cd ~/vereinsheim
./scripts/vereinsheim setup        # .env-Wizard
./scripts/vereinsheim cron         # Backup-Cron

# 4. DNS-A-Records für RINGWERK_HOST und TREFFSICHER_HOST setzen.

# 5. Lokal, einmalig:
./scripts/vereinsheim local-setup  # VPS_HOST, VPS_REPO_PATH, DOCKER_USER
docker login docker.io             # für den Image-Push

# 6. Erster Deploy:
./scripts/vereinsheim release      # build + push + remote deploy
```

### Daily Ops lokal

```bash
./scripts/vereinsheim release          # build + push + remote deploy
./scripts/vereinsheim build            # nur Build + Push, kein Deploy
./scripts/vereinsheim remote deploy    # nur Deploy auf VPS, kein Build
./scripts/vereinsheim remote status    # VPS-Stand abfragen
./scripts/vereinsheim ssh              # interaktive Shell auf VPS
```

### Daily Ops auf dem VPS

```bash
./scripts/vereinsheim                  # interaktives Menü
./scripts/vereinsheim status
./scripts/vereinsheim backup
./scripts/vereinsheim restore
./scripts/vereinsheim migrations ringwerk
./scripts/vereinsheim psql ringwerk
./scripts/vereinsheim logs caddy
```

## Konventionen

- **Keine Secrets im Repo.** Alles Sensible lebt in `.env` (VPS) oder
  `.vereinsheim.local` (lokal). Beide sind in `.gitignore`.
- **Image-Builds sind reproduzierbar.** `vereinsheim build` weigert sich,
  zu bauen, wenn das jeweilige App-Repo uncommittete Änderungen hat — der
  Tag enthält immer eine eindeutige Git-SHA.
- **Pre-Deploy-Backup ist Default.** `vereinsheim deploy` macht ein
  Backup direkt vor jedem Pull. Override: `SKIP_BACKUP=1`.
- **`db` ist nicht im `web`-Netzwerk.** Caddy sieht die Datenbank nicht
  (Sicherheit), Apps und Migrate-Container schon.

## Verwandte Repos

Seit Monorepo-Phase 1 liegt der App-Code in [`apps/ringwerk`](apps/ringwerk)
und [`apps/treffsicher`](apps/treffsicher). Die Standalone-Repos bleiben bis
**Phase 3** die Quelle für Produktions-Builds (`vereinsheim build`):

- [`../ringwerk`](../ringwerk) — Standalone-Repo der Liga-App (Build-Quelle bis Phase 3)
- [`../treffsicher`](../treffsicher) — Standalone-Repo der Trainingsapp (Build-Quelle bis Phase 3)

Image-Builds laufen lokal (`docker buildx --platform linux/amd64`),
gepusht wird in **Docker Hub** unter `<DOCKER_USER>/ringwerk` und
`<DOCKER_USER>/treffsicher`. Pro App zwei Tags pro Build:
`:<sha>` (App-Image) und `:<sha>-migrator` (Migrations-Image), plus
`:latest` und `:latest-migrator`.

## Lizenz

Apache License 2.0 — siehe [`LICENSE`](LICENSE).

> Hinweis: Diese Lizenz deckt nur die Deployment-Tooling in diesem Repo
> (CLI, Compose-Files, Caddy-Konfig, Doku). Die App-Sources in
> `../ringwerk` und `../treffsicher` haben jeweils ihre eigenen Lizenzen.
