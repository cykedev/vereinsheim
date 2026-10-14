#!/usr/bin/env bash
# Legt auf einem laufenden System fehlende App-Datenbanken an (P3, SP-1.9):
# db-init/01-users-and-dbs.sh läuft nur bei einem frischen postgres_data-Volume.
#
# Für jede App mit <APP>_DB_PASSWORD in der .env: Rolle und Datenbank anlegen, wenn
# sie fehlen, und PUBLIC die Rechte an der Datenbank entziehen (wie db-init). Eine
# vorhandene Rolle ändert das Skript nie; es prüft nur, ob die Anmeldung mit dem
# Passwort aus der .env klappt, und bricht sonst mit Hinweis ab.
# Das Passwort steht in keiner Kommandozeile: Es geht über die Umgebung in den
# Container (`exec -e NAME` ohne Wert) und dort per \getenv an psql.
#
# Aufruf vom Repo-Root oder über ./scripts/vereinsheim db-ensure:
#   ./scripts/db-ensure.sh
# ENV_FILE (Vorgabe .env), COMPOSE_PROJECT_NAME und COMPOSE_FILE wirken wie bei
# Compose üblich; so prüft tools/stack-e2e das Skript gegen einen eigenen Stack.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env}"
APPS=(ringwerk treffsicher spiegel)

if [[ ! -f "$ENV_FILE" ]]; then
	echo "ERROR: $ENV_FILE fehlt." >&2
	exit 1
fi

compose() { docker compose --env-file "$ENV_FILE" "$@"; }

if ! compose ps --status running --services 2>/dev/null | grep -qx db; then
	echo "ERROR: Der Dienst db läuft nicht." >&2
	exit 1
fi

# Werte so, wie Compose sie auflöst (Anführungszeichen, Kommentare am Zeilenende), damit Rolle und App dasselbe
# Passwort sehen; ohne `config --environment` (ältere Compose-Versionen) die Zeile aus der Datei
RESOLVED="$(compose config --environment 2>/dev/null || true)"
if [[ -z "$RESOLVED" ]]; then
	echo "Hinweis: docker compose config --environment fehlt, lese $ENV_FILE zeilenweise (Werte ohne Anführungszeichen)." >&2
fi
env_value() {
	if [[ -n "$RESOLVED" ]]; then
		sed -n "s/^$1=//p" <<<"$RESOLVED" | head -n 1
	else
		awk -F= -v k="$1" '/^[[:space:]]*#/ { next } $1 == k { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE"
	fi
}

# Rolle und Datenbank einer App: 2 = beide da, 0 = keine, 1 = halb (etwa nach einem Abbruch).
# ensure_app läuft links von `||`: Dort gilt `set -e` nicht, darum prüft jeder Schritt selbst.
present() {
	compose exec -T db psql -U postgres -d postgres -Atc \
		"SELECT (SELECT count(*) FROM pg_roles WHERE rolname = '$1') + (SELECT count(*) FROM pg_database WHERE datname = '$1')"
}

ensure_app() {
	local app="$1" key pw before
	key="$(tr '[:lower:]' '[:upper:]' <<<"$app")_DB_PASSWORD"
	pw="$(env_value "$key")"
	if [[ -z "$pw" ]]; then
		echo "  $app: $key fehlt in $ENV_FILE, übersprungen"
		return 0
	fi
	if ! before="$(present "$app")" || [[ -z "$before" ]]; then
		echo "ERROR: $app: Rollen und Datenbanken lassen sich nicht lesen." >&2
		return 1
	fi

	# scheitert ein CREATE ROLE, stünde der Befehl samt Passwort sonst im Log der Datenbank
	if ! APP_PW="$pw" compose exec -T -e APP_PW db \
		psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres -v app="$app" <<-'SQL'; then
		SET log_min_error_statement = panic;
		SET log_statement = none;
		\getenv app_pw APP_PW
		SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app', :'app_pw')
			WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app') \gexec
		SELECT format('CREATE DATABASE %I OWNER %I', :'app', :'app')
			WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'app') \gexec
		SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app') \gexec
	SQL
		echo "ERROR: $app: Anlegen gescheitert (Meldung von Postgres oben)." >&2
		return 1
	fi

	# über den Dienstnamen wie die Apps: Für 127.0.0.1 gilt im Postgres-Image `trust`, dort prüft niemand das Passwort
	if ! PGPASSWORD="$pw" compose exec -T -e PGPASSWORD db \
		psql -h db -U "$app" -d "$app" -Atc 'SELECT 1' >/dev/null; then
		echo "ERROR: $app: Anmeldung an der Datenbank $app scheitert (Meldung oben; meist passt das Passwort aus $ENV_FILE nicht zur vorhandenen Rolle)." >&2
		return 1
	fi

	if [[ "$before" == "2" ]]; then
		echo "  $app: war schon da"
	else
		echo "  $app: angelegt"
	fi
}

failed=0
for app in "${APPS[@]}"; do
	ensure_app "$app" || failed=1
done
exit "$failed"
