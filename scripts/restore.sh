#!/usr/bin/env bash
# Restored einen Postgres-Dump (custom format) in die zugehörige App-DB
# und (optional) einen Uploads-Tar in das zugehörige Volume.
#
# Wird verwendet für:
#   - initialer Cutover von alter Umgebung auf VPS
#   - Recovery aus einem Backup
#
# WICHTIG: Vor dem Aufruf muss die App-Service gestoppt sein, damit
# keine Connections die Restore blockieren:
#   docker compose stop app-<app>
#
# Postgres wird automatisch hochgefahren, falls nicht aktiv.
set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
	cat <<-EOF
		Usage: $0 <ringwerk|treffsicher> <dump-file> [uploads-tar.gz]

		Beispiele:
		  $0 ringwerk    ~/migration/ringwerk-2026-05-11.dump
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
ringwerk | treffsicher) ;;
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

DUMP_ABS="$(realpath "$DUMP")"
VOLUME_PREFIX="vereinsheim"

echo "==> Ensuring db service is up and healthy"
docker compose up -d db
# Warten bis healthy
for _ in $(seq 1 30); do
	if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
		break
	fi
	sleep 1
done

echo "==> Copying dump into db container"
docker compose cp "$DUMP_ABS" db:/tmp/restore.dump

echo "==> Restoring into database '$APP' (--clean --if-exists, role=$APP)"
docker compose exec -T db pg_restore \
	-U postgres \
	-d "$APP" \
	--clean --if-exists \
	--no-owner \
	--role="$APP" \
	/tmp/restore.dump

docker compose exec -T db rm -f /tmp/restore.dump

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
