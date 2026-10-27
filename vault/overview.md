---
id: overview
type: guide
title: "Spec — vereinsheim"
aliases: ["Spec — vereinsheim"]
keywords: [spec, vereinsheim, anforderungen, zielarchitektur, sizing, vps, drei apps, deploy, backup, scope]
---

**TL;DR** Der Verein betreibt drei Web-Apps (Ringwerk, Treffsicher, Spiegel) gemeinsam auf einem VPS: Caddy mit automatischem TLS, ein Postgres mit getrennten Datenbanken, Images lokal gebaut und über Docker Hub verteilt, Backups per Cron. Diese Note beschreibt Anforderungen, Zielarchitektur und Sizing.

# Spec — vereinsheim

## Hintergrund

Der Verein betreibt drei Web-Apps:

- **Ringwerk** — Liga- und Wettkampf-Verwaltung (Disziplinen, Teilnehmer, Matchups, Playoff, Auswertungen,
  Meyton-PDF-Import).
- **Treffsicher** — Trainings-App (Sessions, Serien, Reflexionen, Goals, Wellbeing-Tracking).
- **Spiegel** — Schussrohdaten aus der Meyton-Anlage: Schussbild, Serien, Verläufe, Vergleiche ([[spiegel]],
  ADR-026). Die Daten liefert eine Brücke im Schützenhaus ([[spiegel-bridge]]).

Ein einzelner VPS hostet alle drei, mit minimaler Reibung beim Deploy und transparenten Backups. Die Apps leben als
`apps/*` in diesem Monorepo (ADR-015, [[monorepo]]); **dieses Spec beschreibt die Deploy- und Laufzeit-Architektur**.

## Anforderungen

### Funktional

1. Jede App unter einer eigenen Subdomain (`RINGWERK_HOST`, `TREFFSICHER_HOST`, `SPIEGEL_HOST` in `.env`).
2. Automatische TLS-Zertifikate (Let's Encrypt), automatische Erneuerung.
3. Geteilter Postgres-Container, aber **getrennte Datenbanken + getrennte User**, damit Cross-DB-Zugriffe technisch
   unmöglich sind.
4. Persistente Volumes für Postgres-Daten und User-Uploads (Treffsicher: Bilder + PDFs; Ringwerk und Spiegel haben
   keine persistierten Uploads).
5. Zero-touch-Deploy: `vereinsheim deploy` auf dem VPS (Pre-Backup, Pull, Up); Migrationen laufen automatisch vor dem
   App-Start, die Apps nacheinander.
6. Backup aller drei DBs + Treffsicher-Upload-Volume per Cron, 14-Tage-Rolling lokal auf dem VPS.
7. Repeatable Restore (Recovery und Probe-Restore in eine Wegwerf-DB).

### Nicht-funktional

- **Ressourcensparsam**: alles läuft auf einem VPS mit 2 GB RAM ([[vps-resource-sizing]]).
- **Reproduzierbar**: alles in Git, Secrets ausschließlich in `.env` auf dem VPS.
- **Schmaler Scope**: kein Web-UI für Proxy-Config, kein dediziertes Monitoring, keine CI.
- **Sicher by default**: DB nicht im Web-Netzwerk, kein Host-Portmapping für Postgres, die Ratenbegrenzung der
  Anmeldung erkennt die echte Client-IP über Proxy-Header.

### Image-Build & Distribution

- Images werden **lokal auf der Arbeitsmaschine des Maintainers** mit `docker buildx --platform linux/amd64` gebaut,
  aus dem Monorepo via `turbo prune <app> --docker` + dem parametrisierten Root-`Dockerfile` (ADR-015).
- Push in **Docker Hub** unter Account `<DOCKER_USER>`, **public** Images (Source ist public, keine Build-Time-Secrets).
- **Pro App zwei Images**, weil die `runner`-Stage bewusst kein Prisma-CLI enthält (nur Next.js standalone). Die
  Migrationen laufen aus der separaten `migrator`-Stage (ADR-007):
  - `<user>/<app>:<sha>` + `:latest` (target=runner)
  - `<user>/<app>:<sha>-migrator` + `:latest-migrator` (target=migrator)
  - `<sha>` ist der Monorepo-HEAD (alle Apps teilen ihn).
- Build-Aufruf gekapselt durch `./scripts/vereinsheim build`: exportiert `DOCKER_USER` aus `.vereinsheim.local`, ruft
  `scripts/build-and-push.sh` (prune + beide Targets pro App, `APPS=…` schränkt ein).

### Daten sichern und übertragen

- `pg_dump -Fc` je Datenbank + `tar` für die Uploads, als nächtliches Backup per Cron (`scripts/backup.sh`) und vor
  jedem Deploy.
- Dieselbe Mechanik dient dem Restore und dem Übertragen von Daten auf einen neuen Server.

## Architektur-Entscheidungen

Vollständige Begründungen mit verworfenen Alternativen → [[decisions]]. Kurzform:

| Bereich            | Wahl                                                     |
| ------------------ | -------------------------------------------------------- |
| Repo-Modell        | Code- + Deployment-Monorepo `vereinsheim` (ADR-015)      |
| Container-Registry | Docker Hub, public Images                                |
| Reverse Proxy      | Caddy 2 (Caddyfile, kein Web-UI)                         |
| DB-Isolation       | 1 Postgres-Container, 3 DBs, 3 User                      |
| Migrations-Image   | Separate `migrator`-Stage, eigener Tag pro Build         |
| Backup             | `pg_dump -Fc` + `tar`, 14 Tage lokal                     |
| Build-Ort          | Lokal (keine CI)                                         |
| Operations-Tooling | Einheitliches `vereinsheim`-CLI (Lokal-/VPS-Mode)        |

## Zielarchitektur

```
Internet ──(443/80)── Caddy ─┬── RINGWERK_HOST     → app-ringwerk:3000
                             ├── TREFFSICHER_HOST  → app-treffsicher:3000
                             └── SPIEGEL_HOST      → app-spiegel:3000   (max. 5 MiB je Anfrage)

Netzwerke:
  web   = caddy + app-ringwerk + app-treffsicher + app-spiegel
  data  = db + apps + migrate-services      (DB nicht im web-Netzwerk!)

Services:
  caddy                caddy:2-alpine                    (TLS, Reverse Proxy)
  db                   postgres:15-alpine                (1 Container, 3 DBs, 3 User)
  migrate-ringwerk     <DOCKER_USER>/ringwerk:<sha>-migrator     (one-shot, prisma migrate deploy)
  migrate-treffsicher  <DOCKER_USER>/treffsicher:<sha>-migrator  (one-shot)
  migrate-spiegel      <DOCKER_USER>/spiegel:<sha>-migrator      (one-shot)
  app-ringwerk         <DOCKER_USER>/ringwerk:<sha>
  app-treffsicher      <DOCKER_USER>/treffsicher:<sha>
  app-spiegel          <DOCKER_USER>/spiegel:<sha>

Volumes:
  postgres_data        → /var/lib/postgresql/data
  caddy_data           → /data        (LE-Zertifikate – kritisch!)
  caddy_config         → /config
  uploads_treffsicher  → /app/uploads (im treffsicher-Container)
  uploads_spiegel      → /app/uploads (im spiegel-Container)
```

**Begründung Netzwerk-Split**: Caddy braucht keinen DB-Zugriff. Liegt `db` nur im `data`-Netz, ist sie auch bei einer
Kompromittierung von Caddy nicht direkt erreichbar.

**Begründung 1 Container, 3 DBs**: Postgres trägt problemlos mehrere Datenbanken in einem Cluster. Ein Container je
App wäre reine RAM-Verschwendung (~250 MB je Container). Owner-getrennte User stellen die Isolation sicher.

## App-Integration (Monorepo)

Die Apps leben als [`apps/ringwerk`](../apps/ringwerk), [`apps/treffsicher`](../apps/treffsicher) und
[`apps/spiegel`](../apps/spiegel) in diesem Repo. Jede App hat ihr eigenes Prisma-Schema, ihre Migrationen,
`auth.ts` und `db.ts`; alle Laufzeit-Knöpfe kommen aus env vars (hinter Caddy etwa `AUTH_TRUST_PROXY_HEADERS=true`).
Geteilte Dep-Versionen liegen im pnpm-Catalog, geteilter Code in `packages/*`. Details: [[monorepo]].

## VPS-Sizing

Gewählt ist **IONOS VPS S** (2 vCPU, 2 GB RAM, 80 GB SSD), tragfähig dank harter `mem_limit` in
[`compose.yml`](../compose.yml). **RAM ist der Engpass**, nicht CPU; Image-Builds laufen lokal, auf dem VPS braucht es
keinen Build-Puffer.

| Komponente              |  RAM (Spitze) | mem_limit | Disk        |
| ----------------------- | ------------: | --------: | ----------- |
| OS (Debian 12)          |        400 MB |         — | 5 GB        |
| Docker-Engine + Images  |             — |         — | 1 GB        |
| Caddy                   |         64 MB |      96 M | —           |
| Postgres 15 (shared)    |  ~120 MB[^pg] |     384 M | 1–2 GB Data |
| Ringwerk (Next.js)      |        188 MB |     256 M | —           |
| Treffsicher (Next.js)   |        163 MB |     256 M | —           |
| Spiegel (Next.js)       |        201 MB |     320 M | —           |
| Migratoren (one-shot)   | ~130 MB je    |  192 M je | —           |
| Uploads                 |             — |         — | 10–20 GB    |
| Backups (14 Tage)       |             — |         — | 5–10 GB     |

[^pg]: Realistischer Worst-Case mit shared_buffers (128 MB) + ~10 MB pro Connection × typisch 10–20 aktive
Connections: 250–350 MB.

**Steady-State: ~0,9 GB RAM, ~25–40 GB Disk.** Die Grenzen der Dauerdienste summieren sich auf 1.312 MiB; neben
System und Docker (~500 MiB) bleibt Luft. Die Migratoren laufen beim Deploy nacheinander. Die Apps laufen mit
Heap-Grenze 160 ([[node-heap-above-container-limit]]); Spiegel hat 64 MiB mehr für den Leser der Ausdrucke, der als
Kindprozess zur Grenze seines Containers zählt. Messungen und eine Swap-Datei als Sicherheitsnetz:
[[vps-resource-sizing]].

## Was NICHT im Scope

- CI/CD (GitHub Actions) und Turbo-Remote-Cache; nachrüstbar, würde ADR-006 ablösen ([[monorepo]]).
- Off-Site-Backup (S3/borg/NAS); das lokale Rolling-Backup deckt den häufigsten Fall (versehentliches Löschen,
  Schema-Unfall) ab ([[off-site-backup-gap]]).
- Monitoring/Alerting (Prometheus, Uptime-Kuma).
- Staging-Umgebung; den Stack mit den echten Images prüft lokal `tools/stack-e2e/run.sh`.
- WAF / Fail2ban. Caddy + die Ratenbegrenzung der Anmeldung reichen als Baseline.
- Ein generisches App-Template; erst sinnvoll, wenn weitere Apps dazukommen.

Jeder dieser Punkte bekommt eine eigene ADR, wenn er aktuell wird.
