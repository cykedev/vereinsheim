# vereinsheim

Gemeinsames Production-Deployment für die Apps:

- **Ringwerk** (Liga & Wettkämpfe) — Source: [`../ringwerk`](../ringwerk)
- **Treffsicher** (Trainingsapp) — Source: [`../treffsicher`](../treffsicher)

Beide Apps laufen auf einem einzelnen VPS, geteilter
Postgres-Container (separate Datenbanken + User), Caddy als Reverse Proxy
mit automatischem Let's-Encrypt-TLS.

## Status

🟡 **Pre-Production.** Compose-Setup, CLI und Operations-Skripte sind
fertig und auf lokaler VM end-to-end validiert. VPS-Provisioning
(Phase 5) und Datenmigration (Phase 6) stehen aus.

Detaillierter Stand und Roadmap: [`docs/plan.md`](docs/plan.md).

## Doku

| Doc                                       | Inhalt                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| [`docs/spec.md`](docs/spec.md)             | Anforderungen, Zielarchitektur, VPS-Sizing, Out-of-Scope              |
| [`docs/decisions.md`](docs/decisions.md)   | ADRs — alle Architektur-Entscheidungen mit Begründung & Alternativen |
| [`docs/plan.md`](docs/plan.md)             | Roadmap: was ist fertig, was kommt als nächstes, Verifikation        |
| [`docs/operations.md`](docs/operations.md) | Daily Ops: Deploy, Backup, Restore, Migration-Recovery, Rollback      |
| [`CLAUDE.md`](CLAUDE.md)                   | Onboarding für Folgesessions / Coding-Agenten                         |

## Bedienkonzept

Ein Werkzeug, zwei Modi: [`./scripts/vereinsheim`](scripts/vereinsheim).

- **Lokal-Mode** wird aktiviert, sobald `.vereinsheim.local` existiert
  (auf deiner Arbeitsmaschine). Bietet `build`, `release`, `ssh`,
  `remote`, `local-setup`.
- **VPS-Mode** ist der Default. Bietet `setup`, `deploy`, `backup`,
  `restore`, `migrations`, `status`, `cron`, `psql`, `logs`, … .

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
# 1. VPS bei bestellen (Debian 12, S+/M).
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

- [`../ringwerk`](../ringwerk) — Source der Liga-App (Next.js + Prisma)
- [`../treffsicher`](../treffsicher) — Source der Trainingsapp (Next.js + Prisma)

Image-Builds laufen lokal (`docker buildx --platform linux/amd64`),
gepusht wird in **Docker Hub** unter `<DOCKER_USER>/ringwerk` und
`<DOCKER_USER>/treffsicher`. Pro App zwei Tags pro Build:
`:<sha>` (App-Image) und `:<sha>-migrator` (Migrations-Image), plus
`:latest` und `:latest-migrator`.
