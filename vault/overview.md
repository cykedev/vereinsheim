---
id: overview
type: guide
title: "Spec — vereinsheim"
aliases: ["Spec — vereinsheim"]
keywords: [spec, vereinsheim]
---

**TL;DR** Die SG Taufkirchen betreibt zwei Web-Apps:

# Spec — vereinsheim

## Hintergrund

Die SG Taufkirchen betreibt zwei Web-Apps:

- **Ringwerk** — Liga- und Wettkampf-Verwaltung (Disziplinen, Teilnehmer,
  Matchups, Playoff, Auswertungen, Meyton-PDF-Import).
- **Treffsicher** — Trainings-App (Sessions, Serien, Reflexionen, Goals,
  Wellbeing-Tracking).

Ziel ist ein einzelner VPS, der beide Apps gemeinsam hostet, mit minimaler
Reibung beim Deploy und transparenten Backups. Seit der Monorepo-Migration
(ADR-015, [`monorepo-plan.md`](monorepo-plan.md)) leben beide Apps als `apps/*`
in diesem Repo; **dieses Spec beschreibt die Deploy-/Laufzeit-Architektur**, die
durch die Migration bewusst bit-gleich blieb.

## Anforderungen

### Funktional

1. Beide Apps unter eigenen Subdomains erreichbar (`ringwerk.<domain>`,
   `treffsicher.<domain>` — finale Namen sind Domain-Entscheidung des Users).
2. Automatische TLS-Zertifikate (Let's Encrypt), automatische Erneuerung.
3. Geteilter Postgres-Container, aber **getrennte Datenbanken + getrennte
   User**, damit Cross-DB-Zugriffe technisch unmöglich sind.
4. Persistente Volumes für Postgres-Daten und User-Uploads (Treffsicher:
   Bilder + PDFs; Ringwerk hat keine persistierten Uploads).
5. Zero-touch-Deploy: `docker compose pull && docker compose up -d` auf VPS,
   Migrationen laufen automatisch vor App-Start.
6. Backup beider DBs + Treffsicher-Upload-Volume per Cron, 14-Tage-Rolling
   lokal auf VPS.
7. Repeatable Restore (für initialen Cutover und Recovery).

### Nicht-funktional

- **Ressourcensparsam**: alles muss bequem auf einem 4-GB-RAM-VPS laufen
  (Steady-State-Schätzung: ~1.3 GB RAM, ~30 GB Disk in Jahr 1).
- **Reproduzierbar**: alles in Git, Secrets ausschließlich in `.env` auf VPS.
- **Schmaler Scope**: kein Web-UI für Proxy-Config, kein dediziertes
  Monitoring im MVP, keine CI im MVP.
- **Sicher by default**: DB nicht im Web-Netzwerk, kein Host-Portmapping für
  Postgres, NextAuth-Rate-Limit erkennt echte Client-IP über Proxy-Header.

### Image-Build & Distribution

- Images werden **lokal auf der Arbeitsmaschine des Maintainers** mit
  `docker buildx --platform linux/amd64` gebaut — **aus dem Monorepo** via
  `turbo prune <app> --docker` + dem parametrisierten Root-`Dockerfile`
  (Phase 3, ADR-015).
- Push in **Docker Hub** unter Account `<DOCKER_USER>`, **public** Images
  (Source ist sowieso public, keine Build-Time-Secrets injiziert).
- **Pro App zwei Images**, weil die `runner`-Stage bewusst kein Prisma-CLI
  enthält (nur Next.js standalone). Die Migrations laufen aus der separaten
  `migrator`-Stage (ADR-007):
  - `<user>/ringwerk:<sha>` + `:latest` (target=runner)
  - `<user>/ringwerk:<sha>-migrator` + `:latest-migrator` (target=migrator)
  - analog für treffsicher; `<sha>` ist der Monorepo-HEAD (beide Apps teilen ihn).
- Build-Aufruf gekapselt durch `./scripts/vereinsheim build` — exportiert
  `DOCKER_USER` aus `.vereinsheim.local`, ruft `scripts/build-and-push.sh`
  (prune + beide Targets pro App).

### Datenmigration

- Einmaliger Cutover via `pg_dump -Fc` + `tar` für Uploads.
- Selbe Mechanik wird als wiederkehrendes Backup wiederverwendet
  (`scripts/backup.sh` läuft via Cron).

## Architektur-Entscheidungen

Vollständige Begründungen mit verworfenen Alternativen → [`decisions.md`](decisions.md).
Kurzform:

| Bereich            | Wahl                                                |
| ------------------ | --------------------------------------------------- |
| Repo-Modell        | Code- + Deployment-Monorepo `vereinsheim` (ADR-015) |
| Container-Registry | Docker Hub, public Images                           |
| Reverse Proxy      | Caddy 2 (Caddyfile, kein Web-UI)                    |
| DB-Isolation       | 1 Postgres-Container, 2 DBs, 2 User                 |
| Migrations-Image   | Separate `migrator`-Stage, eigener Tag pro Build    |
| Datenmigration     | `pg_dump -Fc` Cutover, gleiche Mechanik als Backup  |
| Build-Ort          | Lokal (kein CI im MVP)                              |
| Operations-Tooling | Einheitliches `vereinsheim`-CLI (Lokal-/VPS-Mode)   |

## Zielarchitektur

```
Internet ──(443/80)── Caddy ─┬── ringwerk.<DOMAIN>     → app-ringwerk:3000
                             └── treffsicher.<DOMAIN>  → app-treffsicher:3000

Netzwerke:
  web   = caddy + app-ringwerk + app-treffsicher
  data  = db + apps + migrate-services      (DB nicht im web-Netzwerk!)

Services:
  caddy                caddy:2-alpine                    (TLS, Reverse Proxy)
  db                   postgres:15-alpine                (1 Container, 2 DBs, 2 User)
  migrate-ringwerk     <DOCKER_USER>/ringwerk:<sha>      (one-shot, prisma migrate deploy)
  migrate-treffsicher  <DOCKER_USER>/treffsicher:<sha>   (one-shot)
  app-ringwerk         <DOCKER_USER>/ringwerk:<sha>
  app-treffsicher      <DOCKER_USER>/treffsicher:<sha>

Volumes:
  postgres_data        → /var/lib/postgresql/data
  caddy_data           → /data        (LE-Zertifikate – kritisch!)
  caddy_config         → /config
  uploads_treffsicher  → /app/uploads (im treffsicher-Container)
```

**Begründung Netzwerk-Split**: Caddy braucht keinen DB-Zugriff. Liegt
`db` nur im `data`-Netz, ist sie auch bei Caddy-Compromise nicht direkt
erreichbar.

**Begründung 1 Container, 2 DBs**: Postgres skaliert problemlos auf
mehrere Datenbanken in einem Cluster. Zwei Container wären reine
RAM-Verschwendung (~250 MB extra) für Setup ohne Performance-Bedarf.
Owner-getrennte User stellen die Isolation sicher.

## App-Integration (Monorepo)

Ursprünglich lagen die Apps in eigenen Repos und brauchten nur minimale
Deploy-Anpassungen (env-Hinweise wie `AUTH_TRUST_PROXY_HEADERS=true` hinter dem
Reverse Proxy — beide lesen alle Knöpfe aus env vars, **kein Code-Patch**). Seit
der Monorepo-Migration (ADR-015) leben sie als [`apps/ringwerk`](../apps/ringwerk)
/ [`apps/treffsicher`](../apps/treffsicher) in diesem Repo (Git-History via
`git filter-repo` erhalten). Jede App behält ihr eigenes Prisma-Schema/
Migrations/`auth.ts`/`db.ts`; geteilte Dep-Versionen liegen im pnpm-Catalog.
Details & Phasen: [`monorepo-plan.md`](monorepo-plan.md).

## VPS-Sizing

Verbrauch in Production, basierend auf cgroup-Peak-Messungen vom
NAS-Staging-Setup (niedrig-Traffic-Vereinsbetrieb):

| Komponente              |     RAM (peak) | mem_limit | Disk        |
| ----------------------- | -------------: | --------: | ----------- |
| OS (Debian 12)          |         400 MB |         — | 5 GB        |
| Docker-Engine + Images  |              — |         — | 1 GB        |
| Caddy                   |       ~40 MB   |      64 M | —           |
| Postgres 15 (shared)    |       ~80 MB[^pg] |    384 M | 1–2 GB Data |
| Ringwerk (Next.js prod) |        158 MB  |     384 M | —           |
| Treffsicher (Next.js)   |        131 MB  |     384 M | —           |
| Migrations (one-shot)   |   ~150 MB peak |     256 M | —           |
| Uploads                 |              — |         — | 10–20 GB    |
| Backups (14-Tage)       |              — |         — | 5–10 GB     |

[^pg]: Idle ~80 MB. Realistischer Worst-Case mit shared_buffers (128 MB)
+ ~10 MB pro Connection × typisch 10–20 aktive Connections: 250–350 MB.

**Steady-State: ~0.9 GB RAM, ~25–40 GB Disk**. Limits summieren auf
~1.5 GB, plus OS ~400 MB → ~1.9 GB Spitze. Bei Deploy + 1× Migrate
kurzzeitig ~1.85 GB.

### IONOS-Empfehlung

| Tarif        | vCPU | RAM  | SSD    | Eignung                                                |
| ------------ | ---: | ---- | ------ | ------------------------------------------------------ |
| **VPS S**    |    2 | 2 GB | 80 GB  | **gewählt** — tragfähig dank hard mem_limits in [`compose.yml`](../compose.yml), ~400 MB Burst-Puffer |
| VPS S+/M     |    2 | 4 GB | 80 GB  | komfortabler, mehr Headroom für Wachstum               |
| VPS M+/L     |    4 | 8 GB | 160 GB | überdimensioniert, sinnvoll bei 3.+4. App              |

**RAM ist der Engpass**, nicht CPU. Image-Builds laufen lokal — kein
Build-RAM-Puffer auf VPS nötig. Die `mem_limit`-Einträge in `compose.yml`
sind die Schutzschicht gegen Runaway-Prozesse, die sonst den
geteilten DB-Container OOM-killen würden.

## Was NICHT im Scope (MVP)

- CI/CD (GitHub Actions). Nachrüsten möglich, sobald lokales Build-Skript
  stabil ist.
- Off-Site-Backup (S3/borg/NAS). Lokales Rolling-Backup deckt häufigsten
  Fall (versehentliches Löschen, Schema-Unfall) ab.
- Monitoring/Alerting (Prometheus, Uptime-Kuma).
- Staging-Umgebung. Initial nur Prod.
- WAF / Fail2ban. Caddy + NextAuth-Rate-Limit reichen als Baseline.

## Status

Die ursprünglich offenen Punkte (Domain + Subdomains, Docker-Hub-User,
VPS-Bestellung) sind **erledigt** — das System läuft seit Ende Mai 2026 produktiv
(alle Werte in `.env` auf dem VPS). Die laufende Weiterentwicklung (Monorepo)
steht in [`monorepo-plan.md`](monorepo-plan.md).
