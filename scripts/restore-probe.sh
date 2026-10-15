#!/usr/bin/env bash
# Restore-Probe (vault/operations/restore-test.md):
# prüft, ob sich die Sicherungen einspielen lassen, ohne die laufenden Datenbanken anzufassen.
# Je App: neuester Dump aus dem Backup-Ordner → Wegwerf-Datenbank restore_probe_<app> im
# db-Container → Tabellen in public und angewandte Migrationen zählen → Wegwerf-Datenbank löschen.
#
# In Ordnung ist eine App, wenn pg_restore durchläuft und Tabellen und Migrationen da sind.
# Weicht die Zahl von der laufenden Datenbank ab, ist das ein Hinweis (ein Deploy nach dem
# Backup bringt neue Migrationen), kein Fehler. Ein fehlender Dump ist ein Fehler, außer die
# App hat noch gar keine Datenbank (etwa Spiegel vor `vereinsheim db-ensure`).
#
#   ./scripts/restore-probe.sh            (oder ./scripts/vereinsheim restore-probe)
#
# BACKUP_DIR (Vorgabe /var/backups/vereinsheim), ENV_FILE (Vorgabe .env), COMPOSE_PROJECT_NAME
# und COMPOSE_FILE aus der Umgebung: so prüft tools/stack-e2e/ops.sh die Probe gegen den Teststack.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vereinsheim}"
# shellcheck source=lib/apps.sh
. scripts/lib/apps.sh

compose() { docker compose --env-file "$ENV_FILE" "$@"; }
# ohne NOTICE-Zeilen (DROP … IF EXISTS)
psql_at() { compose exec -T -e PGOPTIONS='-c client_min_messages=warning' db psql -U postgres -v ON_ERROR_STOP=1 -At "$@"; }

# Ctrl-C oder Abbruch: die gerade benutzte Wegwerf-Datenbank nicht stehen lassen
CURRENT_PROBE=""
cleanup() {
	[[ -z "$CURRENT_PROBE" ]] || psql_at -d postgres -c "DROP DATABASE IF EXISTS $CURRENT_PROBE" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

if ! compose ps --status running --services 2>/dev/null | grep -qx db; then
	echo "ERROR: Der Dienst db läuft nicht." >&2
	exit 1
fi

# "<Tabellen in public>|<angewandte Migrationen>" einer Datenbank; ohne _prisma_migrations 0 Migrationen
counts() {
	local db="$1" tables migrations=0
	tables="$(psql_at -d "$db" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")" || return 1
	if [[ "$(psql_at -d "$db" -c "SELECT to_regclass('public._prisma_migrations') IS NOT NULL")" == "t" ]]; then
		migrations="$(psql_at -d "$db" -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")" || return 1
	fi
	echo "$tables|$migrations"
}

# läuft links von `||` (set -e gilt dort nicht): jeder Schritt prüft selbst
probe_app() {
	local app="$1" probe="restore_probe_$1" dump live restored tables migrations
	dump="$(ls -t "$BACKUP_DIR/$app"-*.dump 2>/dev/null | head -n 1 || true)"
	if [[ -z "$dump" ]]; then
		# ohne Dump in Ordnung nur, solange die App noch keine (oder eine leere) Datenbank hat
		local exists tables_live
		if ! exists="$(psql_at -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$app'")"; then
			echo "  $app: FEHLER, Datenbanken nicht lesbar"
			return 1
		fi
		if [[ "$exists" != "1" ]]; then
			echo "  $app: noch keine Datenbank und kein Dump, übersprungen"
			return 0
		fi
		if ! tables_live="$(psql_at -d "$app" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"; then
			echo "  $app: FEHLER, Datenbank $app nicht lesbar"
			return 1
		fi
		if [[ "$tables_live" == "0" ]]; then
			echo "  $app: Datenbank noch leer (nicht migriert) und kein Dump, übersprungen"
			return 0
		fi
		echo "  $app: FEHLER, kein Dump in $BACKUP_DIR"
		return 1
	fi
	echo "  $app: $(basename "$dump")"
	CURRENT_PROBE="$probe"
	if ! psql_at -d postgres -c "DROP DATABASE IF EXISTS $probe" >/dev/null ||
		! psql_at -d postgres -c "CREATE DATABASE $probe" >/dev/null ||
		! psql_at -d postgres -c "REVOKE ALL ON DATABASE $probe FROM PUBLIC" >/dev/null; then
		echo "  $app: FEHLER, Wegwerf-Datenbank $probe ließ sich nicht anlegen"
		return 1
	fi
	local result=0
	if ! compose exec -T db pg_restore -U postgres -d "$probe" --no-owner --no-privileges --exit-on-error <"$dump"; then
		echo "  $app: FEHLER, pg_restore ist gescheitert"
		result=1
	elif ! restored="$(counts "$probe")"; then
		echo "  $app: FEHLER, eingespielte Datenbank nicht lesbar"
		result=1
	else
		tables="${restored%%|*}"
		migrations="${restored##*|}"
		if ((tables == 0 || migrations == 0)); then
			echo "  $app: FEHLER, eingespielt: Tabellen $tables, Migrationen $migrations"
			result=1
		else
			live="$(counts "$app" 2>/dev/null || echo "?|?")"
			echo "  $app: in Ordnung, Tabellen $tables, Migrationen $migrations (laufend: ${live%%|*} und ${live##*|})"
			[[ "$live" == "$restored" ]] ||
				echo "  $app: Hinweis, weicht von der laufenden Datenbank ab (Deploy nach dem Backup?)"
		fi
	fi
	psql_at -d postgres -c "DROP DATABASE IF EXISTS $probe" >/dev/null ||
		echo "  $app: Hinweis, $probe ließ sich nicht löschen"
	CURRENT_PROBE=""
	return "$result"
}

echo "==> Restore-Probe aus $BACKUP_DIR"
failed=0
for app in "${APPS[@]}"; do
	probe_app "$app" || failed=1
done
if ((failed)); then
	echo "Restore-Probe: FEHLER (siehe oben)." >&2
	exit 1
fi
echo "Restore-Probe: in Ordnung."
