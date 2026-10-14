# Spiegel: Image und Stack (P3, SP-1.9 a1)

## Kontext

Spiegel ist fertig für den ersten Betrieb (Opt-in mit erster Scheibe, Papierkorb, ältere Scheiben, verständliche Texte,
alles auf `main`). Es fehlt der Betrieb: Spiegel hat noch kein Image, keinen Platz in `compose.yml` und keine
Subdomain. Zuschnitt aus der Bestandsaufnahme vom 14. Oktober 2026 (SP-1.9 in [[spiegel-roadmap]]):

- **P3 (dieser Plan):** Image, Stack, Datenbank, Caddy, lokal Ende zu Ende geprüft.
- P4: CLI für drei Apps (`status`, `logs`, `psql`, `env-check`, `setup`, `rollback`, `local-*`), Deploy nacheinander,
  Backup und Restore mit Probe, Doku unter `vault/operations`.
- P5: erster Deploy als Runbook mit fertigen Befehlen für den User.

Teil 2 des Textbuchs entfällt (User, 14. Oktober 2026: „bei der scheibe ist alles gut und verständlich“).

Befunde der Bestandsaufnahme, die dieser Plan löst:

- Das Root-`Dockerfile` kopiert fest `apps/<app>/public` und `apps/<app>/scripts/run-migrations-with-recovery.sh`.
  Beides fehlt in Spiegel, das Image lässt sich nicht bauen.
- Die 256-MB-Messung lief mit dem Standalone-Build in `node:24-alpine`, nicht mit dem echten Image.
- `X-Real-IP` setzt Caddy seit P0 selbst (`proxy_real_ip`, [[caddy-x-real-ip-passthrough]]). Spiegel braucht denselben
  Import, bevor `AUTH_TRUST_PROXY_HEADERS=true` gilt.
- Der Ingest-Endpunkt nimmt einen Stapel bis 4 MiB (`MAX_SNAPSHOTS_BYTES`). Caddy braucht eine passende Grenze.
- Auf dem VPS läuft Postgres schon mit zwei Datenbanken. `db-init` läuft nur bei einem frischen Volume, die dritte
  Datenbank braucht einen eigenen, wiederholbaren Schritt.

**Modus:** Alles hier liegt in geschützten Pfaden (`Dockerfile`-Vertrag, `compose.yml`, `Caddyfile`, `db-init/`,
`scripts/`). Die Umsetzung läuft deshalb **interaktiv** ohne Autopilot-Markierung: Task für Task, jede Commit-Message
vorher als fenced Block. Nichts davon geht auf den VPS; Push und VPS bleiben beim User (P5).

## Entscheidungen

- **D1 Namen wie bei den anderen Apps** ([[adr-002]], [[adr-003]], [[adr-007]], [[adr-026]]): Datenbank und Owner
  `spiegel`, Dienste `migrate-spiegel` (Netz `data`) und `app-spiegel` (Netze `web` und `data`), Images
  `<DOCKER_USER>/spiegel:<sha>` und `:latest`, `:<sha>-migrator` und `:latest-migrator`, Variablen mit `SPIEGEL_`,
  lokaler Port 3002 wie im Dev.
- **D2 Speicher:** `app-spiegel` `mem_limit: 256m` (Ziel aus SP-1.9, gemessen 147 bis 152 MiB unter Last) mit
  Heap-Grenze, `migrate-spiegel` `192m` wie die anderen Migratoren (D8). Gemessen wird im echten Image (T9).
- **D3 Caddy:** Block `{$SPIEGEL_HOST}` wie die anderen (`encode`, `import proxy_real_ip`), `request_body max_size 5MiB`.
  Das liegt knapp über der Grenze der App (4 MiB): Ein etwas zu großer Stapel bekommt die JSON-Antwort `too-large` der
  App, die die Brücke versteht. Alles darüber hält Caddy auf. Spiegel hat heute keinen Upload über Server Actions. Mit dem
  QR-Weg (SP-1.7 b) wird die Grenze neu angesehen. `AUTH_TRUST_PROXY_HEADERS: "true"` an `app-spiegel`.
- **D4 Dockerfile bleibt, wie es ist.** Spiegel bekommt die zwei Dinge, die der Vertrag verlangt:
  - `apps/spiegel/public/.gitkeep` (leerer Ordner für die `COPY`-Zeile);
  - `apps/spiegel/scripts/run-migrations-with-recovery.sh`, gleicher Name, aber nur `prisma migrate deploy`. Spiegel
    hat bis zum ersten Deploy genau eine Migration. Eine Wiederherstellung wie in Ringwerk und Treffsicher kommt erst,
    wenn eine Migration in Produktion scheitert. Darum `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS: "false"` im Dienst.
  So bleiben die Images von Ringwerk und Treffsicher bit-gleich.
- **D5 Datenbank anlegen, zwei Wege:**
  - `db-init/01-users-and-dbs.sh` legt bei einem frischen Volume alle drei an (verlangt `SPIEGEL_DB_PASSWORD`).
  - Neu `scripts/db-ensure.sh` für ein laufendes System, aufgerufen über `vereinsheim db-ensure` (VPS-Modus, Muster:
    Vorbedingungen prüfen, bestätigen, Skript aufrufen). Für jede App mit Passwort in der `.env`: Rolle und Datenbank
    anlegen, wenn sie fehlen (`\gexec`), `REVOKE ALL … FROM PUBLIC`. Eine vorhandene Rolle ändert das Skript nie; es
    prüft nur die Anmeldung mit dem Passwort aus der `.env` und bricht mit Hinweis ab, wenn sie nicht klappt. Das
    Passwort geht über die Umgebung in den Container und dort per `\getenv` an psql, nie über die Kommandozeile.
- **D6 Lokal Ende zu Ende als wiederholbares Werkzeug** unter `tools/stack-e2e/` (nicht geschützt, für P4 und P5
  wiederverwendbar): eigenes Compose-Projekt `vereinsheim-e2e`, eigene Images (`DOCKER_USER=vereinsheim-e2e`), eine
  Wegwerf-`.env` mit Zufallswerten im Temp-Ordner. Es fasst die `.env.local`, die Volumes und die Images des Users nicht
  an. Caddy hört auf Ports statt Hosts (`RINGWERK_HOST=:8080`, `TREFFSICHER_HOST=:8081`, `SPIEGEL_HOST=:8082`), so geht
  es ohne DNS und TLS. `compose.e2e.yml` setzt die Ports mit `!reset` neu: Caddy `18080`–`18082`, Postgres `15432`, die
  Apps ohne eigene Ports. Die Werkzeuge der App nehmen `BASE_URL` und `DATABASE_URL` aus der Umgebung:
  `ingest-load` kann das schon, `bridge-e2e` lernt es.
- **D7 Zuschnitt gegen P4:** Das CLI bekommt hier nur `db-ensure` und die Texte zu `build`/`local-build` (drei Apps,
  sechs Images). `deploy.sh` bleibt (alles auf einmal, Historie nur Ringwerk und Treffsicher), `backup.sh`,
  `restore.sh`, `env-check`, `setup`, `status`, `rollback`, `local-*` kommen in P4. Bis P4 gemergt ist, wird nichts
  deployt.

- **D8 Grenzen aller Dienste** (User, 14. Oktober 2026: „prüfe noch, ob die zugewiesenen ressourcen für die anderen
  anwendungen so passen oder kleiner werden können“). Gemessen lokal mit den echten Images (Bericht T9):
  - Ringwerk und Treffsicher brauchen nach dem Start rund 80 MiB, unter Last (Anmeldeseite) 100 bis 110 MiB. Die Spitze
    von 155 bis 163 MiB fällt in den Start. Mit 192, 256 und 384 MB lief jede ohne Abbruch.
  - Ein Migrator braucht beim Aufbau einer leeren Datenbank höchstens 130 MiB.
  - Node 24 setzt den Heap bei 192, 256 und 384 MB Container-Grenze auf 259 MiB. Unter 384 MB räumt V8 also nicht
    früher auf, der Kernel beendet die App zuerst. Deshalb kommt zur Grenze immer eine Heap-Grenze.
  - Auf dem VPS (14. Oktober 2026, vom User gemessen; die Container laufen seit dem 5. Oktober, also neun Tage):

    | Dienst | jetzt (Programm, Cache) | Spitze seit Start | Grenze |
    | --- | ---: | ---: | ---: |
    | Ringwerk | 155 MiB (146, 1) | 188 MiB | 384 MB |
    | Treffsicher | 141 MiB (129, 4) | 163 MiB | 384 MB |
    | Caddy (seit 14. Oktober) | 35 MiB (25, 9) | 44 MiB | 64 MB |
    | Postgres | 54 MiB (4, 48) | 96 MiB | 384 MB |

    RAM 1.870 MiB, belegt 890, verfügbar 980; die Container zusammen rund 385 MiB, für System und Docker also rund
    500 MiB. Kein Swap, kein Container mit `OOMKilled`, keine Neustarts, keine OOM-Meldung im Kernel.

  Neue Grenzen: `app-ringwerk`, `app-treffsicher`, `app-spiegel` je `mem_limit: 256m` mit `NODE_OPTIONS:
  "--max-old-space-size=160"`; alle drei Migratoren `192m`; Caddy `64m` und Postgres `384m` bleiben (Postgres trägt
  drei Datenbanken mit eigenen Verbindungen, fällt es aus, stehen alle Apps). Die Summe der Grenzen sinkt mit Spiegel
  von 1.472 auf 1.216 MiB, beim Deploy mit einem Migrator von 1.728 auf 1.408 MiB. Neben System und Docker sind rund
  1.370 MiB frei: Selbst wenn alle Dienste an ihre Grenze gingen, passt es außerhalb eines Deploys.

  **Nach dem Review (14. Oktober 2026):** Treffsicher bekommt `320m` mit `--max-old-space-size=192`. Uploads bis
  10 MB (Server Actions bis 12 MB) und der Meyton-Import mit pdf.js laufen im Prozess, und ob sie in den neun Tagen auf
  dem VPS vorkamen, ist unbekannt. Summe 1.280 MiB. Beim Deploy starten mit dem heutigen `deploy.sh` alle drei
  Migratoren gleichzeitig (Grenzen 1.856 MiB, real je höchstens 130 MiB), nacheinander erst mit P4.

  **Bedingung erfüllt:** Die Spitzen seit dem Start liegen bei Ringwerk (188 MiB) und Treffsicher (163 MiB) unter
  200 MiB, gezählt samt Cache. Bis 256 MB bleiben 68 bzw. 93 MiB Luft. Eine Swap-Datei als Sicherheitsnetz kommt als
  Empfehlung ins Runbook (P5, [[adr-026]] nennt sie als Option).

## Nicht in diesem Plan

- PDF-Volume (kommt mit dem QR-Weg), Off-Site-Backup, Selbst-Hosting-Beispiel (SP-1.9 b).
- Das Drift-Gate `consistency-check.sh` bleibt bei Ringwerk × Treffsicher (Spiegel ist ausgenommen, ADR-030).
- `.env.local` des Users: Die neuen Schlüssel trägt der User selbst ein (Liste am Ende von T6).
- Für das Runbook (P5): Der nächste Release ohne `APPS` legt das Repository `<DOCKER_USER>/spiegel` auf Docker Hub
  an (Review: nicht erst in P5). Danach prüfen, dass es öffentlich ist; der VPS holt die Images ohne Anmeldung
  ([[adr-005]]). Bis Spiegel auf dem VPS bereit ist, Hotfixes mit `APPS="ringwerk treffsicher"`, und auf dem VPS kein
  `git pull` dieses Stands, bevor das Image öffentlich auf Docker Hub liegt: Sonst scheitert `docker compose pull` bei
  jedem Deploy.

## Required Docs

- `CLAUDE.md` (Abschnitt „Wenn du etwas änderst“: Prüfbefehle für Skripte, Compose, Caddyfile)
- `vault/decisions/adr-002.md`, `adr-003.md`, `adr-005.md`, `adr-007.md`, `adr-026.md`
- `vault/spiegel/spiegel-roadmap.md` (SP-1.9), `vault/incidents/caddy-x-real-ip-passthrough.md`
- `apps/spiegel/CLAUDE.md` (Speicher im Container messen, Befehle `ingest-load` und `bridge-e2e`)
- `vault/architecture/architecture.md` (Build & Deploy)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/public/.gitkeep`, `apps/spiegel/scripts/run-migrations-with-recovery.sh` | T1: neu (D4) |
| `scripts/build-and-push.sh`, `scripts/vereinsheim` (`cmd_build`, `cmd_local_build`, Hilfe) | T2: drei Apps |
| `db-init/01-users-and-dbs.sh` | T3: dritte Datenbank |
| `compose.yml`, `vault/operations/vps-resource-sizing.md`, `vault/overview.md` | T4: `db`-Umgebung, `caddy`-Umgebung, `migrate-spiegel`, `app-spiegel`, Grenzen aller Dienste (D8) |
| `Caddyfile` | T5: Block für Spiegel |
| `.env.example`, `compose.local.yml` | T6 |
| `scripts/db-ensure.sh` (neu), `scripts/vereinsheim` (`cmd_db_ensure`, Hilfe, Dispatch) | T7 |
| `tools/stack-e2e/run.sh`, `tools/stack-e2e/compose.e2e.yml`, `tools/stack-e2e/README.md` (neu), `apps/spiegel/tools/bridge-e2e.ts`, `apps/spiegel/tools/stack-probe.ts` (neu, bei der Umsetzung ergänzt: die Grenzen hinter Caddy mit den Funktionen der App statt in Bash) | T8 |
| `reports/2026-10-14-spiegel-stack.md` | T9: Bericht der Prüfung |
| `vault/architecture/architecture.md`, `vault/decisions/adr-002.md`, `adr-003.md`, `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-roadmap.md` | T10 |

## Aufgaben

1. **T1 Spiegel baubar machen.** `apps/spiegel/public/.gitkeep` anlegen. `apps/spiegel/scripts/run-migrations-with-recovery.sh`
   (ausführbar, `git update-index --chmod=+x`):
   ```sh
   #!/bin/sh
   # Spiegel: nur `prisma migrate deploy`. Bis zum ersten Deploy gibt es genau eine Migration (…_init); eine
   # Wiederherstellung wie in Ringwerk und Treffsicher kommt erst, wenn eine Migration in Produktion scheitert.
   # Der Name ist der Vertrag des Root-Dockerfiles (Ziel `migrator`).
   set -eu
   echo "[migrate] Running prisma migrate deploy..."
   exec node /app/node_modules/prisma/build/index.js migrate deploy
   ```
   Prüfen: `bash -n`, `pnpm exec turbo prune spiegel --docker` und `ls out/full/apps/spiegel/public out/full/apps/spiegel/scripts`
   (beide da), danach `rm -rf out`.
2. **T2 Build für drei Apps.** In `build-and-push.sh` `build_app spiegel` nach Treffsicher, Kopfkommentar „Build + Push
   der Apps (Ringwerk, Treffsicher, Spiegel)“, Ausgabe am Ende um die zwei Spiegel-Zeilen ergänzt, Filter
   `(ringwerk|treffsicher|spiegel)`. Im CLI: `cmd_local_build` „Baut alle 6 Images“, `cmd_build` „Build + Push aller
   Apps“, Hilfetext entsprechend. Prüfen: `bash -n` beider Dateien, dann
   `PUSH=0 DOCKER_USER=vereinsheim-e2e ./scripts/build-and-push.sh` → sechs Images (`docker images --filter
   reference='vereinsheim-e2e/*'`, Größen in den Bericht).
3. **T3 `db-init`:** `: "${SPIEGEL_DB_PASSWORD:?…}"`, `CREATE USER spiegel …`, `CREATE DATABASE spiegel OWNER spiegel`,
   `REVOKE ALL ON DATABASE spiegel FROM PUBLIC`, Meldung „ringwerk, treffsicher + spiegel“. Prüfen: `bash -n`; die
   Wirkung prüft T9 auf einem frischen Volume.
4. **T4 `compose.yml`:** `db.environment.SPIEGEL_DB_PASSWORD`, `caddy.environment.SPIEGEL_HOST`, dazu:
   ```yaml
   migrate-spiegel:
     image: ${DOCKER_USER}/spiegel:${SPIEGEL_MIGRATOR_TAG:-latest-migrator}
     restart: "no"
     pull_policy: always
     environment:
       DATABASE_URL: postgresql://spiegel:${SPIEGEL_DB_PASSWORD}@db:5432/spiegel
       PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS: "false"
     depends_on: { db: { condition: service_healthy } }
     mem_limit: 192m
     logging: *default-logging
     networks: [data]

   app-spiegel:
     image: ${DOCKER_USER}/spiegel:${SPIEGEL_TAG:-latest}
     restart: unless-stopped
     pull_policy: always
     environment:
       DATABASE_URL: postgresql://spiegel:${SPIEGEL_DB_PASSWORD}@db:5432/spiegel
       NEXTAUTH_SECRET: ${SPIEGEL_NEXTAUTH_SECRET}
       NEXTAUTH_URL: https://${SPIEGEL_HOST}
       SEED_ADMIN_EMAIL: ${SPIEGEL_SEED_ADMIN_EMAIL}
       SEED_ADMIN_PASSWORD: ${SPIEGEL_SEED_ADMIN_PASSWORD}
       DISPLAY_TIME_ZONE: ${DISPLAY_TIME_ZONE:-Europe/Berlin}
       AUTH_TRUST_PROXY_HEADERS: "true"
       NODE_OPTIONS: "--max-old-space-size=160"
     depends_on:
       db: { condition: service_healthy }
       migrate-spiegel: { condition: service_completed_successfully }
     mem_limit: 256m
     logging: *default-logging
     networks: [web, data]
   ```
   (im Stil der Datei ausgeschrieben, nicht in Flow-Syntax). Dazu die Grenzen aus D8: `app-ringwerk` und
   `app-treffsicher` `mem_limit: 256m`, alle drei App-Dienste `NODE_OPTIONS: "--max-old-space-size=160"`, die drei
   Migratoren `mem_limit: 192m`; `vault/operations/vps-resource-sizing.md` und die Tabelle in `vault/overview.md` mit
   den neuen Grenzen und Messwerten. Prüfen: `docker compose --env-file .env.example config --quiet` und dasselbe mit
   `-f compose.yml -f compose.local.yml`.
5. **T5 Caddyfile:** Block `{$SPIEGEL_HOST}` mit `encode zstd gzip`, `request_body { max_size 5MiB }`,
   `reverse_proxy app-spiegel:3000 { import proxy_real_ip }`, ein Satz Kommentar zur Grenze (D3). Prüfen:
   `docker run --rm -e ACME_EMAIL=a@example.com -e RINGWERK_HOST=r.example.com -e TREFFSICHER_HOST=t.example.com
   -e SPIEGEL_HOST=s.example.com -v $PWD/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --adapter
   caddyfile --config /etc/caddy/Caddyfile`.
6. **T6 `.env.example` und `compose.local.yml`.** `.env.example`: `SPIEGEL_HOST=spiegel.example.com`, `SPIEGEL_TAG`,
   `SPIEGEL_MIGRATOR_TAG`, `SPIEGEL_DB_PASSWORD`, Abschnitt „Spiegel“ mit `SPIEGEL_NEXTAUTH_SECRET`,
   `SPIEGEL_SEED_ADMIN_EMAIL`, `SPIEGEL_SEED_ADMIN_PASSWORD` (Hinweis: mindestens 12 Zeichen), „Alle Apps gemeinsam“.
   `compose.local.yml`: `app-spiegel` mit `pull_policy: missing`, `ports: ["3002:3000"]`, `NEXTAUTH_URL:
   "http://localhost:3002"`, `AUTH_TRUST_PROXY_HEADERS: "false"`; `migrate-spiegel` mit `pull_policy: missing`. Prüfen wie
   T4. Am Ende die Liste der Schlüssel für die `.env.local` des Users (ohne Werte) in den Bericht.
7. **T7 `db-ensure`.** `scripts/db-ensure.sh` (`set -euo pipefail`, `cd` ins Repo):
   - liest `ENV_FILE` (Vorgabe `.env`) zeilenweise per `grep -m1 '^<KEY>='` (kein `source`), spricht Postgres über
     `docker compose --env-file "$ENV_FILE" exec -T db` an: im Container als `postgres` über den lokalen Socket, ohne
     Passwort; `COMPOSE_PROJECT_NAME` und `COMPOSE_FILE` wirken wie bei Compose üblich;
   - bricht ab, wenn der Dienst `db` nicht läuft;
   - je App aus `ringwerk treffsicher spiegel`, deren `<APP>_DB_PASSWORD` in der Datei steht: `APP_PW="$pw" docker
     compose … exec -T -e APP_PW db psql -v ON_ERROR_STOP=1 -v app=<name> -U postgres -d postgres` (`-e APP_PW` ohne
     Wert übernimmt die Variable aus der Umgebung, das Passwort steht in keiner Kommandozeile) und Skript über stdin:
     ```sql
     \getenv app_pw APP_PW
     SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app', :'app_pw')
       WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app') \gexec
     SELECT format('CREATE DATABASE %I OWNER %I', :'app', :'app')
       WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'app') \gexec
     SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app') \gexec
     ```
     danach die Anmeldung prüfen, ebenso ohne Kommandozeile: `PGPASSWORD="$pw" docker compose … exec -T -e PGPASSWORD
     db psql -h 127.0.0.1 -U <app> -d <app> -c 'select 1'`; scheitert sie, Abbruch mit „Rolle <app> gibt es, das
     Passwort aus der .env passt nicht.“;
   - meldet je App „angelegt“ oder „war schon da“.
   Im CLI `cmd_db_ensure` (VPS-Modus): `.env` da, `db` läuft, Bestätigung, dann das Skript; Eintrag in Hilfe und
   Dispatch. Prüfen: `bash -n`, Wirkung in T9 (zweimal hintereinander, einmal nach Entfernen der Datenbank `spiegel`).
8. **T8 Werkzeug `tools/stack-e2e/`.**
   - `compose.e2e.yml`: Ports mit `!reset` (D6), `NEXTAUTH_URL` der drei Apps auf `http://localhost:1808x`,
     `pull_policy: never` für die sechs App-Dienste.
   - `run.sh [--keep]`: schreibt eine Wegwerf-Umgebung `stack.env` in `mktemp -d` (Passwörter und Secrets per
     `openssl rand`, `DOCKER_USER=vereinsheim-e2e`, Hosts als Ports), baut mit `PUSH=0` (T2), startet `docker compose -p
     vereinsheim-e2e -f compose.yml -f tools/stack-e2e/compose.e2e.yml --env-file … up -d`, wartet auf die drei Apps
     (HTTP-Antwort unter 500 auf `/`), gibt Adressen, den Pfad der `stack.env` und die E-Mail des Seed-Admins aus (keine
     Passwörter in der Ausgabe); ohne `--keep` am Ende `down -v` und Löschen des Temp-Ordners. Die Prüfungen aus T9
     stehen als Funktionen im Skript, soweit sie ohne Browser gehen.
   - `README.md`: Zweck, Aufruf, was es nicht anfasst.
   - `bridge-e2e.ts`: mit `BASE_URL` kein eigener Server, die Brücke koppelt gegen diese Adresse; mit `DATABASE_URL`
     diese Datenbank statt `DEV_DATABASE_URL`. Kopf-Kommentar ergänzt.
   Prüfen: `bash -n`, `docker compose … config --quiet` mit der Wegwerf-`.env`, `pnpm check`.
9. **T9 Ende zu Ende (lokal, `tools/stack-e2e/run.sh --keep`).** Bericht `reports/2026-10-14-spiegel-stack.md` mit den
   Ausgaben:
   - frisches Volume: `\l` zeigt drei Datenbanken mit eigenem Owner, `PUBLIC` ohne Rechte;
   - `migrate-spiegel` endet mit 0, `app-spiegel` läuft, `/login` über Caddy (`:18082`) antwortet; Ringwerk (`:18080`)
     und Treffsicher (`:18081`) antworten weiter;
   - `X-Real-IP`: fehlgeschlagene Anmeldung über Caddy mit `X-Real-IP: 203.0.113.7` → in `"LoginRateLimitBucket"` kein
     Schlüssel `ip:203.0.113.7`;
   - Grenze: 4,5 MiB an `/api/ingest/v1/snapshots` → 413 als JSON der App (`too-large`); 6 MiB → 413 von Caddy;
   - `db-ensure`: zweimal hintereinander „war schon da“; nach `DROP DATABASE spiegel` und `DROP ROLE spiegel` (App
     gestoppt) „angelegt“, danach `migrate-spiegel` und `app-spiegel` wieder grün;
   - Brücke: `BASE_URL=http://localhost:18082 DATABASE_URL=… pnpm --filter spiegel bridge-e2e` grün;
   - Speicher: `docker stats --no-stream` nach dem Start, dann `BASE_URL=… DATABASE_URL=… pnpm --filter spiegel
     ingest-load --minutes 5 --docker vereinsheim-e2e-app-spiegel-1`; Spitze unter 256 MiB; danach für alle Dienste
     `memory.peak` und `OOMKilled=false` (Grenzen aus D8), dazu die lokale Messung aus D8 und die Zahlen vom VPS;
   - Browser (Hintergrund-Tab): Anmeldung mit dem Seed-Admin der Wegwerf-`.env` über `http://localhost:18082`, Start lädt,
     keine Konsolenfehler.
   Danach `docker compose -p vereinsheim-e2e down -v` und die `vereinsheim-e2e/*`-Images löschen.
10. **T10 Doku.** `architecture.md` (Build & Deploy: drei Apps, Caddy mit drei Subdomains, Netze, DB mit drei Owner),
    `adr-002.md` und `adr-003.md` je eine Zeile „Seit SP-1.9: dritte App Spiegel ([[adr-026]])“ ohne Änderung der
    Entscheidung, `apps/spiegel/CLAUDE.md` (Deploy-Vertrag steht, lokal prüfen mit `tools/stack-e2e`), Roadmap SP-1.9
    (a1 erledigt, offen P4 und P5). `/sync-graph` am Ende.

## Testschritte

- Je Task die Prüfbefehle aus CLAUDE.md: `bash -n` für jedes geänderte Skript, `docker compose … config --quiet` für
  Compose, `caddy validate` für das Caddyfile.
- `pnpm check` grün vor jedem Commit (Gate aus der Repo-Wurzel, Node 24).
- T9 als Ende-zu-Ende-Prüfung mit den Ausgaben im Bericht; was nicht geht, steht dort als „nicht belegt“.

## Verifikation

Bericht `reports/2026-10-14-spiegel-stack.md` (T9), danach `/review` gegen `main`. Merge durch den User. Danach P4.
