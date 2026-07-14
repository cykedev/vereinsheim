---
id: operations
type: guide
title: "Operations — vereinsheim"
aliases: ["Operations — vereinsheim"]
keywords: [operations, vereinsheim]
part_of: ["[[overview]]"]
---

**TL;DR** `./scripts/vereinsheim` ist der zentrale Einstieg — auf der lokalen

# Operations — vereinsheim

> Praktische Anleitung für laufenden Betrieb: Deploy, Backup, Restore, und
> Recovery von fehlgeschlagenen Migrationen.

## Das Werkzeug: `./scripts/vereinsheim`

`./scripts/vereinsheim` ist der zentrale Einstieg — auf der lokalen
Arbeitsmaschine und auf dem VPS dasselbe Tool, mit zwei Modi, die sich
automatisch erkennen:

- **Lokal-Mode**: aktiv sobald `.vereinsheim.local` existiert. Bietet
  `build`, `release`, `ssh`, `remote`, `local-setup`.
- **VPS-Mode**: Default. Bietet alle Operations am Stack.

```bash
./scripts/vereinsheim              # Menü (Lokal- oder VPS-Mode automatisch)
./scripts/vereinsheim help         # alle Subcommands

# === Lokal-Mode ===
./scripts/vereinsheim local-setup  # einmalig: VPS_HOST, DOCKER_USER, …
./scripts/vereinsheim build        # buildx → Docker Hub
./scripts/vereinsheim release      # build + ssh-deploy
./scripts/vereinsheim ssh          # interaktive SSH-Shell zum VPS
./scripts/vereinsheim remote <subcmd>   # vereinsheim auf VPS

# === VPS-Mode ===
./scripts/vereinsheim status       # Services, Volumes, Backups, Cron, .env
./scripts/vereinsheim setup        # .env-Wizard, validiert, generiert Secrets
./scripts/vereinsheim env-check    # .env-Vollständigkeit
./scripts/vereinsheim deploy       # Pre-Backup + Pull + Up
./scripts/vereinsheim backup       # Backup jetzt
./scripts/vereinsheim restore      # interaktive Auswahl
./scripts/vereinsheim logs [svc]   # Logs folgen
./scripts/vereinsheim psql <app>   # psql-Shell
./scripts/vereinsheim migrations <app>   # Failed Migrations + Recovery
./scripts/vereinsheim cron         # Backup-Cron
./scripts/vereinsheim shell <svc>  # Shell im Container
./scripts/vereinsheim up | down | restart <svc>
```

**Konfigurations-Dateien** (beide gitignored):

| Datei                | Wo        | Wofür                                              |
| -------------------- | --------- | -------------------------------------------------- |
| `.env`               | VPS       | Postgres-Passwörter, NEXTAUTH_SECRET, Domain, etc. |
| `.vereinsheim.local` | lokal     | VPS_HOST (SSH-Ziel), VPS_REPO_PATH, DOCKER_USER    |

Die folgenden Abschnitte beschreiben **was technisch passiert**, damit du
auch ohne das Tool zurechtkommst (z.B. wenn das CLI selbst kaputt ist).

## Inhalt

- [Deploy](#deploy)
- [Backup](#backup)
- [Restore](#restore)
  - [Restore-Test](#restore-test-regelmäßig-empfohlen)
- [Recovery von fehlgeschlagenen Migrationen](#recovery-von-fehlgeschlagenen-migrationen)
- [Rollback](#rollback)

---

## Initial-Bootstrap eines neuen VPS

1. **VPS bestellen** (Debian 12 empfohlen, IONOS VPS S+/M).
2. **Als root einloggen**, einmalig laufen lassen:
   ```bash
   bash bootstrap-vps.sh "ssh-ed25519 AAAA... du@workstation" \
       "https://github.com/<user>/vereinsheim.git"
   ```
   Das Skript installiert Docker, erstellt einen `deploy`-User mit deinem
   SSH-Key, klont das Repo nach `~deploy/vereinsheim`. Firewall läuft
   nicht im OS — siehe ADR-014.
3. **Optional**: root-Login per SSH deaktivieren (Skript zeigt den Befehl).
4. Als `deploy`-User weitermachen:
   ```bash
   ssh deploy@vps
   cd ~/vereinsheim
   ./scripts/vereinsheim setup     # .env-Wizard
   ./scripts/vereinsheim cron      # Backup-Cron
   ```
5. **DNS-Records setzen** (A-Record für beide Subdomains → VPS-IP).
6. **Erster Deploy**: nach erfolgreichem lokalen Image-Build:
   ```bash
   ./scripts/vereinsheim deploy
   ```

## Deploy

### Standard-Flow

Lokal, ein Befehl:

```bash
./scripts/vereinsheim release
```

`release` führt aus:
1. `build-and-push.sh` (beide Apps, runner+migrator, → Docker Hub)
2. `ssh -t $VPS_HOST "cd $VPS_REPO_PATH && ./scripts/vereinsheim deploy"`
3. `vereinsheim deploy` auf dem VPS macht Pre-Backup → Pull → Up.

Bei Bedarf zerlegbar:

```bash
./scripts/vereinsheim build           # nur bauen+pushen
./scripts/vereinsheim remote deploy   # nur deployen (ohne neuen Build)
```

`scripts/deploy.sh` macht idempotent:

1. Pre-Deploy-Backup (siehe unten) — überspringbar mit `SKIP_BACKUP=1`
2. `docker compose pull` — neue Image-Tags ziehen
3. `docker compose up -d --remove-orphans` — geänderte Container neu starten,
   migrate-Container laufen automatisch vor App-Container
4. `docker image prune -f` — alte Images aufräumen

### Pre-Deploy-Backup (eingebaut)

`deploy.sh` ruft vor jedem Deploy automatisch `scripts/backup.sh` auf, wenn
der `db`-Service bereits läuft. Damit hast du **garantiert einen
Restore-Punkt** zum Zustand direkt vor dem Deploy.

Beim allerersten Deploy (db existiert noch nicht) wird das Backup übersprungen.

**Override** für Notfall-Redeploys (z.B. nach gescheiterter Migration, wenn
du erneut deployst, ohne dass sich der DB-State zwischendurch geändert hat):

```bash
SKIP_BACKUP=1 ./scripts/deploy.sh
```

### Was beim Deploy alles gestartet/erneuert wird

- `caddy` — nur wenn sich `Caddyfile` oder Image geändert hat
- `db` — bleibt, falls schon laufend (Postgres wird nicht ohne Grund
  durchgestartet)
- `migrate-ringwerk` / `migrate-treffsicher` — laufen JEDES Mal one-shot,
  weil `restart: "no"` und Container nach `up -d` neu erstellt werden
- `app-ringwerk` / `app-treffsicher` — neu, sobald `migrate-*` mit Code 0
  durch ist

Wenn `migrate-*` fehlschlägt, startet die zugehörige App **nicht**. Die
andere App ist davon nicht betroffen (eigener migrate-Container, eigene DB).

---

## Backup

### Was wird gesichert

`scripts/backup.sh` legt 3 Files in `${BACKUP_DIR:-/var/backups/vereinsheim}`
ab:

- `ringwerk-<TS>.dump` — Postgres custom-format Dump der `ringwerk`-DB
- `treffsicher-<TS>.dump` — analog
- `uploads-treffsicher-<TS>.tar.gz` — Inhalt des `uploads_treffsicher`-Volumes

Ringwerk hat keine persistierten Uploads und wird daher nicht archiviert.

Retention: 14 Tage rolling (`BACKUP_RETAIN_DAYS=14`, überschreibbar).

### Wann läuft Backup?

1. **Automatisch nightly** — Cron auf VPS, idempotent installierbar mit:
   ```bash
   ./scripts/vereinsheim cron
   ```
   Das schreibt einen Eintrag der Form
   `0 3 * * * /home/deploy/vereinsheim/scripts/backup.sh >> /var/log/vereinsheim-backup.log 2>&1`
   in die crontab des aktuellen Users (Default deploy). Der gleiche Befehl
   zeigt vorhandene Einträge an und bietet das Entfernen an.
2. **Automatisch vor jedem Deploy** — `vereinsheim deploy` ruft
   `backup.sh` selbst auf (außer `SKIP_BACKUP=1` ist gesetzt oder db läuft
   noch nicht).
3. **Manuell** — jederzeit `./scripts/vereinsheim backup`.

### Wo liegen die Backups

Default: `/var/backups/vereinsheim/`. Auf demselben VPS — daher gilt das
Backup nur als **Schutz vor Software-Fehlern**, nicht vor Hardware-Verlust.

**Off-Site-Backup ist explizit nicht im MVP-Scope.** Sinnvolle Erweiterungen:

- `rclone sync /var/backups/vereinsheim/ <remote>:<bucket>/` als Cron
- borg-Backup auf NAS
- IONOS Snapshot-Funktion (whole-VM, weniger granular)

---

## Restore

### Recovery aus Backup (gleicher VPS)

Bequemer Weg — `vereinsheim restore` führt durch App-Auswahl, listet die
zehn neuesten Dumps mit Größen, erkennt automatisch den passenden
Uploads-Tarball und stoppt/startet die App-Container vor und nach dem
Restore:

```bash
./scripts/vereinsheim restore
```

Direkt-Aufruf (für Skripte oder wenn das Tool nicht greifbar ist):

```bash
docker compose stop app-ringwerk migrate-ringwerk
./scripts/restore.sh ringwerk \
  /var/backups/vereinsheim/ringwerk-2026-05-10_0300.dump \
  /var/backups/vereinsheim/uploads-ringwerk-2026-05-10_0300.tar.gz
docker compose up -d migrate-ringwerk app-ringwerk
```

`restore.sh`:

1. Stellt sicher, dass `db` healthy läuft
2. Kopiert Dump in den db-Container
3. `pg_restore --clean --if-exists --no-owner --role=<app>`
4. Optional: extrahiert Uploads-Tar ins zugehörige Volume

### Restore-Test (regelmäßig empfohlen)

Mindestens **einmal pro Quartal** in einer Wegwerf-DB einen Restore testen,
um sicherzugehen, dass die Backups tatsächlich funktionieren:

```bash
# Wegwerf-DB anlegen, restoren, Tabellen zählen, wieder droppen
docker compose exec -T db psql -U postgres -c "CREATE DATABASE restore_test;"
docker compose cp /var/backups/vereinsheim/ringwerk-<TS>.dump db:/tmp/test.dump
docker compose exec -T db pg_restore -U postgres -d restore_test \
  --no-owner --role=postgres /tmp/test.dump
docker compose exec -T db psql -U postgres -d restore_test \
  -c "SELECT count(*) FROM \"User\";"
docker compose exec -T db psql -U postgres -c "DROP DATABASE restore_test;"
docker compose exec -T db rm /tmp/test.dump
```

---

## Recovery von fehlgeschlagenen Migrationen

### Hintergrund

Beide Apps fahren ihre Migrationen via `prisma migrate deploy` im jeweiligen
`migrate-<app>`-Container. Schlägt eine Migration fehl, bleibt in der
`_prisma_migrations`-Tabelle ein Eintrag mit `finished_at IS NULL` zurück.
**Prisma weigert sich danach, irgendeine weitere Migration zu fahren**, bis
dieser Zombie-Eintrag explizit aufgelöst ist (`migrate resolve --applied`
oder `--rolled-back`). Selbst wenn du die Migrations-SQL fixst, hilft ein
einfaches `migrate deploy` nicht weiter.

### Eingebauter Recovery-Mechanismus

Die Apps enthalten zwei zusammenwirkende Skripte (`apps/<app>/scripts/`):

- `scripts/run-migrations-with-recovery.sh` — versucht `migrate deploy`,
  ruft bei Fehler das Recovery-Skript, dann nochmal `deploy`.
- `scripts/resolve-failed-migrations.mjs` — liest failed migrations aus
  `_prisma_migrations`, entscheidet je nach Eintrag in der
  `KNOWN_RECOVERY_HANDLERS`-Tabelle automatisch.

In `compose.yml` von vereinsheim ist konfiguriert:

| Variable                                          | Wert    | Bedeutung                                                  |
| ------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS`           | `true`  | Recovery-Skript wird automatisch ausgeführt                |
| `PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS`   | `false` | Unbekannte Fehler stoppen den Deploy (manueller Eingriff)  |

Bewusst konservativ: bekannte Fälle heilen sich selbst, unbekannte halten
den Deploy auf, damit keine schweigende Datenkorruption passiert.

### Recovery-Pfade (in Reihenfolge der Wahrscheinlichkeit)

#### Pfad 1 — Auto-Recovery für bekannte Fälle (passiert von selbst)

`up -d` startet `migrate-<app>`, das Skript erkennt den failed-state, ruft
`prisma migrate resolve` für den Eintrag, und retried `migrate deploy`.
Logs:

```bash
docker compose logs migrate-ringwerk
```

Wenn dort am Ende `[migrate] Migrations are up to date.` steht, ist alles
gut, die App startet automatisch.

#### Pfad 2 — Neue Migration scheitert: Handler ergänzen

Wenn im Log eine unbekannte Migration als „Manual intervention required"
steht, du aber WEISST, was das Problem ist:

1. In `apps/<app>/scripts/resolve-failed-migrations.mjs` →
   `KNOWN_RECOVERY_HANDLERS`-Objekt erweitern. Modus:
   - `--applied` — DDL ist bereits in der DB vollzogen (z.B. Spalte
     existierte schon, Migration als „erledigt" markieren)
   - `--rolled-back` — Migration ist idempotent oder du hast den DB-State
     manuell aufgeräumt (Migration läuft beim nächsten Deploy sauber neu)
2. Mit aussagekräftigem Kommentar dokumentieren, warum dieser Modus
   gewählt wurde (siehe Beispiele in den existierenden Handlern).
3. Image neu bauen + pushen + deployen.

Dabei ist es **nicht** schlimm, dass `KNOWN_RECOVERY_HANDLERS` historische
Einträge ansammelt — der Handler greift nur, wenn die Migration im
failed-state ist. Bei einer frischen DB sind alle Handler no-ops.

#### Pfad 3 — Manueller Eingriff in der DB

Wenn der Fehler unklar ist:

**Diagnose:**

```bash
# Welche Migration hängt fest, mit Logs?
docker compose exec -T db psql -U postgres -d ringwerk -c \
  "SELECT migration_name, started_at, logs FROM _prisma_migrations \
   WHERE finished_at IS NULL AND rolled_back_at IS NULL;"

# Migrate-Container-Logs
docker compose logs migrate-ringwerk
```

**Dann eine von drei Entscheidungen:**

**A) DDL ist bereits durchgelaufen** (z.B. `CREATE TABLE` lief, nur die
nachgelagerte `INSERT INTO`-Zeile crashte und du hast sie manuell
gefixt):

```bash
docker compose run --rm migrate-ringwerk \
  node /app/node_modules/prisma/build/index.js migrate resolve \
    --applied <migration_name>
```

**B) DDL ist nicht oder nur teilweise durchgelaufen, soll sauber neu
laufen:**

```bash
# 1. DB-State manuell aufräumen
docker compose exec -T db psql -U postgres -d ringwerk -c "DROP TABLE IF EXISTS ...;"

# 2. Migration als zurückgerollt markieren
docker compose run --rm migrate-ringwerk \
  node /app/node_modules/prisma/build/index.js migrate resolve \
    --rolled-back <migration_name>

# 3. Neu deployen → Migration läuft sauber
SKIP_BACKUP=1 ./scripts/deploy.sh
```

**C) Migrations-SQL selbst ist falsch und muss korrigiert werden:**

1. In `apps/<app>/prisma/migrations/` die Migrations-SQL fixen, committen
2. DB-State manuell auf „vor der Migration" zurückbringen
3. Migration als `--rolled-back` markieren (siehe B, Schritt 2)
4. Image neu bauen + pushen + deployen → korrigierte SQL läuft

#### Pfad 4 — Restore aus Backup (Worst Case)

Wenn die DB in einem nicht mehr forward-reparierbaren Zustand ist:

```bash
docker compose stop app-ringwerk migrate-ringwerk
./scripts/restore.sh ringwerk /var/backups/vereinsheim/ringwerk-<TS>.dump
docker compose up -d migrate-ringwerk app-ringwerk
```

Das Pre-Deploy-Backup macht diesen Pfad unkompliziert: das letzte Backup ist
**direkt vor dem Deploy** entstanden, der den Schaden verursacht hat.

### Operative Empfehlungen

1. **Schema-Änderungen mit Datenmigration immer vorher lokal gegen eine
   restored Prod-Kopie testen**, nicht nur gegen eine leere Dev-DB. Das
   findet 80 % der „eine Spalte existierte schon"-Fälle ab.
2. **`PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS=true` nicht setzen.**
   Aktuell auf `false` → System fail-stops. Lieber 30 Min Downtime mit
   Mensch-im-Loop als eine Migration, die im Hintergrund die DB
   stillschweigend vermurkst.
3. **Beim Eintrag in `KNOWN_RECOVERY_HANDLERS` immer Begründung im
   Kommentar.** Sonst weiß in 6 Monaten niemand mehr, warum dieser Eintrag
   `--applied` markiert.

---

## Rollback

Wenn ein Deploy schief geht und du zurück willst:

### Variante A — Image-Tag-Rollback (Schema unverändert)

Wenn der Bug rein in der App liegt und die Migrations-Tabelle gleich
geblieben ist:

```bash
./scripts/vereinsheim rollback
```

Das Tool liest `logs/deploy-history.log` (eine Zeile pro
erfolgreichem Deploy), zeigt die letzten fünf Stände, schlägt den
vorherigen Eintrag als Ziel vor und schreibt nach Bestätigung die
vier Image-Tags zurück in die `.env`. Anschließend startet es
automatisch `deploy.sh` mit `SKIP_BACKUP=1` (der kaputte Stand soll
kein neues Backup erzeugen). `migrate deploy` ist no-op, da der
Schema-Stand bereits korrekt ist.

**Fallback** (z.B. wenn die History-Datei fehlt oder du auf einen
Tag rollen willst, der nicht in der History steht):

```bash
./scripts/vereinsheim setup     # Wahl 2: einzelne Werte bearbeiten
#  → RINGWERK_TAG = <vorherige-sha>
#  → RINGWERK_MIGRATOR_TAG = <vorherige-sha>-migrator
SKIP_BACKUP=1 ./scripts/vereinsheim deploy
```

(Vorherige SHAs findest du in Docker Hub unter
`<DOCKER_USER>/ringwerk/tags` oder via `git log` im Monorepo.)

### Variante B — Vollständiger Rollback inkl. DB

Wenn die neue Version eine destruktive Migration enthielt, reicht
das reine Tag-Rollback nicht — die DB ist schon im neueren
Schema-Stand. Reihenfolge:

```bash
./scripts/vereinsheim restore       # interaktiv: vorherigen Dump wählen
./scripts/vereinsheim rollback      # Tags auf vorherigen Stand zurück
```

Voraussetzung: Pre-Deploy-Backup hat funktioniert (= Default).
