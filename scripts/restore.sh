#!/usr/bin/env bash
# Restored einen Postgres-Dump (custom format) in die zugehörige App-DB
# und (optional) einen Uploads-Tar in das zugehörige Volume.
#
# Wird verwendet für:
#   - initialer Cutover von alter Umgebung auf VPS
#   - Recovery aus einem Backup
#
# Postgres wird automatisch hochgefahren, falls nicht aktiv.
#
# ENV_FILE (Vorgabe .env), COMPOSE_PROJECT_NAME und COMPOSE_FILE aus der Umgebung:
# so prüft tools/stack-e2e/ops.sh den Restore gegen den Teststack.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env}"
compose() { docker compose --env-file "$ENV_FILE" "$@"; }

usage() {
	cat <<-EOF
		Usage: $0 <ringwerk|treffsicher|spiegel> <dump-file> [uploads-tar.gz]

		Ein Uploads-Tar nur für Treffsicher (die anderen Apps haben kein Upload-Volume).

		Beispiele:
		  $0 ringwerk    ~/migration/ringwerk-2026-05-11.dump
		  $0 spiegel     ~/migration/spiegel-2026-10-20.dump
		  $0 treffsicher ~/migration/treffsicher-2026-05-11.dump \\
		                ~/migration/uploads-treffsicher-2026-05-11.tar.gz
	EOF
	exit 1
}

[[ $# -lt 2 || $# -gt 3 ]] && usage

APP="$1"
DUMP="$2"
UPLOADS="${3:-}"

case "$APP" in
ringwerk | treffsicher | spiegel) ;;
*)
	echo "Unknown app: $APP" >&2
	usage
	;;
esac

[[ -f "$DUMP" ]] || {
	echo "Dump file not found: $DUMP" >&2
	exit 1
}
[[ -z "$UPLOADS" || -f "$UPLOADS" ]] || {
	echo "Uploads tar not found: $UPLOADS" >&2
	exit 1
}
[[ -z "$UPLOADS" || "$APP" == "treffsicher" ]] || {
	echo "$APP hat kein Upload-Volume, ein Uploads-Tar passt nur zu treffsicher." >&2
	exit 1
}

echo "==> Stopping app-${APP} and migrate-${APP} (if running)"
compose stop "app-${APP}" "migrate-${APP}" 2>/dev/null || true

DUMP_ABS="$(realpath "$DUMP")"
VOLUME_PREFIX="${COMPOSE_PROJECT_NAME:-vereinsheim}"

echo "==> Ensuring db service is up and healthy"
compose up -d db
# Warten bis healthy
for _ in $(seq 1 30); do
	if compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
		break
	fi
	sleep 1
done

echo "==> Copying dump into db container"
compose cp "$DUMP_ABS" db:/tmp/restore.dump

echo "==> Restoring into database '$APP' (--clean --if-exists, role=$APP)"
compose exec -T db pg_restore \
	-U postgres \
	-d "$APP" \
	--clean --if-exists \
	--no-owner \
	--role="$APP" \
	/tmp/restore.dump

compose exec -T db rm -f /tmp/restore.dump

if [[ -n "$UPLOADS" ]]; then
	UPLOADS_ABS="$(realpath "$UPLOADS")"
	echo "==> Extracting uploads into volume ${VOLUME_PREFIX}_uploads_${APP}"
	docker run --rm \
		-v "${VOLUME_PREFIX}_uploads_${APP}":/dst \
		-v "$UPLOADS_ABS:/tmp/uploads.tar.gz:ro" \
		alpine sh -c 'cd /dst && tar xzf /tmp/uploads.tar.gz'
fi

echo
echo "Restore done. Next steps:"
echo "  docker compose up -d migrate-${APP}    # nachfahren etwaiger neuer Migrations"
echo "  docker compose up -d app-${APP}"
