# Plan: Restore in eine frische Datenbank

> PIV-Handoff. Branch `feat/restore-clean-db` von `main`. Geschützte Pfade (`scripts/`): kein autonomes
> `/implement`, die Änderungen laufen von Hand in dieser Session. Kein Push, kein Deploy, Merge nur mit OK.

## Context (warum)

`scripts/restore.sh` (VPS), `vereinsheim dev-restore` und `vereinsheim local-up --restore` spielen einen Dump mit
`pg_restore --clean --if-exists` in die **laufende** Datenbank der App. Am 29. Oktober 2026 hinterließ das in der
Spiegel-Dev-DB (Prod-Dump von `main` auf dem Schema eines neueren Branches) einen Mischzustand: `Card` und `User`
mit alten Daten, `RawSnapshot` mit neuen, `_prisma_migrations` mit dem Stand von Prod; das nächste
`prisma migrate deploy` scheiterte mit „column already exists“.

**Ursache** (per `/debug` in einem Wegwerf-Postgres `postgres:15-alpine` nachgestellt):

1. `--clean` löscht nur die Objekte, **die im Dump stehen**. Tabellen, Spalten und Typen, die nur das neuere Schema
   kennt, bleiben stehen. Verweist eine solche Tabelle per Fremdschlüssel auf eine Tabelle des Dumps (`CardEvidence`
   → `Card`, `Diary*` → `User`), scheitern `DROP CONSTRAINT …_pkey` und `DROP TABLE` (kein `CASCADE`), das folgende
   `CREATE TABLE` scheitert an der vorhandenen Tabelle, und `COPY` hängt die Zeilen des Dumps an die alten an.
   Nachgestellt: `Card` hatte danach die Spalten des neuen Schemas und beide Zeilen (alt und Dump).
2. `pg_restore` ohne `--exit-on-error` macht nach jedem Fehler weiter und schreibt alles, was gelingt, sofort fest
   (keine Transaktion). Erst am Ende kommt Exit 1 („errors ignored on restore: 5“). Das CLI bricht dann über
   `set -e` ab, die Datenbank ist aber schon gemischt, und die übrigen Apps bleiben ungespielt; der Dump bleibt im
   Container unter `/tmp/restore.dump` liegen.
3. Auch ohne Fremdschlüssel bleibt jede Tabelle des neueren Schemas stehen, während `_prisma_migrations` den Stand
   des Dumps trägt; `migrate deploy` legt sie dann noch einmal an und scheitert.

Dasselbe trifft den VPS beim Restore nach einem Rollback (älterer Dump, neueres Schema).

**Funktionierendes Muster im Repo:** `scripts/restore-probe.sh` spielt in eine frisch angelegte Wegwerf-Datenbank mit
`--exit-on-error` und hat das Problem nicht. Gegenprobe im Wegwerf-Postgres: frische Datenbank + `--exit-on-error`
→ genau der Stand des Dumps, Owner `app`, `PUBLIC` ohne Rechte; ein abgeschnittener Dump bricht mit Exit 1 ab.

## Approach

Eine Funktion `restore_db` in **`scripts/lib/restore-db.sh`**, die alle drei Stellen nutzen (das CLI wrappt, statt
zu duplizieren):

```
restore_db <compose-funktion> <app> <dump-datei>
```

1. Wegwerf-Datenbank `<app>_restore`: `DROP DATABASE IF EXISTS` (ein Rest eines abgebrochenen Laufs),
   `CREATE DATABASE <app>_restore OWNER <app>`, `REVOKE ALL ON DATABASE <app>_restore FROM PUBLIC` (wie `db-init`).
2. `pg_restore -U postgres -d <app>_restore --no-owner --role=<app> --exit-on-error` mit dem Dump über stdin (wie
   `restore-probe.sh`; kein `cp`, keine Datei bleibt im Container liegen).
3. Scheitert das: Wegwerf-Datenbank löschen, Exit 1. **Die laufende Datenbank bleibt unberührt.**
4. Gelingt es: `DROP DATABASE <app> WITH (FORCE)` (trennt offene Verbindungen, etwa `pnpm dev` oder einen
   vergessenen Container), dann `ALTER DATABASE <app>_restore RENAME TO <app>`. Owner und Rechte gehen beim Umbenennen
   mit. Scheitert das Umbenennen, sagt die Meldung, dass die Daten in `<app>_restore` liegen.

Jeder Schritt prüft seinen Exit-Code selbst: Die Funktion läuft im CLI links von `||`, dort gilt `set -e` nicht
(gleiches Muster wie `probe_app` in `restore-probe.sh`).

Verworfen:

- `DROP SCHEMA public CASCADE` + `CREATE SCHEMA public`: Eigentümer und Rechte des Schemas müssten von Hand
  nachgebaut werden (in PG 15 gehört `public` `pg_database_owner`), und ein kaputter Dump ließe eine leere Datenbank
  zurück.
- Datenbank direkt löschen und neu anlegen, dann einspielen: einfacher, aber ein kaputter oder abgeschnittener Dump
  hinterlässt eine leere Produktionsdatenbank. Die Wegwerf-Datenbank kostet eine Umbenennung mehr und lässt bei einem
  Fehler alles stehen.
- `--single-transaction` auf der laufenden Datenbank: hilft nicht gegen Ursache 1 (die Fehler bleiben, nur
  zurückgerollt; der Restore gelänge nie).

Keine ADR berührt: ADR-009 (gleiche Mechanik für Cutover und Backup, `pg_dump -Fc`) bleibt; nur das Einspielen
ändert sich. ADR-002 (eine DB und ein Owner je App) bleibt gewahrt: Die neue Datenbank gehört der App-Rolle.

## Dateien

| Datei | Änderung |
| --- | --- |
| `scripts/lib/restore-db.sh` | neu: `restore_db` |
| `scripts/restore.sh` | `restore_db compose "$APP" "$DUMP_ABS"` statt `cp` + `pg_restore --clean` + `rm`; Kopfkommentar |
| `scripts/vereinsheim` | `source lib/restore-db.sh`; `cmd_dev_restore` und `_local_up_with_restore` rufen `restore_db dev_compose …` bzw. `restore_db local_compose …`, bei Fehler `err` + `return 1`/`exit 1` |
| `tools/stack-e2e/ops.sh` | zwei Fälle vor „Restore von Spiegel“ (unten) |
| `tools/stack-e2e/README.md` | Zeile `--ops` um die zwei Fälle ergänzen |
| `vault/operations/operations.md` | Abschnitt Recovery: Schritt 3 beschreibt die Wegwerf-Datenbank und den Tausch |
| `vault/operations/restore-from-backup.md` | TL;DR: „stop→Wegwerf-DB→Tausch→up“ |
| `vault/monorepo/monorepo.md` §6 | ein Satz: dev-restore ersetzt die Datenbank ganz, auch wenn das Schema neuer ist |
| `vault/incidents/restore-clean-mixed-schema.md` | neu: Incident-Note (Symptom, Ursache, Fix) |

## Tasks

1. **`scripts/lib/restore-db.sh`** anlegen:

   ```bash
   # restore_db <compose-funktion> <app> <dump>: spielt einen Dump (pg_dump -Fc) in eine frische Datenbank
   # <app>_restore und tauscht sie erst danach gegen <app>. …
   restore_db() {
   	local compose="$1" app="$2" dump="$3" scratch="$2_restore"
   	local -a psql=("$compose" exec -T -e PGOPTIONS='-c client_min_messages=warning' db
   		psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
   	"${psql[@]}" -c "DROP DATABASE IF EXISTS $scratch" -c "CREATE DATABASE $scratch OWNER $app" \
   		-c "REVOKE ALL ON DATABASE $scratch FROM PUBLIC" || { echo "…" >&2; return 1; }
   	if ! "$compose" exec -T db pg_restore -U postgres -d "$scratch" --no-owner --role="$app" --exit-on-error <"$dump"; then
   		"${psql[@]}" -c "DROP DATABASE IF EXISTS $scratch" || true
   		echo "pg_restore ist gescheitert, Datenbank $app unverändert." >&2
   		return 1
   	fi
   	"${psql[@]}" -c "DROP DATABASE IF EXISTS $app WITH (FORCE)" -c "ALTER DATABASE $scratch RENAME TO $app" || { …; return 1; }
   }
   ```

   `psql -c … -c …` läuft ohne Transaktion je Befehl, `DROP DATABASE` darf dort stehen. `bash -n` danach.
2. **`scripts/restore.sh`**: `. scripts/lib/restore-db.sh`; den Block „Copying dump“ bis `rm -f /tmp/restore.dump`
   ersetzen durch `echo "==> Restoring into a fresh database '$APP' (role=$APP)"` + `restore_db compose "$APP"
   "$DUMP_ABS"`. Kopfkommentar: einspielen in eine Wegwerf-Datenbank, Tausch erst danach. `bash -n`.
3. **`scripts/vereinsheim`**: `source "$SCRIPT_DIR/lib/restore-db.sh"` neben `apps.sh`. In `cmd_dev_restore` die
   Schleife: `restore_db dev_compose "$app" "$dump" || { err "Restore von $app gescheitert, die Dev-Datenbank $app
   ist unverändert."; return 1; }`; Kommentar über der Schleife anpassen. In `_local_up_with_restore` dasselbe mit
   `local_compose` und `exit 1` (die Funktion nutzt sonst `exit`). `bash -n`.
4. **`tools/stack-e2e/ops.sh`**, vor „==> Restore von Spiegel“:
   - „Restore von Spiegel mit abgeschnittenem Dump“: Migrationen in `spiegel` zählen, `restore.sh spiegel "$bad"`
     (abgeschnittener Dump wie bei der Probe) → muss scheitern; danach gleiche Zahl Migrationen in `spiegel` und
     keine Datenbank `spiegel_restore`.
   - „Restore auf ein neueres Schema“: in `spiegel` als Rolle `spiegel` eine Tabelle `e2e_newer` mit Fremdschlüssel
     auf `"User"(id)` anlegen und eine Spalte `e2e_extra` an `"User"` hängen; dann der vorhandene Restore von
     Spiegel. Danach prüfen: `e2e_newer` und `e2e_extra` sind weg, Migrationen in `spiegel` = Migrationen im Dump
     (über `pg_restore -l` nicht zählbar, daher die Zahl vor dem Anlegen der Tabelle festhalten: das Backup kam aus
     genau diesem Stand), Owner der Datenbank ist `spiegel`, `PUBLIC` hat keine Rechte, keine `spiegel_restore`.
   README-Zeile `--ops` ergänzen.
5. **Vault**: die vier Notes oben; `vault-lint` grün (`node .claude/vault-lint.mjs` bzw. `/sync-graph`).
6. **Gate**: `pnpm check` im Worktree (nur Skripte und Doku geändert, der Lauf muss trotzdem grün sein).

## Required Docs

- `vault/operations/operations.md` (Recovery, Restore-Test), `vault/operations/restore-from-backup.md`
- `vault/decisions/adr-002.md`, `adr-009.md`
- `scripts/restore-probe.sh` (Muster), `db-init/01-users-and-dbs.sh`, `dev/db-init/01-create-dev-dbs.sh`
- `tools/stack-e2e/README.md`, `tools/stack-e2e/ops.sh`

## Test steps / Verification

1. **Probe der Funktion** gegen einen Wegwerf-Container `postgres:15-alpine` (Compose-Funktion als Shim auf
   `docker exec -i`): Ziel mit neuerem Schema (Tabelle mit FK auf eine Tabelle des Dumps, Zusatzspalte, mehr
   Migrationen) und offener Verbindung (wie `pnpm dev`) → nach `restore_db` genau der Stand des Dumps; abgeschnittener
   Dump → Exit 1, Ziel unverändert, kein `<app>_restore`.
2. **Ende zu Ende**: `tools/stack-e2e/run.sh --ops` grün, mit den zwei neuen Fällen.
3. **Gegenprobe**: dieselben Fälle mit dem alten `pg_restore --clean` (Funktion testweise zurückgedreht) müssen in
   `ops.sh` rot werden.
4. `bash -n` auf alle geänderten Skripte; `pnpm check` grün.

Nicht geprüft wird `dev-restore` gegen die echte Dev-DB (die frischt der User selbst auf); es nutzt dieselbe Funktion
wie `restore.sh`.
