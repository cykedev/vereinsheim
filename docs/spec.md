# Spec — vereinsheim

## Hintergrund

Die SG Taufkirchen betreibt zwei eigenständige Web-Apps:

- **Ringwerk** — Liga- und Wettkampf-Verwaltung (Disziplinen, Teilnehmer,
  Matchups, Playoff, Auswertungen, Meyton-PDF-Import).
- **Treffsicher** — Trainings-App (Sessions, Serien, Reflexionen, Goals,
  Wellbeing-Tracking).

Beide laufen heute getrennt (z.B. auf TrueNAS oder separat). Ziel ist ein
einzelner VPS, der beide Apps gemeinsam hostet, mit minimaler Reibung beim
Deploy und transparenten Backups.

## Anforderungen

### Funktional

1. Beide Apps unter eigenen Subdomains erreichbar (`ringwerk.<domain>`,
   `treffsicher.<domain>` — finale Namen sind Domain-Entscheidung des Users).
2. Automatische TLS-Zertifikate (Let's Encrypt), automatische Erneuerung.
3. Geteilter Postgres-Container, aber **getrennte Datenbanken + getrennte
   User**, damit Cross-DB-Zugriffe technisch unmöglich sind.
4. Persistente Volumes für Postgres-Daten und User-Uploads beider Apps
   (Ringwerk: Meyton-PDFs; Treffsicher: Bilder + PDFs).
5. Zero-touch-Deploy: `docker compose pull && docker compose up -d` auf VPS,
   Migrationen laufen automatisch vor App-Start.
6. Backup beider DBs + beider Upload-Volumes per Cron, 14-Tage-Rolling
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
  `docker buildx --platform linux/amd64` gebaut.
- Push in **Docker Hub** unter Account `<DOCKER_USER>`, **public** Images
  (Source ist sowieso public, keine Build-Time-Secrets injiziert).
- **Pro App zwei Images**, weil die `runner`-Stage in beiden App-Dockerfiles
  bewusst kein Prisma-CLI enthält (nur Next.js standalone). Die Migrations
  laufen aus der separaten `migrator`-Stage:
  - `<user>/ringwerk:<git-sha>` + `:latest` (target=runner)
  - `<user>/ringwerk:<git-sha>-migrator` + `:latest-migrator` (target=migrator)
  - analog für treffsicher
- Build-Aufruf gekapselt durch `./scripts/vereinsheim build` — exportiert
  `DOCKER_USER` aus `.vereinsheim.local`, ruft `scripts/build-and-push.sh`
  mit beiden Targets pro App.

### Datenmigration

- Einmaliger Cutover via `pg_dump -Fc` + `tar` für Uploads.
- Selbe Mechanik wird als wiederkehrendes Backup wiederverwendet
  (`scripts/backup.sh` läuft via Cron).

## Architektur-Entscheidungen

Vollständige Begründungen mit verworfenen Alternativen → [`decisions.md`](decisions.md).
Kurzform:

| Bereich            | Wahl                                                |
| ------------------ | --------------------------------------------------- |
| Deployment-Repo    | Eigenes Repo `vereinsheim`                          |
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
  uploads_ringwerk     → /app/uploads (im ringwerk-Container)
  uploads_treffsicher  → /app/uploads (im treffsicher-Container)
```

**Begründung Netzwerk-Split**: Caddy braucht keinen DB-Zugriff. Liegt
`db` nur im `data`-Netz, ist sie auch bei Caddy-Compromise nicht direkt
erreichbar.

**Begründung 1 Container, 2 DBs**: Postgres skaliert problemlos auf
mehrere Datenbanken in einem Cluster. Zwei Container wären reine
RAM-Verschwendung (~250 MB extra) für Setup ohne Performance-Bedarf.
Owner-getrennte User stellen die Isolation sicher.

## App-Repo-Anpassungen

Bewusst minimal — beide Apps lesen alle relevanten Knöpfe schon aus env vars:

### Ringwerk (`/Users/christian/repos/ringwerk`)

- `.env.example` ergänzen: Hinweis auf `AUTH_TRUST_PROXY_HEADERS=true`
  hinter Reverse Proxy.
- Optionale README-Sektion „Deployment via vereinsheim".
- **Kein Code-Patch nötig.**

### Treffsicher (`/Users/christian/repos/treffsicher`)

- Analog: `.env.example`-Hinweis.
- README-Ergänzung.
- Vorhandenes `docker-compose.prod.yml` bleibt im Repo als
  Standalone-Variante erhalten, wird im `vereinsheim`-Setup aber **nicht**
  verwendet.

## VPS-Sizing

Verbrauch in Production (Schätzung, niedrig-Traffic-Vereinsbetrieb):

| Komponente              |     RAM | Disk        |
| ----------------------- | ------: | ----------- |
| OS (Debian 12)          |  400 MB | 5 GB        |
| Docker-Engine + Images  |       — | 1 GB        |
| Caddy                   |   50 MB | —           |
| Postgres 15             |  250 MB | 1–2 GB Data |
| Ringwerk (Next.js prod) |  300 MB | —           |
| Treffsicher (Next.js)   |  300 MB | —           |
| Migrations (one-shot)   | ~150 MB peak | —      |
| Uploads                 |       — | 10–20 GB    |
| Backups (14-Tage)       |       — | 5–10 GB     |

**Steady-State: ~1.3 GB RAM, ~25–40 GB Disk**. Peaks bis ~2 GB RAM.

### IONOS-Empfehlung

| Tarif        | vCPU | RAM  | SSD    | Eignung                                                |
| ------------ | ---: | ---- | ------ | ------------------------------------------------------ |
| VPS S        |    1 | 2 GB | 40 GB  | zu knapp — kein Headroom, Peaks würden swappen         |
| **VPS S+/M** |    2 | 4 GB | 80 GB  | **empfohlen** — bequem, Reserven für Wachstum          |
| VPS M+/L     |    4 | 8 GB | 160 GB | überdimensioniert, sinnvoll bei 3.+4. App              |

**RAM ist der Engpass**, nicht CPU. Image-Builds laufen lokal — kein
Build-RAM-Puffer auf VPS nötig.

## Was NICHT im Scope (MVP)

- CI/CD (GitHub Actions). Nachrüsten möglich, sobald lokales Build-Skript
  stabil ist.
- Off-Site-Backup (S3/borg/NAS). Lokales Rolling-Backup deckt häufigsten
  Fall (versehentliches Löschen, Schema-Unfall) ab.
- Monitoring/Alerting (Prometheus, Uptime-Kuma).
- Staging-Umgebung. Initial nur Prod.
- WAF / Fail2ban. Caddy + NextAuth-Rate-Limit reichen als Baseline.

## Offene User-Entscheidungen

1. **Domain + Subdomains** (z.B. `ringwerk.<domain>`, `training.<domain>`).
2. **Docker-Hub-User** (vermutlich `christianeiden`).
3. **VPS-Bestellung** (Empfehlung: IONOS VPS S+/M, Debian 12).

Diese Punkte blocken die Implementierung des Repos **nicht** — werden am
Schluss in `.env` eingetragen.
