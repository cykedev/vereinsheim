# 4: Treffsicher geht in den Ruhestand

Teilplan des Koordinationsplans [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md), Stufe 4.
Branch `feat/tis-4-retire-treffsicher` vom Basisbranch `feat/treffsicher-in-spiegel`. Konzept, Text und Löschtermin hat
der User am 2. November 2026 freigegeben (Textbuch, Abschnitt „Treffsicher im Ruhestand (Stufe 4)“).

**Geschützte Pfade:** `compose.yml`, `compose.local.yml`, `Caddyfile`, `scripts/` und `tools/stack-e2e/` gehören zum
Deploy-Vertrag bzw. zu `scripts/`. Alle Aufgaben mit **[geschützt]** laufen ohne Autopilot-Marker (ADR-023). Die
koordinierende Session prüft ihren Diff bei der Übernahme. Schema und Migrationen bleiben in allen Apps unverändert. Eine
neue Brücke braucht es nicht.

## Kontext

Die Übernahme ist durch. In Prod sind am 2. November 2026 sechs Konten umgezogen, mit 268 Einheiten, 10 Zielen und 4
Abläufen, und seit dem Umzug ist dort nichts mehr geändert worden. Die drei übrigen Konten sind inaktiv und haben keine
Daten (Zählung des Users). Seit 3e kann in Treffsicher niemand mehr etwas ändern.

ADR-033 sah für Stufe 4 erst eine Phase „nur lesend mit Hinweis“ und dann das Abschalten vor. Die lesende Phase hat 3e
schon gebracht. Der User will jetzt direkt abschalten: kein Login, keine App, nur ein Hinweis, dass die Daten in Spiegel
stehen. Das PDF einer Einheit braucht er nicht, dafür gibt es das Teilen.

## Ansatz (freigegebenes Konzept)

- **Hinweisseite in Caddy, kein Container:** Der Host von Treffsicher (`{$TREFFSICHER_HOST}`) beantwortet jede Adresse mit
  derselben statischen Seite. Das gilt auch für alte Links auf eine Einheit und das Symbol auf dem Home-Bildschirm. Die
  Seite liegt als `caddy/treffsicher/index.html` im Repo und ist in den Caddy-Container gemountet. Den Link auf Spiegel
  setzt Caddy über `templates` aus `{{env "SPIEGEL_HOST"}}`. Treffsicher hat keinen Service Worker und kein Manifest (geprüft),
  also hält kein Gerät eine alte App im Cache.
- **Treffsicher läuft nicht mehr:** `app-treffsicher` und `migrate-treffsicher` fallen aus `compose.yml` und
  `compose.local.yml`. Build, Release und Deploy bauen und starten nur noch Ringwerk und Spiegel.
- **Daten bleiben bis zum Löschtermin am 1. Februar 2027:** Die Datenbank `treffsicher` mit ihrem Owner, das Volume
  `uploads_treffsicher` und die Backups bleiben. Die tägliche Sicherung sichert Treffsicher weiter, bis zum Löschtermin.
  Ein Restore der Datenbank und der Anhänge bleibt möglich. `db-init` legt die Datenbank weiter an.
- **Drei Listen statt einer** in `scripts/lib/apps.sh`:
  - `APPS=(ringwerk spiegel)` sind die Apps, die laufen: Build, Release, Deploy, Status, Logs.
  - `DATA_APPS=(ringwerk treffsicher spiegel)` sind die Datenbanken, die gesichert werden: Backup, Restore, Restore-Probe,
    `db-ensure`.
  - `CODE_APPS=(ringwerk treffsicher spiegel)` ist der Code im Repo: Konsistenz-Gate, `dev-setup`. Der Code von Treffsicher
    bleibt bis zu einem späteren Schritt, und das Gate prüft ihn weiter.

  `UPLOAD_APPS=(treffsicher spiegel)` bleibt, wie es ist.
- **Speicher für Spiegel:** `app-spiegel` bekommt 384 MB statt 320 MB, Heap 192 statt 160. Rechnung: 192 MiB Heap, rund
  60 MiB außerhalb des Heaps und ein Leser bis zur Wache von 96 MiB ergeben rund 348 MiB ([[node-heap-above-container-limit]]).
  Die übrigen 192 MB von Treffsicher (256 minus 64) bleiben Reserve. Die Summe der Grenzen sinkt damit von 1.312 auf
  1.120 MiB. Ob Spiegel mehr braucht, entscheidet eine Messung nach einigen Tagen.
- **Übernahme bleibt im Repo:** `vereinsheim transfer` und `transfer-spiegel` bleiben, wie sie sind. Sie lesen die
  Datenbank von Treffsicher mit `psql` auf dem Host und brauchen keinen Container von Treffsicher. Sie gehen mit dem
  Code von Treffsicher in einem späteren Schritt.
- **Im Stack-Test fällt `--transfer` weg:** Ohne Image von Treffsicher gibt es dort nichts zu üben, und die Übernahme ist
  gelaufen. Das Flag, `tools/stack-e2e/transfer.sh` und der Abschnitt in der README fallen weg.
- **Später, nicht in diesem Plan:** `apps/treffsicher` mit seinen Paketen, Tests, `vereinsheim transfer` und den
  Werkzeugen der Übernahme aus dem Repo nehmen. Danach prüft das Gate zwei Apps.

### Text der Hinweisseite (Textbuch, freigegeben)

| Stelle | Text |
|---|---|
| Titel der Seite | Treffsicher ist jetzt Teil von Spiegel |
| Text | Deine Einheiten, Ziele und Abläufe aus Treffsicher stehen jetzt in Spiegel, im Tagebuch. |
| Text, zweiter Absatz | Melde dich dort mit deiner E-Mail an. Hattest du schon ein Konto in Spiegel, gilt sein Passwort. Sonst gilt dein Passwort aus Treffsicher. |
| Knopf | Zu Spiegel |

`<title>` ist „Treffsicher ist jetzt Teil von Spiegel“, `lang="de"`.

## Dateien

| Datei | Änderung |
|---|---|
| `caddy/treffsicher/index.html` | neu: die Hinweisseite |
| `Caddyfile` | **geschützt**: Block von `{$TREFFSICHER_HOST}` |
| `compose.yml` | **geschützt**: Treffsicher-Dienste weg, Mount in `caddy`, Grenzen von Spiegel |
| `compose.local.yml` | **geschützt**: Überschreibungen von Treffsicher weg |
| `scripts/lib/apps.sh` | **geschützt**: `APPS`, `DATA_APPS`, `CODE_APPS` |
| `scripts/backup.sh`, `restore.sh`, `restore-probe.sh`, `db-ensure.sh` | **geschützt**: `DATA_APPS` |
| `scripts/consistency-check.sh`, `bootstrap-dev.sh` | **geschützt**: `CODE_APPS` |
| `scripts/build-and-push.sh`, `deploy.sh` | **geschützt**: nur noch `APPS`, Muster in Zeile 139 aus `APPS` |
| `scripts/vereinsheim` | **geschützt**: lokale `.env`, `env-check`, Hilfe, `psql` |
| `.env.example` | Variablen der App Treffsicher weg, Host und Passwort der Datenbank bleiben |
| `tools/stack-e2e/*` | **geschützt**: zwei Apps, Prüfung der Hinweisseite, `--transfer` weg |
| Vault und `CLAUDE.md` | siehe Aufgabe 9 |

## Required Docs

- `vault/decisions/adr-033.md` („Weg in vier Stufen“, Punkt 4; Nachträge 3b und 3e), [[adr-002]], [[adr-003]],
  [[adr-023]] (geschützte Pfade).
- `vault/operations/operations.md` (Release, Deploy, Backup, Restore, „Übernahme aus Treffsicher“).
- `vault/operations/vps-resource-sizing.md`, `vault/incidents/node-heap-above-container-limit.md` (oder die Note dieses
  Namens, `mcp__memory__search_nodes` „Heap über der Grenze des Containers“).
- `vault/apps/treffsicher/treffsicher-read-only.md`.
- `tools/stack-e2e/README.md`.
- Root-`CLAUDE.md` „Wenn du etwas änderst“ (Prüfbefehle für Skripte, `compose.yml` und `Caddyfile`).

## Aufgaben

Jede Aufgabe ist ein Commit. Gate ist `pnpm check`. Schritte mit **[geschützt]** laufen ohne Autopilot-Marker.

1. **Hinweisseite.** `caddy/treffsicher/index.html` mit den Texten oben:
   - eine Datei, CSS inline, keine Schrift von außen (`system-ui`), kein Skript;
   - Farben wie Design 2 in Spiegel, hell und dunkel über `prefers-color-scheme`;
   - Viewport-Meta, mittig, Breite höchstens 28 rem, Knopf mindestens 44 px hoch;
   - der Knopf ist ein Link auf `https://{{env "SPIEGEL_HOST"}}`.

   Die Seite ist eine Fehlerseite ohne Rahmen. Sie darf deshalb zentriert stehen, wie `not-found.tsx` (conventions §3).
2. **[geschützt] Caddy.** Den Block von `{$TREFFSICHER_HOST}` ersetzen:
   - `encode zstd gzip`;
   - `root * /srv/treffsicher`;
   - `rewrite * /index.html`;
   - `templates`;
   - `header Cache-Control "no-store"`;
   - `file_server`.

   In `compose.yml` bekommt `caddy` den Mount `./caddy/treffsicher:/srv/treffsicher:ro`. Ein Kommentar über dem Block sagt,
   was er ist ([[adr-033]], Stufe 4). Prüfen mit `caddy validate` wie in der Root-`CLAUDE.md`.
3. **[geschützt] Compose.**
   - Aus `compose.yml` fallen `migrate-treffsicher` und `app-treffsicher` weg. Das Volume `uploads_treffsicher` bleibt
     samt Kommentar „bis zum Löschtermin, gemountet von `transfer-spiegel`“.
   - `app-spiegel` bekommt `mem_limit: 384m` und `--max-old-space-size=192`. Der Kommentar dort nennt die Rechnung.
   - Aus `compose.local.yml` fallen `app-treffsicher` und `migrate-treffsicher` weg.
   - Prüfen mit `docker compose --env-file <test-env> config --quiet` für beide Dateien.
4. **[geschützt] Listen.** `scripts/lib/apps.sh` mit `APPS`, `DATA_APPS`, `CODE_APPS` wie im Ansatz, je mit einer
   Kommentarzeile. Die Skripte stellen um:
   - `backup.sh`: Dumps und Rotation über `DATA_APPS`;
   - `restore.sh`: Prüfung und Hilfe über `DATA_APPS`;
   - `restore-probe.sh` und `db-ensure.sh`: über `DATA_APPS`;
   - `consistency-check.sh` und `bootstrap-dev.sh`: über `CODE_APPS`;
   - `build-and-push.sh`: Vorgabe nur `APPS`, Hilfe „Vorgabe alle Apps, die laufen“; das Muster in Zeile 139 aus `APPS`
     gebaut statt fest;
   - `deploy.sh`: bleibt bei `APPS`.

   `bash -n` für jedes Skript.
5. **[geschützt] CLI.** In `scripts/vereinsheim`:
   - Die lokale `.env` (`local-setup`, um Zeile 611) verliert `TREFFSICHER_TAG`, `TREFFSICHER_MIGRATOR_TAG`,
     `TREFFSICHER_NEXTAUTH_SECRET`, `TREFFSICHER_ADMIN_EMAIL` und `TREFFSICHER_ADMIN_PASSWORD`. `TREFFSICHER_HOST` und
     `TREFFSICHER_DB_PASSWORD` bleiben.
   - `env-check` verlangt nur noch, was `compose.yml` liest.
   - `psql treffsicher` bleibt.
   - Status, Logs und Hilfe nennen die Apps, die laufen.

   Dazu gleich in `.env.example`. `bash -n scripts/vereinsheim`.
6. **[geschützt] Stack-Test.** `tools/stack-e2e/`:
   - Es werden nur die Images von Ringwerk und Spiegel gebaut.
   - `compose.e2e.yml` hat keine Dienste von Treffsicher und die Grenzen von Spiegel wie in `compose.yml`.
   - Eine neue Prüfung holt über Caddy mit dem Host von Treffsicher `/` und `/sessions/abc`. Beide antworten 200, mit dem
     Titel und einem Link auf den Host von Spiegel. Der Platzhalter `{{` darf nicht mehr im HTML stehen.
   - `--transfer` und `transfer.sh` fallen weg, die README zieht nach.
   - Die Ops-Übung (`ops.sh`: Deploy, Backup, Restore, Rollback) läuft mit zwei Apps. Backup und Restore der Datenbank
     von Treffsicher übt sie weiter. Dazu legt sie die Datenbank wie `db-init` an, ohne Migrator; ein leeres Schema genügt
     für Dump und Restore.
7. **Ablauf auf dem VPS** als Abschnitt „Treffsicher im Ruhestand“ in `vault/operations/operations.md`, in
   dieser Reihenfolge:
   1. Nach dem Release von 3d und U2 und dem Fast-forward von `main` auf dem VPS `git pull`.
   2. `docker compose up -d caddy`: Caddy kommt mit Mount und neuem Block.
   3. Die Container von Treffsicher entfernen: `docker rm -f` für die Container von `app-treffsicher` und
      `migrate-treffsicher`, die Namen aus `docker ps -a --filter name=treffsicher`.
   4. `docker compose up -d --no-deps --pull never app-spiegel`: Spiegel kommt mit den neuen Grenzen.
   5. Prüfen: die Hinweisseite im Browser, `vereinsheim status`, der Messbefehl aus [[vps-resource-sizing]] mit Spiegel
      bei der Grenze 384, die nächste nächtliche Sicherung mit einem Dump von `treffsicher`.

   Ringwerk wird dabei nicht neu gestartet. Kein `vereinsheim deploy` für diesen Schritt, weil es Ringwerk neu zieht.
   Im Stack-Test mit `--keep` genau so durchspielen und das Ergebnis im Bericht festhalten.
8. **Löschtermin** als Abschnitt in derselben Note. Am 1. Februar 2027 entfernt der User:
   - die Datenbank `treffsicher` und ihren Owner (`DROP DATABASE`, `DROP ROLE` in `psql`);
   - das Volume `uploads_treffsicher` (`docker volume rm`);
   - die Backups `treffsicher-*` und `uploads-treffsicher-*` im Backup-Verzeichnis;
   - danach in einem Commit `treffsicher` aus `DATA_APPS` und `UPLOAD_APPS`, `db-init` und `.env.example`.

   Die Befehle stehen dort fertig, nur mit Platzhaltern für Pfade aus `.vereinsheim.local`. Den Termin nennt auch
   `vault/apps/treffsicher/` (Status „im Ruhestand seit …, Daten bis 1. Februar 2027“).
9. **Doku.**
   - `vault/operations/vps-resource-sizing.md`: Grenzen ohne Treffsicher, Summe 1.120 MiB, Spiegel 384 und Heap 192.
   - `vault/architecture/architecture.md`: Repo-Karte und Skizze mit Treffsicher als Hinweisseite.
   - Root-`CLAUDE.md`: „drei Next.js-Apps“ mit dem Satz, dass Treffsicher nicht mehr läuft.
   - `apps/treffsicher/CLAUDE.md`: oben ein Satz, dass die App nicht mehr deployt wird.
   - `vault/apps/treffsicher/*`: Status.
   - `tools/stack-e2e/README.md`.

   Den Nachtrag zu ADR-033 schreibt die koordinierende Session bei der Übernahme. `vault-lint` muss grün sein.

## Test steps

- `pnpm check` (alle fünf Gates) grün. Das Konsistenz-Gate prüft weiter drei Apps.
- `bash -n` für jedes geänderte Skript; `docker compose --env-file <test-env> config --quiet` für `compose.yml` und
  `compose.yml` mit `compose.local.yml`; `caddy validate` für das `Caddyfile`.
- `tools/stack-e2e/run.sh --ops` grün, mit der neuen Prüfung der Hinweisseite. Gegenprobe: Mit dem alten Block
  (`reverse_proxy app-treffsicher:3000`) muss die Prüfung rot werden. Den alten Block aus einer `cp`-Sicherung
  zurückspielen.
- `tools/stack-e2e/run.sh --keep`, dann der Ablauf aus Aufgabe 7 gegen den laufenden Stack. Die Hinweisseite im
  Browser-Pane über den Port von Caddy ansehen, hell und dunkel, bei 390 px und am Desktop. Dabei gilt kein seitliches
  Scrollen, und der Link führt auf den Host von Spiegel. Danach `--down`.
- Keine Skriptprüfung der Apps nötig, keine Dev-Datenbank berührt.

## Verification

- Jede Adresse unter dem Host von Treffsicher zeigt die Hinweisseite mit dem Text aus dem Textbuch und einem Link auf
  Spiegel.
- Kein Container von Treffsicher läuft. Build, Release und Deploy kennen nur noch Ringwerk und Spiegel.
- Datenbank, Anhänge und Backups von Treffsicher bleiben bis zum 1. Februar 2027. Der Ablauf zum Löschen steht fertig in
  den Operations.
- Spiegel hat 384 MB und Heap 192. Ringwerk wird beim Umschalten nicht neu gestartet.
- Schema, Migrationen und Brücke sind unverändert.
