#!/usr/bin/env bash
# Abgleich der Konten von Treffsicher und Spiegel vor der Übernahme (ADR-033, Stufe 3). Holt je App eine CSV der
# Konten (nur lesend) und schreibt daraus Bericht und Vorschlag der Zuordnung nach reports/tis-v1/ (gitignored: Namen
# und E-Mails, ADR-029). Keine Verbindung zwischen den Datenbanken (ADR-002).
#
#   accounts.sh dev    gegen den Dev-Postgres aus docker-compose.dev.yml
#   accounts.sh prod   gegen Prod über ssh (VPS_HOST, VPS_REPO_PATH aus .vereinsheim.local); nur der User
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$root/reports/tis-v1"
mode="${1:-}"

case "$mode" in
dev) ;;
prod)
	if [[ ! -f "$root/.vereinsheim.local" ]]; then
		echo "accounts.sh prod braucht .vereinsheim.local (VPS_HOST, VPS_REPO_PATH)" >&2
		exit 1
	fi
	set -a
	# shellcheck disable=SC1091
	source "$root/.vereinsheim.local"
	set +a
	: "${VPS_HOST:?VPS_HOST in .vereinsheim.local fehlt}"
	: "${VPS_REPO_PATH:?VPS_REPO_PATH in .vereinsheim.local fehlt}"
	;;
*)
	echo "Aufruf: accounts.sh dev|prod" >&2
	exit 1
	;;
esac

# SQL über stdin: docker exec ohne -T verschluckt es still.
query() {
	local db="$1" sql="$2"
	if [[ "$mode" == dev ]]; then
		docker compose -f "$root/docker-compose.dev.yml" exec -T db \
			psql -U postgres -d "$db" --csv -v ON_ERROR_STOP=1 <"$sql"
	else
		ssh "$VPS_HOST" "cd $VPS_REPO_PATH && docker compose exec -T db psql -U postgres -d $db --csv -v ON_ERROR_STOP=1" <"$sql"
	fi
}

umask 077
mkdir -p "$out"
for app in treffsicher spiegel; do
	query "$app" "$here/$app-accounts.sql" >"$out/$app.csv"
	lines="$(wc -l <"$out/$app.csv" | tr -d ' ')"
	if ((lines < 2)); then
		echo "$app: keine Konten in der CSV ($out/$app.csv)" >&2
		exit 1
	fi
	echo "$app: $((lines - 1)) Konten"
done

pnpm --dir "$root/apps/spiegel" exec tsx "$here/accounts-report.ts" "$out" "$mode"
