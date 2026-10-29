#!/usr/bin/env bash
# Betrieb gegen den Teststack: Deploy nacheinander mit Vorprüfung, Backup, Restore-Probe, Restore und
# Rollback, über die Skripte und das CLI.
# Läuft aus tools/stack-e2e/run.sh --ops, das ENV_FILE, COMPOSE_PROJECT_NAME und COMPOSE_FILE setzt;
# Backups und Deploy-Historie landen in einem eigenen Temp-Ordner. Ändert nichts außerhalb des Teststacks
# (SKIP_PRUNE: kein Aufräumen der Images des Rechners).
set -uo pipefail
cd "$(dirname "$0")/../.."

: "${ENV_FILE:?aus tools/stack-e2e/run.sh --ops aufrufen}"
: "${COMPOSE_PROJECT_NAME:?aus tools/stack-e2e/run.sh --ops aufrufen}"
# drop_spiegel löscht Datenbank und Rolle: nie gegen einen anderen Stack (etwa den lokalen mit Produktionsdaten)
if [[ "$COMPOSE_PROJECT_NAME" != "vereinsheim-e2e" ]]; then
	echo "ops.sh läuft nur gegen das Projekt vereinsheim-e2e, nicht gegen $COMPOSE_PROJECT_NAME." >&2
	exit 2
fi
WORK="$(mktemp -d)"
export BACKUP_DIR="$WORK/backups" HISTORY_FILE="$WORK/deploy-history.log" SKIP_PRUNE=1
export VEREINSHEIM_ENV_FILE="$ENV_FILE"
mkdir -p "$BACKUP_DIR"
trap 'rm -rf "$WORK"' EXIT

compose() { docker compose --env-file "$ENV_FILE" "$@"; }
sql() { compose exec -T db psql -U postgres -d postgres -Atc "$1"; }
spiegel_sql() { compose exec -T db psql -U postgres -d spiegel -v ON_ERROR_STOP=1 -Atc "$1"; }
cli() { ./scripts/vereinsheim "$@"; }

PROBLEMS=()
problem() {
	PROBLEMS+=("$1")
	echo "  FEHLER: $1"
}
# Befehl ausführen, Ausgabe ohne Farben sichern, Exit-Code zurückgeben
run() {
	"$@" >"$WORK/out.txt" 2>&1
	local rc=$?
	sed 's/\x1b\[[0-9;]*m//g' "$WORK/out.txt" >"$WORK/plain.txt"
	return "$rc"
}
expect_text() {
	grep -qF -- "$1" "$WORK/plain.txt" || problem "$2: erwartet „$1“"
}
spiegel_login() { curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://localhost:18082/login; }
wait_spiegel() {
	local code=000
	for _ in $(seq 60); do
		code="$(spiegel_login || true)"
		[[ "$code" == "200" ]] && break
		sleep 1
	done
	echo "$code"
}
# Migratoren nacheinander: Jeder startet erst nach dem Ende des vorigen, keiner danach noch einmal gleichzeitig
# (etwa durch ein abschließendes `up -d`). Sekunden reichen, ein Migrator braucht mehrere.
check_migrator_order() {
	local app id started finished prev_finished="" prev_app=""
	for app in ringwerk treffsicher spiegel; do
		id="$(compose ps -a -q "migrate-$app")"
		started="$(docker inspect -f '{{.State.StartedAt}}' "$id")"
		finished="$(docker inspect -f '{{.State.FinishedAt}}' "$id")"
		started="${started%%.*}"
		finished="${finished%%.*}"
		if [[ -n "$prev_finished" && "$started" < "$prev_finished" ]]; then
			problem "migrate-$app startete ($started) vor dem Ende von migrate-$prev_app ($prev_finished)"
		fi
		prev_finished="$finished"
		prev_app="$app"
	done
	echo "  Migratoren nacheinander, je einmal"
}

# Spiegel ohne Datenbank und Rolle (App und Migrator gestoppt)
drop_spiegel() {
	compose stop app-spiegel >/dev/null 2>&1
	compose rm -f -s migrate-spiegel >/dev/null 2>&1
	sql "DROP DATABASE IF EXISTS spiegel" >/dev/null
	sql "DROP ROLE IF EXISTS spiegel" >/dev/null
}

echo "==> db-ensure über das CLI (Wrapper)"
if run sh -c 'printf "y\n" | ./scripts/vereinsheim db-ensure'; then
	expect_text "spiegel: war schon da" "db-ensure"
	echo "  in Ordnung"
else
	problem "db-ensure endete mit Fehler"
	tail -5 "$WORK/plain.txt"
fi

echo "==> env-check über das CLI"
# Hosts wie :8080 sind im Teststack Absicht; „auffällig“ ist hier in Ordnung, „fehlend“ nicht
run cli env-check || problem "env-check meldet fehlende Schlüssel"
if grep -q "Fehlend" "$WORK/plain.txt"; then problem "env-check: Schlüssel fehlen"; else echo "  nichts fehlt"; fi

echo "==> Deploy nacheinander (mit Pre-Deploy-Backup)"
if run ./scripts/deploy.sh; then
	order="$(grep -E '^==> (ringwerk|treffsicher|spiegel):' "$WORK/plain.txt" | sed 's/^==> //; s/:.*//' | paste -sd ' ' -)"
	echo "  Reihenfolge: $order"
	[[ "$order" == "ringwerk treffsicher spiegel" ]] || problem "Deploy-Reihenfolge: $order"
	expect_text "==> Pre-Deploy-Backup" "Deploy"
	check_migrator_order
	tags="$(tail -n 1 "$HISTORY_FILE" | grep -o '_TAG=' | wc -l | tr -d ' ')"
	echo "  Historie: $tags Tags in der letzten Zeile"
	[[ "$tags" == "6" ]] || problem "Historie mit $tags statt 6 Tags"
else
	problem "deploy.sh endete mit Fehler"
	tail -15 "$WORK/plain.txt"
fi
[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach dem Deploy nicht erreichbar"

echo "==> Spiegel: Upload-Volume und Leser der Ausdrucke"
if compose exec -T app-spiegel sh -c 'mkdir -p /app/uploads/printouts && test -w /app/uploads/printouts'; then
	echo "  Upload-Volume beschreibbar"
else
	problem "Spiegel kann nicht ins Upload-Volume schreiben"
fi
(cd apps/spiegel && ./node_modules/.bin/tsx tools/printout-sample.ts) >"$WORK/sample.pdf"
compose exec -T app-spiegel node --max-old-space-size=48 --max-semi-space-size=2 --lite-mode \
	apps/spiegel/printout-reader.mjs \
	<"$WORK/sample.pdf" >"$WORK/reader.txt" 2>&1
if grep -q '"kind":"found"' "$WORK/reader.txt"; then
	echo "  liest den Ausdruck, $(grep -o '"maxRssKb":[0-9]*' "$WORK/reader.txt")"
else
	problem "printout-reader.mjs liest den Beispiel-Ausdruck nicht"
	tail -5 "$WORK/reader.txt"
fi

echo "==> Vorprüfung: Deploy ohne Rolle spiegel"
drop_spiegel
if run ./scripts/deploy.sh; then
	problem "Deploy lief trotz fehlender Rolle"
else
	expect_text "Es fehlt Rolle oder Datenbank für: spiegel" "Vorprüfung"
	echo "  bricht ab wie erwartet"
fi

echo "==> Backup ohne Datenbank spiegel"
if run ./scripts/backup.sh; then
	expect_text "skip: Datenbank spiegel gibt es nicht" "Backup ohne spiegel"
	expect_text "==> Pruning" "Backup ohne spiegel"
	echo "  läuft weiter, Uploads und Pruning laufen"
else
	problem "backup.sh brach ohne Datenbank spiegel ab"
	tail -5 "$WORK/plain.txt"
fi

echo "==> db-ensure, dann Deploy mit Backup (Datenbank spiegel noch leer)"
run ./scripts/db-ensure.sh || problem "db-ensure nach DROP"
expect_text "spiegel: angelegt" "db-ensure nach DROP"
if run ./scripts/deploy.sh; then
	expect_text "skip: Datenbank spiegel ist leer (noch nicht migriert)" "Backup vor dem Deploy"
	[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach erneutem Deploy nicht erreichbar"
	echo "  Backup überspringt die leere Datenbank, Spiegel läuft wieder"
else
	problem "Deploy nach db-ensure endete mit Fehler"
	tail -10 "$WORK/plain.txt"
fi

echo "==> Backup mit drei Apps"
# eine Marke im Volume der Ausdrucke: Der Restore muss sie zurückbringen
docker run --rm -v "${COMPOSE_PROJECT_NAME}_uploads_spiegel:/d" alpine \
	sh -c 'mkdir -p /d/printouts && echo e2e >/d/printouts/e2e-marker.txt'
rm -f "$BACKUP_DIR"/*
if run ./scripts/backup.sh; then
	for pattern in 'ringwerk-*.dump' 'treffsicher-*.dump' 'spiegel-*.dump' 'uploads-treffsicher-*.tar.gz' \
		'uploads-spiegel-*.tar.gz'; do
		compgen -G "$BACKUP_DIR/$pattern" >/dev/null || problem "Backup ohne $pattern"
	done
	echo "  $(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ') Dateien"
else
	problem "backup.sh endete mit Fehler"
	tail -5 "$WORK/plain.txt"
fi

echo "==> Restore-Probe über das CLI"
if run sh -c 'printf "y\\n" | ./scripts/vereinsheim restore-probe'; then
	grep -E '^  (ringwerk|treffsicher|spiegel): in Ordnung' "$WORK/plain.txt" | sed 's/^/ /'
	[[ "$(grep -cE '^  (ringwerk|treffsicher|spiegel): in Ordnung' "$WORK/plain.txt")" == "3" ]] ||
		problem "Restore-Probe: nicht alle drei in Ordnung"
else
	problem "Restore-Probe endete mit Fehler"
	tail -8 "$WORK/plain.txt"
fi
[[ "$(sql "SELECT count(*) FROM pg_database WHERE datname LIKE 'restore_probe_%'")" == "0" ]] ||
	problem "Restore-Probe hat Wegwerf-Datenbanken stehen lassen"

echo "==> Restore-Probe mit abgeschnittenem Dump"
good="$(ls -t "$BACKUP_DIR"/spiegel-*.dump | head -n 1)"
bad="$BACKUP_DIR/spiegel-9999-12-31_2359.dump"
head -c "$(($(wc -c <"$good") / 2))" "$good" >"$bad"
touch "$bad"
if run sh -c 'printf "y\\n" | ./scripts/vereinsheim restore-probe'; then
	problem "Restore-Probe merkt den abgeschnittenen Dump nicht"
else
	expect_text "spiegel: FEHLER" "Restore-Probe abgeschnitten"
	echo "  erkannt"
fi
rm -f "$bad"
[[ "$(sql "SELECT count(*) FROM pg_database WHERE datname LIKE 'restore_probe_%'")" == "0" ]] ||
	problem "Restore-Probe hat nach dem Fehler Wegwerf-Datenbanken stehen lassen"

# Stand des Backups: Spiegel hat sich seither nicht geändert
dump_migrations="$(spiegel_sql "SELECT count(*) FROM _prisma_migrations")"

echo "==> Restore von Spiegel mit abgeschnittenem Dump"
head -c "$(($(wc -c <"$good") / 2))" "$good" >"$bad"
if run ./scripts/restore.sh spiegel "$bad"; then
	problem "restore.sh spielte einen abgeschnittenen Dump ein"
else
	expect_text "die Datenbank spiegel ist unverändert" "Restore abgeschnitten"
	[[ "$(spiegel_sql "SELECT count(*) FROM _prisma_migrations")" == "$dump_migrations" ]] ||
		problem "Restore mit abgeschnittenem Dump hat die Datenbank spiegel verändert"
	echo "  bricht ab, Datenbank unverändert"
fi
rm -f "$bad"
[[ "$(sql "SELECT count(*) FROM pg_database WHERE datname = 'spiegel_restore'")" == "0" ]] ||
	problem "restore.sh hat spiegel_restore stehen lassen"

echo "==> Restore von Spiegel auf ein neueres Schema"
# wie nach einem Rollback: eine Tabelle, die der Dump nicht kennt, mit Fremdschlüssel auf eine Tabelle des Dumps,
# eine Spalte mehr und eine Migration mehr
spiegel_sql "SET ROLE spiegel;
	CREATE TABLE e2e_newer (id int PRIMARY KEY, \"userId\" text REFERENCES \"User\"(id));
	ALTER TABLE \"User\" ADD COLUMN e2e_extra text;
	INSERT INTO _prisma_migrations (id, checksum, migration_name) VALUES ('e2e-newer', '0', '99999999999999_e2e_newer')" \
	>/dev/null || problem "neueres Schema in spiegel ließ sich nicht anlegen"
docker run --rm -v "${COMPOSE_PROJECT_NAME}_uploads_spiegel:/d" alpine rm -f /d/printouts/e2e-marker.txt
spiegel_tar="$(ls -t "$BACKUP_DIR"/uploads-spiegel-*.tar.gz | head -n 1)"
if run ./scripts/restore.sh spiegel "$good" "$spiegel_tar"; then
	newer="$(spiegel_sql "SELECT (to_regclass('public.e2e_newer') IS NULL)::text || ' ' ||
		(SELECT count(*) FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'e2e_extra') || ' ' ||
		(SELECT count(*) FROM _prisma_migrations)")"
	[[ "$newer" == "true 0 $dump_migrations" ]] ||
		problem "nach dem Restore nicht der Stand des Dumps (Tabelle weg, Spalten, Migrationen: $newer, erwartet true 0 $dump_migrations)"
	owner="$(sql "SELECT pg_get_userbyid(datdba) || ' ' || datacl::text FROM pg_database WHERE datname = 'spiegel'")"
	[[ "$owner" == "spiegel {spiegel=CTc/spiegel}" ]] || problem "Datenbank spiegel nach dem Restore: Owner und Rechte $owner"
	[[ "$(sql "SELECT count(*) FROM pg_database WHERE datname = 'spiegel_restore'")" == "0" ]] ||
		problem "restore.sh hat spiegel_restore stehen lassen"
	echo "  Stand des Dumps, Owner spiegel, PUBLIC ohne Rechte"
	compose up -d migrate-spiegel app-spiegel >/dev/null 2>&1
	[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach dem Restore nicht erreichbar"
	if docker run --rm -v "${COMPOSE_PROJECT_NAME}_uploads_spiegel:/d:ro" alpine test -f /d/printouts/e2e-marker.txt; then
		echo "  eingespielt samt Ausdrucken, Spiegel läuft"
	else
		problem "Restore brachte die Ausdrucke von Spiegel nicht zurück"
	fi
else
	problem "restore.sh spiegel endete mit Fehler"
	tail -8 "$WORK/plain.txt"
fi
if run ./scripts/restore.sh ringwerk "$(ls -t "$BACKUP_DIR"/ringwerk-*.dump | head -n 1)" "$spiegel_tar"; then
	problem "restore.sh nahm einen Uploads-Tar für ringwerk an"
else
	expect_text "ringwerk hat kein Upload-Volume" "restore.sh mit Uploads"
fi
compose up -d app-spiegel >/dev/null 2>&1

echo "==> Rollback über das CLI (alter Eintrag ohne Spiegel-Tags)"
{
	echo "2000-01-01T00:00:00Z RINGWERK_TAG=latest RINGWERK_MIGRATOR_TAG=latest-migrator TREFFSICHER_TAG=latest TREFFSICHER_MIGRATOR_TAG=latest-migrator"
	cat "$HISTORY_FILE"
} >"$WORK/history.tmp"
mv "$WORK/history.tmp" "$HISTORY_FILE"
entries="$(wc -l <"$HISTORY_FILE" | tr -d ' ')"
if run sh -c "printf '%s\nY\n' $entries | ./scripts/vereinsheim rollback"; then
	expect_text "spiegel: bleibt auf dem aktuellen Tag" "Rollback"
	expect_text "Deployed. Status:" "Rollback"
	echo "  Spiegel bleibt, Deploy lief"
else
	problem "Rollback endete mit Fehler"
	tail -10 "$WORK/plain.txt"
fi
[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach dem Rollback nicht erreichbar"

echo
if [[ ${#PROBLEMS[@]} -eq 0 ]]; then
	echo "Betrieb gegen den Teststack: in Ordnung."
else
	echo "Betrieb gegen den Teststack: ${#PROBLEMS[@]} Fehler:"
	printf '  - %s\n' "${PROBLEMS[@]}"
	exit 1
fi
