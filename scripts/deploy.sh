#!/usr/bin/env bash
# Idempotenter Deploy auf dem VPS, je App nacheinander:
#   - Vorprüfung: die Datenbank-Rolle jeder App gibt es (db-init legt sie nur bei einem
#     frischen Volume an; sonst zuerst ./scripts/vereinsheim db-ensure)
#   - Pre-Deploy-Backup (Sicherheitsnetz, falls db läuft)
#   - aktuelle Images aus Docker Hub
#   - db und caddy, dann je App Migrator und App: immer nur ein Migrator (Speicher),
#     und ein Fehler trifft nur diese App, die vorigen sind fertig, die späteren unberührt.
#     Ohne `--wait` (je nach Compose-Version anders): `up -d app-<app>` wartet über
#     depends_on (service_completed_successfully) selbst auf den Migrator; db über
#     pg_isready, die App muss danach laufen und darf nicht neu starten.
#   - Tags aller Apps in die Deploy-Historie (für ./scripts/vereinsheim rollback)
#   - unbenutzte Images aufräumen (dangling sofort; getaggt nach >7 Tagen)
#
# Override:
#   SKIP_BACKUP=1 ./scripts/deploy.sh
#   - überspringt das Pre-Deploy-Backup (nützlich für Notfall-Redeploys
#     direkt nach gescheiterter Migration, wo der DB-State unverändert ist).
#   SKIP_PRUNE=1 ./scripts/deploy.sh
#   - räumt keine Images auf (lokale Tests: prune -a träfe alle ungenutzten Images des Rechners).
#   ENV_FILE (Vorgabe .env), HISTORY_FILE, BACKUP_DIR, COMPOSE_PROJECT_NAME und COMPOSE_FILE
#   wirken wie üblich; so prüft tools/stack-e2e/ops.sh den Deploy gegen den Teststack.
set -euo pipefail
cd "$(dirname "$0")/.."

export ENV_FILE="${ENV_FILE:-.env}"
HISTORY_FILE="${HISTORY_FILE:-logs/deploy-history.log}"
# shellcheck source=lib/apps.sh
. scripts/lib/apps.sh
# so lange darf db bis healthy und eine App bis „running“ brauchen
WAIT_SECONDS="${WAIT_SECONDS:-120}"

if [[ ! -f "$ENV_FILE" ]]; then
	echo "$ENV_FILE fehlt im Repo-Root. Aus .env.example anlegen und Werte setzen." >&2
	exit 1
fi

compose() { docker compose --env-file "$ENV_FILE" "$@"; }
db_running() { compose ps --status running --services 2>/dev/null | grep -qx db; }

# Vorprüfung: Ohne Rolle oder Datenbank scheitert der Migrator der App erst nach dem Neuaufbau
# der übrigen. Vor dem Backup, wenn db läuft, und noch einmal nach dem Start von db.
check_app_databases() {
	local app found missing=()
	for app in "${APPS[@]}"; do
		if ! found="$(compose exec -T db psql -U postgres -d postgres -Atc \
			"SELECT (SELECT count(*) FROM pg_roles WHERE rolname = '$app') + (SELECT count(*) FROM pg_database WHERE datname = '$app')")"; then
			echo "ERROR: Rollen und Datenbanken nicht lesbar." >&2
			exit 1
		fi
		[[ "$found" == "2" ]] || missing+=("$app")
	done
	if ((${#missing[@]} > 0)); then
		echo "ERROR: Es fehlt Rolle oder Datenbank für: ${missing[*]}." >&2
		echo "  Zuerst: ./scripts/vereinsheim db-ensure, dann erneut deployen." >&2
		exit 1
	fi
}

wait_db() {
	local _
	for _ in $(seq "$WAIT_SECONDS"); do
		compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && return 0
		sleep 1
	done
	echo "ERROR: db ist nach ${WAIT_SECONDS} s nicht bereit." >&2
	exit 1
}

# eine App läuft, wenn ihr Container „running“ ist und das 5 s lang ohne Neustart bleibt
wait_running() {
	local service="$1" id state restarts _
	for _ in $(seq "$WAIT_SECONDS"); do
		id="$(compose ps -q "$service")"
		if [[ -n "$id" ]]; then
			state="$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$id")"
			if [[ "$state" == running* ]]; then
				restarts="${state#* }"
				sleep 5
				[[ "$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$id")" == "running $restarts" ]] && return 0
			fi
		fi
		sleep 1
	done
	return 1
}

if db_running; then
	echo "==> Vorprüfung: Rollen und Datenbanken"
	check_app_databases
fi

# Pre-Deploy-Backup: nur wenn db schon läuft und nicht ausdrücklich übersprungen.
if [[ "${SKIP_BACKUP:-0}" == "1" ]]; then
	echo "==> SKIP_BACKUP=1 — Pre-Deploy-Backup übersprungen"
elif db_running; then
	echo "==> Pre-Deploy-Backup"
	./scripts/backup.sh
else
	echo "==> Pre-Deploy-Backup übersprungen (db läuft (noch) nicht)"
fi

echo "==> docker compose pull"
compose pull

echo "==> db und caddy"
compose up -d db
wait_db
# erst jetzt sicher: db lief vorher vielleicht nicht (etwa nach `vereinsheim down`)
check_app_databases
compose up -d caddy

for app in "${APPS[@]}"; do
	echo "==> ${app}: Migrator, dann App"
	# depends_on: erst migrate-<app> bis Exit 0, dann app-<app>; scheitert der Migrator, endet `up` mit Fehler
	if ! compose up -d "app-${app}" || ! wait_running "app-${app}"; then
		echo "ERROR: ${app} ließ sich nicht starten. Die Apps davor sind deployt, die danach unverändert." >&2
		echo "  Logs: docker compose logs migrate-${app} app-${app}" >&2
		echo "  Migrationen: ./scripts/vereinsheim migrations ${app}" >&2
		exit 1
	fi
done

# verwaiste Container entfernen, ohne die Migratoren noch einmal (und dann gleichzeitig) zu starten
echo "==> Rest abgleichen (verwaiste Container)"
services=(db caddy)
for app in "${APPS[@]}"; do services+=("app-${app}"); done
compose up -d --remove-orphans --no-deps "${services[@]}"

# Deploy-History: eine Zeile pro erfolgreichem Deploy, für `vereinsheim rollback`.
tag_pattern="$(printf '%s\n' "${APPS[@]}" | tr '[:lower:]' '[:upper:]' | paste -sd '|' -)"
mkdir -p "$(dirname "$HISTORY_FILE")"
{
	printf '%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	# ohne gepinnte Tags (Erst-Deploy mit latest) bleibt nur der Zeitpunkt
	{ grep -E "^(${tag_pattern})_(TAG|MIGRATOR_TAG)=" "$ENV_FILE" || true; } |
		awk '{ printf " %s", $0 }'
	printf '\n'
} >>"$HISTORY_FILE"

if [[ "${SKIP_PRUNE:-0}" == "1" ]]; then
	echo "==> SKIP_PRUNE=1 — Images bleiben"
else
	echo "==> Image prune (dangling)"
	docker image prune -f

	echo "==> Image prune (getaggt, ungenutzt seit >7 Tagen)"
	docker image prune -a -f --filter "until=168h"
fi

echo
echo "Deployed. Status:"
compose ps
echo
echo "Logs (Ctrl-C zum Beenden):"
echo "  docker compose logs -f$(printf ' app-%s' "${APPS[@]}") caddy"
