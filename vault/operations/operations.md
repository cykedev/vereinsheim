---
id: operations
type: guide
title: "Operations — vereinsheim"
aliases: ["Operations — vereinsheim"]
keywords: [operations, betrieb, vereinsheim, cli, deploy, backup, restore, rollback, migrationen, recovery, vps, bootstrap, brücke]
part_of: ["[[overview]]"]
---

**TL;DR** `./scripts/vereinsheim` ist der zentrale Einstieg für den Betrieb, lokal und auf dem VPS: Bootstrap, Deploy, Backup, Restore, Rollback und Recovery fehlgeschlagener Migrationen. Die Brücke von Spiegel läuft im Schützenhaus und wird separat installiert.

# Operations — vereinsheim

> Praktische Anleitung für den laufenden Betrieb: Bootstrap, Deploy, Backup, Restore, Rollback und Recovery von
> fehlgeschlagenen Migrationen.

## Das Werkzeug: `./scripts/vereinsheim`

`./scripts/vereinsheim` ist der zentrale Einstieg — auf der lokalen
Arbeitsmaschine und auf dem VPS dasselbe Tool, mit zwei Modi, die sich
automatisch erkennen:

- **Lokal-Mode**: aktiv sobald `.vereinsheim.local` existiert. Bietet `local-setup`, `build`, `release`, `ssh`,
  `remote`, `upload`, `download`, den lokalen Prod-Stack (`local-build`, `local-pull`, `local-up`, `local-down`) und
  `dev-restore`. `dev-setup` läuft auch ohne `.vereinsheim.local` (frischer Clone).
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
./scripts/vereinsheim upload <datei>     # Datei(en) → VPS ~/migration/
./scripts/vereinsheim download [datei]  # Backup ← VPS (ohne Argument: Liste)
./scripts/vereinsheim local-pull   # Backups + Image-Tags vom VPS → ./backups/
./scripts/vereinsheim local-up [--restore]   # Prod-Stack lokal (braucht .env.local)
./scripts/vereinsheim dev-restore [app]      # Prod-Dump aus ./backups/ → Dev-DB

# === VPS-Mode ===
./scripts/vereinsheim status       # Services, Volumes, Backups, Cron, .env
./scripts/vereinsheim setup        # .env-Wizard nach .env.example; „Fehlende Schlüssel ergänzen“
./scripts/vereinsheim env-check    # .env-Vollständigkeit (Exit 1 bei fehlenden Schlüsseln)
./scripts/vereinsheim deploy       # Vorprüfung + Pre-Backup + Pull + je App nacheinander
./scripts/vereinsheim backup       # Backup jetzt
./scripts/vereinsheim restore      # interaktive Auswahl
./scripts/vereinsheim rollback     # auf den vorigen Deploy zurück
./scripts/vereinsheim restore-probe   # neueste Dumps probeweise in Wegwerf-DBs
./scripts/vereinsheim db-ensure    # fehlende App-Datenbanken anlegen (laufendes System)
./scripts/vereinsheim logs [svc]   # Logs folgen
./scripts/vereinsheim psql <app>   # psql-Shell
./scripts/vereinsheim migrations <app>   # Failed Migrations + Recovery
./scripts/vereinsheim cron         # Backup-Cron
./scripts/vereinsheim shell <svc>  # Shell im Container
./scripts/vereinsheim up | down | restart <svc>
```

**Konfigurations-Dateien** (alle gitignored):

| Datei                | Wo        | Wofür                                              |
| -------------------- | --------- | -------------------------------------------------- |
| `.env`               | VPS       | Postgres-Passwörter, NEXTAUTH_SECRET, Domain, etc. |
| `.vereinsheim.local` | lokal     | VPS_HOST (SSH-Ziel), VPS_REPO_PATH, DOCKER_USER    |
| `.env.local`         | lokal     | Platzhalter für den lokalen Stack; `local-pull` und `local-up` ergänzen fehlende Schlüssel |

Die Apps stehen an einer Stelle, `scripts/lib/apps.sh` (`APPS=(ringwerk treffsicher spiegel)`, Upload-Volumes
`UPLOAD_APPS=(treffsicher spiegel)`); das CLI und alle Skripte (Deploy, Backup, Restore, Restore-Probe, `db-ensure`, Build)
binden sie ein.

Die folgenden Abschnitte beschreiben **was technisch passiert**, damit du
auch ohne das Tool zurechtkommst (z.B. wenn das CLI selbst kaputt ist).

## Inhalt

- [Initial-Bootstrap eines neuen VPS](#initial-bootstrap-eines-neuen-vps)
- [Deploy](#deploy)
  - [Neue App auf einem laufenden VPS](#neue-app-auf-einem-laufenden-vps)
  - [Release von Ringwerk](#release-von-ringwerk)
- [Backup](#backup)
- [Restore](#restore)
  - [Restore-Test](#restore-test-regelmäßig-empfohlen)
- [Recovery von fehlgeschlagenen Migrationen](#recovery-von-fehlgeschlagenen-migrationen)
- [Rollback](#rollback)
- [Brücke im Schützenhaus](#brücke-im-schützenhaus)

---

## Initial-Bootstrap eines neuen VPS

1. **VPS bestellen** (Debian 12 empfohlen; IONOS VPS S mit 2 GB reicht, [[vps-resource-sizing]]).
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
5. **DNS-Records setzen** (A-Record für alle drei Subdomains → VPS-IP; `setup` nennt sie).
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
1. `build-and-push.sh` (alle Apps, runner+migrator, → Docker Hub; `APPS="ringwerk treffsicher"` für eine Auswahl)
2. `ssh -t $VPS_HOST "cd $VPS_REPO_PATH && ./scripts/vereinsheim deploy"`
3. `vereinsheim deploy` auf dem VPS macht Pre-Backup → Pull → Up.

Bei Bedarf zerlegbar:

```bash
./scripts/vereinsheim build           # nur bauen+pushen
./scripts/vereinsheim remote deploy   # nur deployen (ohne neuen Build)
```

`scripts/deploy.sh` macht idempotent, je App nacheinander:

1. **Vorprüfung** (wenn `db` läuft, und noch einmal nach dem Start von `db`): Rolle und Datenbank jeder App gibt es,
   sonst Abbruch mit „zuerst `vereinsheim db-ensure`“. `vereinsheim deploy` prüft vorher zusätzlich mit `env-check`, dass keine Schlüssel
   fehlen.
2. Pre-Deploy-Backup (siehe unten) — überspringbar mit `SKIP_BACKUP=1`
3. `docker compose pull` — neue Image-Tags ziehen
4. `db` (wartet über `pg_isready`) und `caddy`
5. je App `docker compose up -d app-<app>`: Compose startet über `depends_on` erst den Migrator und wartet auf Exit 0,
   dann die App; danach muss sie laufen, ohne neu zu starten. Immer nur ein Migrator gleichzeitig; scheitert eine App,
   bricht der Deploy mit ihrem Namen ab, die Apps davor sind fertig, die danach unverändert. Kein `--wait` (verhält
   sich je nach Compose-Version anders).
6. `docker compose up -d --remove-orphans --no-deps` für `db`, `caddy` und die Apps (ohne die Migratoren erneut zu
   starten), Deploy-Historie mit den Tags aller Apps
7. `docker image prune` — alte Images aufräumen (`SKIP_PRUNE=1` lässt sie, für lokale Tests)

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

- `caddy` — wenn sich Image oder Umgebung geändert haben. Das `Caddyfile` ist als einzelne Datei eingehängt:
  Nach einer Änderung daran `docker compose up -d --force-recreate caddy` ([[caddy-x-real-ip-passthrough]]).
- `db` — bleibt, falls schon laufend; eine geänderte Umgebung (etwa ein neues `<APP>_DB_PASSWORD`) startet
  Postgres einmal neu, alle Apps verlieren kurz die Verbindung.
- `migrate-<app>` — laufen JEDES Mal one-shot, weil `restart: "no"` und Container nach `up -d` neu erstellt
  werden; nacheinander, nie gleichzeitig.
- `app-<app>` — neu, sobald `migrate-<app>` mit Code 0 durch ist. Eine geänderte Grenze in `compose.yml` (`mem_limit`,
  `NODE_OPTIONS`) kommt nur über `git pull` auf den VPS; der Deploy übernimmt sie dann. Ohne Deploy legt
  `docker compose up -d --no-deps --pull never app-<app>` die App mit demselben Image neu an. `vereinsheim restart`
  behält die alte Grenze ([[vps-resource-sizing]]).

Wenn `migrate-<app>` fehlschlägt, startet die zugehörige App **nicht**, und der Deploy hört dort auf. Andere Apps
sind davon nicht betroffen (eigener migrate-Container, eigene DB).

### Neue App auf einem laufenden VPS

Für eine weitere App im Stack (eingetragen in `scripts/lib/apps.sh`, `compose.yml`, `Caddyfile`, `.env.example`, `db-init/`):

1. `git pull`, danach `docker compose up -d --force-recreate caddy` (neue Caddyfile mit dem neuen Host).
2. `./scripts/vereinsheim setup` → „Fehlende Schlüssel ergänzen“ (Host, Tags, DB-Passwort, Secret, erstes Admin-Konto).
3. `./scripts/vereinsheim db-ensure` — Rolle und Datenbank anlegen (`db-init` läuft nur bei einem frischen Volume).
4. Images der App auf Docker Hub (öffentlich, [[adr-005]]), DNS-Eintrag für den Host.
5. `./scripts/vereinsheim deploy`.

### Release von Ringwerk

Ringwerk trägt den laufenden Wettkampfbetrieb und geht allein raus, nie im selben Release mit Treffsicher
([[adr-032]]). Vor dem Release:

1. **Abgleich** nach [[ringwerk-pruefbestand]]: `pruefen:vergleichen` am Prüfbestand ohne Fehler,
   `pruefen:ablaeufe` grün, `--echt` an der frischen Kopie der echten Daten (`vereinsheim dev-restore ringwerk`) ohne
   Fehler. Die Bilder vorher und nachher sieht der User durch.
2. **Backup** auf dem VPS: `./scripts/vereinsheim backup`, dann `./scripts/vereinsheim restore-probe` (das Backup
   lässt sich einspielen).
3. **Brackets prüfen (nur lesend),** einmalig vor dem Release mit der Korrektur-Regel je Runde
   ([[playoffs-knockout-system]]): Eine Korrektur konnte bis dahin eine halbe Runde hinterlassen oder einen Verlierer
   in der nächsten Runde stehen lassen. Beide Abfragen müssen leer sein; sonst den Wettbewerb mit der Sportleitung
   klären, bevor neu ausgeliefert wird.

   ```sql
   -- (a) Playoff-Runden mit falscher Zahl Paarungen
   SELECT c.name, pm.round, count(*) AS paarungen
   FROM "PlayoffMatch" pm JOIN "Competition" c ON c.id = pm."competitionId"
   GROUP BY c.name, pm.round
   HAVING count(*) <> CASE pm.round WHEN 'EIGHTH_FINAL' THEN 8 WHEN 'QUARTER_FINAL' THEN 4 WHEN 'SEMI_FINAL' THEN 2 ELSE 1 END;
   -- (b) Teilnehmer der nächsten Runde, die in der Runde davor nicht gewonnen haben
   WITH winners AS (
     SELECT "competitionId", round, CASE WHEN "winsA" > "winsB" THEN "participantAId" ELSE "participantBId" END AS pid
     FROM "PlayoffMatch" WHERE status = 'COMPLETED'
   ), seats AS (
     SELECT "competitionId", round, "participantAId" AS pid FROM "PlayoffMatch"
     UNION ALL SELECT "competitionId", round, "participantBId" FROM "PlayoffMatch"
   )
   SELECT c.name, s.round
   FROM seats s JOIN "Competition" c ON c.id = s."competitionId"
   WHERE s.round <> (SELECT min(round) FROM "PlayoffMatch" f WHERE f."competitionId" = s."competitionId")
     AND NOT EXISTS (
       SELECT 1 FROM winners w WHERE w."competitionId" = s."competitionId" AND w.pid = s.pid
         AND w.round = CASE s.round WHEN 'QUARTER_FINAL' THEN 'EIGHTH_FINAL'::"PlayoffRound"
           WHEN 'SEMI_FINAL' THEN 'QUARTER_FINAL'::"PlayoffRound" WHEN 'FINAL' THEN 'SEMI_FINAL'::"PlayoffRound" END);
   ```
4. **Termin:** ein Tag ohne Wettkampf, den der User bestimmt.
5. `./scripts/vereinsheim release` mit `APPS=ringwerk`, danach kurz die Seiten eines laufenden Wettbewerbs ansehen.
   `./scripts/vereinsheim rollback` steht bereit ([Rollback](#rollback)).
   Mit der eindeutigen Reihenfolge ([[ringwerk-pruefbestand]], „Gleichstand und Neuaufbau“) stehen laufende Brackets
   nach dem ersten Release einmalig in Setzreihenfolge; nur die Anzeige ändert sich. Der Sportleitung vorher sagen.

---

## Backup

### Was wird gesichert

`scripts/backup.sh` legt je Lauf fünf Files in `${BACKUP_DIR:-/var/backups/vereinsheim}` ab:

- `ringwerk-<TS>.dump` — Postgres custom-format Dump der `ringwerk`-DB
- `treffsicher-<TS>.dump`, `spiegel-<TS>.dump` — analog
- `uploads-treffsicher-<TS>.tar.gz` — Inhalt des `uploads_treffsicher`-Volumes
- `uploads-spiegel-<TS>.tar.gz` — Ausdrucke (PDF) aus dem `uploads_spiegel`-Volume

Ringwerk hat keine persistierten Uploads und wird daher nicht archiviert. Gibt es die Datenbank
einer App noch nicht (vor `vereinsheim db-ensure`), meldet das Backup es und sichert die übrigen.

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

**Off-Site-Backup ist nicht im Scope** ([[off-site-backup-gap]]). Sinnvolle Erweiterungen:

- `rclone sync /var/backups/vereinsheim/ <remote>:<bucket>/` als Cron
- borg-Backup auf NAS
- IONOS Snapshot-Funktion (whole-VM, weniger granular)

Bis dahin holt `vereinsheim local-pull` die neuesten Dumps aller Apps auf die lokale Maschine (`./backups/`). Diese
Kopien rotieren nicht wie die Sicherungen auf dem Server.

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
docker compose stop app-treffsicher migrate-treffsicher
./scripts/restore.sh treffsicher \
  /var/backups/vereinsheim/treffsicher-2026-05-10_0300.dump \
  /var/backups/vereinsheim/uploads-treffsicher-2026-05-10_0300.tar.gz
docker compose up -d migrate-treffsicher app-treffsicher

docker compose stop app-spiegel migrate-spiegel
./scripts/restore.sh spiegel \
  /var/backups/vereinsheim/spiegel-2026-10-20_0300.dump \
  /var/backups/vereinsheim/uploads-spiegel-2026-10-20_0300.tar.gz
docker compose up -d migrate-spiegel app-spiegel
```

Ringwerk ohne Uploads-Tar (`restore.sh` lehnt einen ab: Ringwerk hat kein Upload-Volume).

`restore.sh`:

1. Stellt sicher, dass `db` healthy läuft
2. Kopiert Dump in den db-Container
3. `pg_restore --clean --if-exists --no-owner --role=<app>`
4. Optional: extrahiert Uploads-Tar ins zugehörige Volume

### Restore-Test (regelmäßig empfohlen)

Mindestens **einmal pro Quartal**, und nach jeder neuen App, prüfen, dass sich die Backups einspielen lassen:

```bash
./scripts/vereinsheim restore-probe
```

Je App spielt `scripts/restore-probe.sh` den neuesten Dump in eine Wegwerf-Datenbank `restore_probe_<app>`
(`pg_restore --no-owner`), zählt Tabellen und angewandte Migrationen und löscht sie wieder; die laufenden Datenbanken
bleiben unberührt. In Ordnung ist eine App, wenn das Einspielen gelingt und Tabellen und Migrationen da sind; eine
andere Zahl als in der laufenden Datenbank ist nur ein Hinweis (ein Deploy nach dem Backup). Exit 1 bei einem Fehler
oder einem fehlenden Dump (außer die App hat noch gar keine Datenbank). `BACKUP_DIR` wählt einen anderen Ordner.

---

## Recovery von fehlgeschlagenen Migrationen

### Hintergrund

Alle Apps fahren ihre Migrationen via `prisma migrate deploy` im jeweiligen
`migrate-<app>`-Container. Schlägt eine Migration fehl, bleibt in der
`_prisma_migrations`-Tabelle ein Eintrag mit `finished_at IS NULL` zurück.
**Prisma weigert sich danach, irgendeine weitere Migration zu fahren**, bis
dieser Zombie-Eintrag explizit aufgelöst ist (`migrate resolve --applied`
oder `--rolled-back`). Selbst wenn du die Migrations-SQL fixst, hilft ein
einfaches `migrate deploy` nicht weiter.

### Eingebauter Recovery-Mechanismus

Ringwerk und Treffsicher enthalten zwei zusammenwirkende Skripte (`apps/<app>/scripts/`). Spiegel hat nur
`run-migrations-with-recovery.sh` mit `prisma migrate deploy` ohne Wiederherstellung
(`PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS=false`); scheitert dort eine, helfen Pfad 3 und 4.

- `scripts/run-migrations-with-recovery.sh` — versucht `migrate deploy`,
  ruft bei Fehler das Recovery-Skript, dann nochmal `deploy`.
- `scripts/resolve-failed-migrations.mjs` — liest failed migrations aus
  `_prisma_migrations`, entscheidet je nach Eintrag in der
  `KNOWN_RECOVERY_HANDLERS`-Tabelle automatisch.

In `compose.yml` ist für Ringwerk und Treffsicher konfiguriert:

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
Image-Tags aller Apps (je App `<APP>_TAG` und `<APP>_MIGRATOR_TAG`) zurück in die `.env`. Anschließend startet es
automatisch `deploy.sh` mit `SKIP_BACKUP=1` (der kaputte Stand soll
kein neues Backup erzeugen). `migrate deploy` ist no-op, da der
Schema-Stand bereits korrekt ist.

**Fallback** (z.B. wenn die History-Datei fehlt oder du auf einen
Tag rollen willst, der nicht in der History steht):

```bash
./scripts/vereinsheim setup     # Wahl 2: einzelne Werte bearbeiten
#  → RINGWERK_TAG = <vorherige-sha>
#  → RINGWERK_MIGRATOR_TAG = <vorherige-sha>-migrator
#  (ebenso TREFFSICHER_* und SPIEGEL_*; fehlen einem Eintrag der History
#   die Tags einer App, bleibt sie auf dem aktuellen Tag)
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

---

## Brücke im Schützenhaus

Spiegel bekommt seine Daten von der Brücke (`apps/spiegel-bridge`), die neben der Meyton-Anlage läuft, nicht auf dem
VPS. Sie verbindet sich nur ausgehend per HTTPS mit `SPIEGEL_HOST`; auf dem VPS ist dafür nichts zu öffnen.

- **Bauen** (lokal): `pnpm --filter spiegel-bridge build` → `apps/spiegel-bridge/dist/` (linux/arm64, linux/amd64,
  windows/amd64).
- **Installieren und koppeln**: [`apps/spiegel-bridge/README.md`](../../apps/spiegel-bridge/README.md) — Binary und
  `deploy/` aufs Gerät, `sudo sh deploy/install.sh <binary>`, in Spiegel unter Admin → Anlage und Brücke unter
  „Brücke verbinden“ einen Code erzeugen, `spiegel-bridge pair`, `systemctl enable --now spiegel-bridge`.
- **Zustand**: Spiegel zeigt unter „Anlage und Brücke“ den letzten Kontakt. „Aus, zuletzt online …“ ist der Normalfall,
  die Anlage wird nach dem Training ausgeschaltet. Logs auf dem Gerät: `journalctl -u spiegel-bridge`.
- **Brücke trennen** (Gerät verloren oder getauscht): in Spiegel unter „Anlage und Brücke“ trennen; die Brücke
  beendet sich mit Exit 3 und muss neu verbunden werden.

Arbeitsweise, Netz und Störfälle: [[spiegel-bridge]].
