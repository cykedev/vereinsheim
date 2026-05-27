#!/usr/bin/env bash
# Idempotenter Deploy auf dem VPS:
#   - macht ein Pre-Deploy-Backup (Sicherheitsnetz, falls db läuft)
#   - zieht aktuelle Images aus Docker Hub
#   - startet/aktualisiert alle Services
#   - räumt unbenutzte Images auf (dangling sofort; getaggt nach >7 Tagen)
#
# Override:
#   SKIP_BACKUP=1 ./scripts/deploy.sh
#   - überspringt das Pre-Deploy-Backup (nützlich für Notfall-Redeploys
#     direkt nach gescheiterter Migration, wo der DB-State unverändert ist).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
	echo ".env fehlt im Repo-Root. Aus .env.example anlegen und Werte setzen." >&2
	exit 1
fi

# Pre-Deploy-Backup: nur wenn db schon läuft und nicht ausdrücklich übersprungen.
if [[ "${SKIP_BACKUP:-0}" == "1" ]]; then
	echo "==> SKIP_BACKUP=1 — Pre-Deploy-Backup übersprungen"
elif docker compose ps --status running --services 2>/dev/null | grep -qx db; then
	echo "==> Pre-Deploy-Backup"
	./scripts/backup.sh
else
	echo "==> Pre-Deploy-Backup übersprungen (db läuft (noch) nicht)"
fi

echo "==> docker compose pull"
docker compose pull

echo "==> docker compose up -d"
docker compose up -d --remove-orphans

# Deploy-History: eine Zeile pro erfolgreichem Deploy, für `vereinsheim rollback`.
mkdir -p logs
{
	printf '%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	grep -E '^(RINGWERK|TREFFSICHER)_(TAG|MIGRATOR_TAG)=' .env \
		| awk '{ printf " %s", $0 }'
	printf '\n'
} >>logs/deploy-history.log

echo "==> Image prune (dangling)"
docker image prune -f

echo "==> Image prune (getaggt, ungenutzt seit >7 Tagen)"
docker image prune -a -f --filter "until=168h"

echo
echo "Deployed. Status:"
docker compose ps
echo
echo "Logs (Ctrl-C zum Beenden):"
echo "  docker compose logs -f app-ringwerk app-treffsicher caddy"
