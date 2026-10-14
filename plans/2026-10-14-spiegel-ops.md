# Spiegel: CLI, Deploy und Backup für drei Apps (P4, SP-1.9 a2)

## Kontext

P3 (`plans/2026-10-14-spiegel-stack.md`) hat Image und Stack gebracht: `migrate-spiegel` und `app-spiegel` in
`compose.yml`, die Subdomain in Caddy, die dritte Datenbank in `db-init` und `scripts/db-ensure.sh`. Das Betriebswerkzeug
kennt Spiegel aber noch nicht: Backup, Restore, Deploy-Historie, Rollback, `.env`-Wizard, `env-check` und die lokalen
Befehle sprechen nur von Ringwerk und Treffsicher (Bestandsaufnahme vom 14. Oktober 2026: rund 140 Stellen im CLI).
Dazu die Punkte aus dem Review von P3 („Für P4“ im Plan von P3): Deploy nacheinander, Vorprüfung auf `db-ensure`,
Abbruch bei fehlenden Schlüsseln, Vorlagen der `.env` mit Spiegel.

**Stand auf dem VPS (14. Oktober 2026):** Der Stand von P3 ist gezogen, Caddy neu angelegt (mit `SPIEGEL_HOST`), das
Zertifikat für `spiegel.example.com` ist ausgestellt, die `SPIEGEL_*`-Schlüssel stehen in der `.env`. Rolle und
Datenbank `spiegel` fehlen, das Image `spiegel` liegt nicht auf Docker Hub. Bis P5 kein `deploy` und kein `release`.

**Modus:** `scripts/` ist geschützt; die Umsetzung läuft **interaktiv** ohne Autopilot, Task für Task, jede
Commit-Message vorher als fenced Block. Nichts geht auf den VPS (das ist P5).

## Entscheidungen

- **D1 Eine Liste der Apps im CLI.** Oben im Skript `APPS=(ringwerk treffsicher spiegel)` und
  `UPLOAD_APPS=(treffsicher)`. `is_valid_app`, Menüs (nummeriert aus der Liste), `logs`, `psql`, `migrations`,
  `restore`, `dev-restore` und die Tag-Schlüssel leiten sich daraus ab, statt Namen zu wiederholen. Wo heute zwei
  kopierte Blöcke stehen (Restore in `_local_up_with_restore`, Tags in `_check_image_tags` und `cmd_rollback`), wird eine
  Schleife daraus.
- **D2 Tags und Rollback.** Sechs Schlüssel (`<APP>_TAG`, `<APP>_MIGRATOR_TAG`). `_check_image_tags` zählt über die
  Liste. Die Deploy-Historie schreibt die Spiegel-Tags mit. `rollback` verlangt Ringwerk und Treffsicher wie bisher;
  fehlen in einem alten Eintrag beide Spiegel-Tags, bleibt Spiegel auf dem aktuellen Tag (Hinweis), fehlt nur einer,
  Abbruch.
- **D3 Deploy nacheinander** (`scripts/deploy.sh`):
  1. `.env` da (`ENV_FILE`, Vorgabe `.env`), alle Aufrufe mit `--env-file`.
  2. **Vorprüfung**, wenn `db` läuft: Für jede App gibt es die Rolle (`pg_roles`), sonst Abbruch „erst
     `./scripts/vereinsheim db-ensure`“. Läuft `db` nicht (erster Start), legt `db-init` alles an.
  3. Pre-Deploy-Backup wie bisher.
  4. `docker compose pull`.
  5. `docker compose up -d --wait db`, dann `docker compose up -d caddy`.
  6. Je App nacheinander `docker compose up -d --wait app-<app>` (startet über `depends_on` erst den Migrator). Scheitert
     eine App, Abbruch mit ihrem Namen; die übrigen Apps sind nicht angefasst, die vorigen schon fertig. So läuft immer
     nur ein Migrator (Speicher, D8 aus P3). Wie `--wait` einen Migrator mit Exit 0 behandelt, hängt von der
     Compose-Version ab: T8 prüft es lokal, P5 liest `docker compose version` auf dem VPS; sonst wartet das Skript selbst
     (Migrator `exited (0)`, App `running`).
  7. `docker compose up -d --remove-orphans` (gleicht den Rest ab), Historie mit allen sechs Tags, Prune, Status.
- **D4 `env-check` blockt den Deploy.** `cmd_env_check` gibt einen Exit-Code zurück (fehlende Schlüssel = 1, nur
  ungültige = 0 mit Warnung wie heute). `cmd_deploy` ruft es vorher auf und bricht bei fehlenden Schlüsseln ab.
- **D5 Backup und Restore.**
  - `backup.sh` sichert jede App, deren Datenbank es gibt (`pg_database`), und meldet eine fehlende mit Hinweis auf
    `db-ensure`, statt abzubrechen; sonst risse auf dem VPS der nächtliche Lauf zwischen P4 und P5 ab, bevor Uploads und
    Prune laufen. Prune je App. `VOLUME_PREFIX` aus `COMPOSE_PROJECT_NAME` (Vorgabe `vereinsheim`), `ENV_FILE` wie D3.
  - `restore.sh` kennt Spiegel; ein Uploads-Tar nur für Apps aus `UPLOAD_APPS` (sonst Abbruch mit Hinweis).
  - `cmd_restore` sucht einen passenden Uploads-Tar nur für Treffsicher.
- **D6 Restore-Probe** (`scripts/restore-probe.sh`, `vereinsheim restore-probe`, ersetzt den Handgriff aus
  [[restore-test]]): Für jede App den neuesten Dump aus dem Backup-Ordner in eine Wegwerf-Datenbank
  `restore_probe_<app>` im `db`-Container spielen (`pg_restore --no-owner`), Tabellen in `public` und Zeilen in
  `_prisma_migrations` zählen, mit der laufenden Datenbank vergleichen, die Wegwerf-Datenbank löschen. Ausgabe je App
  „in Ordnung“ oder der Unterschied; Exit 1 bei Unterschied.
- **D7 `setup` mit Spiegel.** Fragen nach `SPIEGEL_HOST` (Vorgabe `spiegel.$DOMAIN`), `SPIEGEL_DB_PASSWORD`
  (generiert), `SPIEGEL_NEXTAUTH_SECRET` (generiert, 48), `SPIEGEL_SEED_ADMIN_EMAIL`, `SPIEGEL_SEED_ADMIN_PASSWORD`
  (sichtbar abgefragt, mindestens 12 Zeichen: das ist das Passwort, mit dem sich der Admin anmeldet). Neue Option bei
  vorhandener `.env`: **„Fehlende Schlüssel ergänzen“**. Sie geht die Schlüssel aus `.env.example` durch, die in der
  `.env` fehlen, und fragt jeden mit demselben Helfer wie der volle Wizard (`setup_prompt_key KEY`).
- **D8 Lokale Befehle.** `_write_default_local_env` mit Spiegel-Platzhaltern (Secret ≥ 32 Zeichen und nicht der
  Beispielwert aus `apps/spiegel/.env.example`); `local-pull` holt die Spiegel-Tags und ergänzt in einer vorhandenen
  `.env.local` fehlende Schlüssel aus der Vorlage; `_local_print_urls` mit `http://localhost:3002`.
- **D9 Spiegel lokal wie die anderen Apps** (User, 14. Oktober 2026: „dev-restore kann das lokal gerne immer
  herstellen, das ist kein problem“). `local-pull` holt den neuesten Spiegel-Dump mit, `dev-restore` ohne Argument und
  `local-up --restore` spielen ihn ein. Fehlt ein Spiegel-Dump (ältere Sicherungen, Datenbank noch nicht angelegt),
  Hinweis und weiter, kein Abbruch. Bis es ein Off-Site-Backup gibt, ist die Kopie auf dem Mac auch die einzige
  außerhalb des VPS; sie rotiert nicht wie die Sicherungen auf dem Server.
- **D10 Testbar gegen den Teststack.** Die Skripte nehmen `ENV_FILE`, `COMPOSE_PROJECT_NAME`, `COMPOSE_FILE` und
  `BACKUP_DIR` aus der Umgebung (wie `db-ensure`). Das CLI nimmt `VEREINSHEIM_ENV_FILE` (Vorgabe `<repo>/.env`) und
  exportiert dann `COMPOSE_ENV_FILES` für seine `docker compose`-Aufrufe. Neu `tools/stack-e2e/ops.sh`: prüft gegen
  einen mit `--keep` stehenden Stack Deploy, Backup, Restore-Probe, Restore und Rollback, ohne `.env` im Repo.

## Nicht in diesem Plan

- Der erste Deploy (P5, Runbook mit fertigen Befehlen für den User), Off-Site-Backup, Selbst-Hosting (SP-1.9 b).
- Spiegel hat kein Upload-Volume (PDFs kommen mit dem QR-Weg).
- `cron` bleibt bei `backup.sh`; ob die Restore-Probe regelmäßig läuft, entscheidet P5.

## Required Docs

- `CLAUDE.md` (Bedienkonzept, „Wenn du etwas änderst“), `plans/2026-10-14-spiegel-stack.md` („Für P4“, „Für das
  Runbook“), `reports/2026-10-14-spiegel-stack-review.md`
- `vault/operations/operations.md` und die Notes `deploy-flow`, `image-tag-rollback`, `restore-from-backup`,
  `restore-test`, `nightly-backup-cron`, `pre-deploy-backup`, `ops-cli-introspection`, `vps-bootstrap-and-setup`,
  `off-site-backup-gap`, `failed-migration-recovery`
- `vault/spiegel/spiegel-privacy.md`, `vault/incidents/bash-errexit-in-or-list.md`,
  `vault/incidents/postgres-image-loopback-trust.md`

## Dateien

| Datei | Änderung |
| --- | --- |
| `scripts/vereinsheim` | T1 bis T3, T6, T7 |
| `scripts/deploy.sh` | T4 |
| `scripts/backup.sh`, `scripts/restore.sh` | T5 |
| `scripts/restore-probe.sh` (neu) | T6 |
| `tools/stack-e2e/ops.sh` (neu), `tools/stack-e2e/README.md` | T8 |
| `reports/2026-10-14-spiegel-ops.md` | T9 |
| `vault/operations/*.md` (siehe Required Docs), `README.md`, `CLAUDE.md` (Bedienkonzept), `vault/spiegel/spiegel-roadmap.md` | T10 |

## Aufgaben

1. **T1 Grundlagen im CLI.** `APPS`, `UPLOAD_APPS` (D1), `VEREINSHEIM_ENV_FILE` (D10); `is_valid_app` aus `APPS`;
   Hilfe (`dev-restore` „alle Apps“, `psql <app>` mit Spiegel, neue Befehle aus T6); `cmd_logs` mit `app-spiegel`;
   `cmd_psql`, `cmd_psql_interactive`, `cmd_migrations` (Menü aus `APPS`; bei Spiegel sagt Option 1, dass es keine
   automatische Wiederherstellung gibt); `cmd_restore` (Menü aus `APPS`, Uploads-Tar nur für `UPLOAD_APPS`);
   `cmd_status` (je App die neueste Sicherung statt „Letzte 4“); `_local_print_urls` mit Port 3002; Beispiel in
   `cmd_upload` mit `uploads-treffsicher-…`. Prüfen: `bash -n`, `vereinsheim help`, Menüs per `printf '…\n' |`.
2. **T2 Tags und Rollback** (D2). `_check_image_tags` über sechs Schlüssel; Text in `cmd_deploy` („alle sechs“, Hinweis
   auf `setup` → „Fehlende Schlüssel ergänzen“); `cmd_rollback` mit Schleife über die Apps, Spiegel optional in alten
   Einträgen. Prüfen: Historie mit altem und neuem Format in einer Wegwerf-`.env` (T8).
3. **T3 `env-check` und `setup`** (D4, D7). `cmd_env_check` mit Exit-Code; `cmd_deploy` bricht bei fehlenden Schlüsseln
   ab; `setup_prompt_key KEY` (Host, Passwort, Secret, E-Mail, Seed-Passwort, Tags nach Muster des Namens);
   der volle Wizard und „Fehlende Schlüssel ergänzen“ nutzen ihn; Zusammenfassung und DNS-Hinweis mit `SPIEGEL_HOST`.
   Prüfen: Wizard und Ergänzen per Eingabe aus `printf` gegen eine Wegwerf-Datei über `VEREINSHEIM_ENV_FILE`.
4. **T4 `deploy.sh`** (D3). Prüfen in T8: frischer Stack, Vorprüfung ohne Rolle (Abbruch), Deploy mit drei Apps
   nacheinander (Reihenfolge im Log, je ein Migrator), Historie mit sechs Tags.
5. **T5 Backup und Restore** (D5). Prüfen in T8: Backup mit drei Dumps und dem Uploads-Tar; ohne Datenbank `spiegel`
   Hinweis statt Abbruch, Uploads und Prune laufen trotzdem; `restore.sh spiegel <dump>` in den Stack, App läuft danach.
6. **T6 Restore-Probe** (D6): `scripts/restore-probe.sh` und `vereinsheim restore-probe` (Hilfe, Menü „Deploy &
   Backup“, Dispatch). Prüfen in T8: alle drei in Ordnung; ein absichtlich abgeschnittener Dump → Exit 1.
7. **T7 Lokale Befehle** (D8, D9). `_write_default_local_env`, `local-pull` (Spiegel-Dump optional, Tags, Ergänzen
   fehlender Schlüssel), `_local_up_with_restore` (Schleife über `APPS`, fehlender Dump nur Hinweis), `cmd_dev_restore`
   (ohne Argument alle drei). Prüfen: `bash -n`; `local-pull` und `dev-restore` nur trocken (ohne VPS), die Vorlage per
   `VEREINSHEIM_ENV_FILE`-Wegwerfdatei.
8. **T8 `tools/stack-e2e/ops.sh`** (D10): gegen `run.sh --keep`: `db-ensure` → `deploy.sh` (Tags aus der Wegwerf-Umgebung)
   → Vorprüfung ohne Rolle → `backup.sh` in einen Temp-Ordner → `restore-probe.sh` → `restore.sh spiegel` → `rollback` über
   das CLI mit `VEREINSHEIM_ENV_FILE`. Am Ende Stack abbauen (`run.sh --clean`).
9. **T9 Validierung:** `run.sh --keep`, `ops.sh`, Bericht `reports/2026-10-14-spiegel-ops.md` mit den Ausgaben; was nicht
   geht (VPS, `local-pull` ohne VPS), steht dort als „nicht belegt“.
10. **T10 Doku.** Die Notes aus Required Docs nachziehen (drei Apps, Deploy nacheinander mit Vorprüfung, Restore-Probe
    als Befehl, Spiegel lokal wie die anderen Apps), `README.md` und `CLAUDE.md` (Bedienkonzept-Tabelle: `db-ensure`,
    `restore-probe`), Roadmap SP-1.9 (a2 erledigt, Stand VPS). `/sync-graph`.

## Testschritte

- Je Task `bash -n` für jedes geänderte Skript; `shellcheck`, wenn vorhanden; `docker compose … config --quiet`.
- `pnpm check` vor jedem Commit (Gate aus der Repo-Wurzel, Node 24).
- T8/T9 als Ende-zu-Ende-Prüfung gegen den Teststack, mit den Ausgaben im Bericht.

## Verifikation

Bericht `reports/2026-10-14-spiegel-ops.md`, danach `/review` gegen `main`. Merge durch den User. Danach P5 (Runbook
für den ersten Deploy).
