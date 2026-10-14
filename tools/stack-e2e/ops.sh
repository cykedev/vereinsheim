#!/usr/bin/env bash
# Betrieb gegen den Teststack (P4, plans/2026-10-14-spiegel-ops.md, T8): Deploy nacheinander mit
# Vorprüfung, Backup, Restore-Probe, Restore und Rollback, über die Skripte und das CLI.
# Läuft aus tools/stack-e2e/run.sh --ops, das ENV_FILE, COMPOSE_PROJECT_NAME und COMPOSE_FILE setzt;
# Backups und Deploy-Historie landen in einem eigenen Temp-Ordner. Ändert nichts außerhalb des Teststacks
# (SKIP_PRUNE: kein Aufräumen der Images des Rechners).
set -uo pipefail
cd "$(dirname "$0")/../.."

: "${ENV_FILE:?aus tools/stack-e2e/run.sh --ops aufrufen}"
: "${COMPOSE_PROJECT_NAME:?aus tools/stack-e2e/run.sh --ops aufrufen}"
WORK="$(mktemp -d)"
export BACKUP_DIR="$WORK/backups" HISTORY_FILE="$WORK/deploy-history.log" SKIP_PRUNE=1
export VEREINSHEIM_ENV_FILE="$ENV_FILE"
mkdir -p "$BACKUP_DIR"
trap 'rm -rf "$WORK"' EXIT

compose() { docker compose --env-file "$ENV_FILE" "$@"; }
sql() { compose exec -T db psql -U postgres -d postgres -Atc "$1"; }
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
# Spiegel ohne Datenbank und Rolle (App und Migrator gestoppt)
drop_spiegel() {
	compose stop app-spiegel >/dev/null 2>&1
	compose rm -f -s migrate-spiegel >/dev/null 2>&1
	sql "DROP DATABASE IF EXISTS spiegel" >/dev/null
	sql "DROP ROLE IF EXISTS spiegel" >/dev/null
}

echo "==> db-ensure über das CLI (P3: Wrapper)"
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
	tags="$(tail -n 1 "$HISTORY_FILE" | grep -o '_TAG=' | wc -l | tr -d ' ')"
	echo "  Historie: $tags Tags in der letzten Zeile"
	[[ "$tags" == "6" ]] || problem "Historie mit $tags statt 6 Tags"
else
	problem "deploy.sh endete mit Fehler"
	tail -15 "$WORK/plain.txt"
fi
[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach dem Deploy nicht erreichbar"

echo "==> Vorprüfung: Deploy ohne Rolle spiegel"
drop_spiegel
if run ./scripts/deploy.sh; then
	problem "Deploy lief trotz fehlender Rolle"
else
	expect_text "Es fehlt die Datenbank-Rolle für: spiegel" "Vorprüfung"
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

echo "==> db-ensure, dann Deploy ohne Backup"
run ./scripts/db-ensure.sh || problem "db-ensure nach DROP"
expect_text "spiegel: angelegt" "db-ensure nach DROP"
if run env SKIP_BACKUP=1 ./scripts/deploy.sh; then
	[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach erneutem Deploy nicht erreichbar"
	echo "  Spiegel läuft wieder"
else
	problem "Deploy nach db-ensure endete mit Fehler"
	tail -10 "$WORK/plain.txt"
fi

echo "==> Backup mit drei Apps"
rm -f "$BACKUP_DIR"/*
if run ./scripts/backup.sh; then
	for pattern in 'ringwerk-*.dump' 'treffsicher-*.dump' 'spiegel-*.dump' 'uploads-treffsicher-*.tar.gz'; do
		compgen -G "$BACKUP_DIR/$pattern" >/dev/null || problem "Backup ohne $pattern"
	done
	echo "  $(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ') Dateien"
else
	problem "backup.sh endete mit Fehler"
	tail -5 "$WORK/plain.txt"
fi

echo "==> Restore-Probe über das CLI"
if run cli restore-probe; then
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
if run cli restore-probe; then
	problem "Restore-Probe merkt den abgeschnittenen Dump nicht"
else
	expect_text "spiegel: FEHLER" "Restore-Probe abgeschnitten"
	echo "  erkannt"
fi
rm -f "$bad"

echo "==> Restore von Spiegel"
if run ./scripts/restore.sh spiegel "$good"; then
	compose up -d migrate-spiegel app-spiegel >/dev/null 2>&1
	[[ "$(wait_spiegel)" == "200" ]] || problem "Spiegel nach dem Restore nicht erreichbar"
	echo "  eingespielt, Spiegel läuft"
else
	problem "restore.sh spiegel endete mit Fehler"
	tail -8 "$WORK/plain.txt"
fi
if run ./scripts/restore.sh spiegel "$good" "$BACKUP_DIR/$(basename "$(ls "$BACKUP_DIR"/uploads-treffsicher-*.tar.gz | head -n 1)")"; then
	problem "restore.sh nahm einen Uploads-Tar für spiegel an"
else
	expect_text "spiegel hat kein Upload-Volume" "restore.sh mit Uploads"
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
