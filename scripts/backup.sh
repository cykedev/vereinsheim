#!/usr/bin/env bash
# Erstellt:
#   - pg_dump (custom format) beider Datenbanken
#   - tar.gz beider Upload-Volumes
# Behält die letzten BACKUP_RETAIN_DAYS Tage (Default 14).
#
# Aufruf vom Repo-Root oder via Cron-Eintrag mit absolutem Pfad:
#   0 3 * * * /home/deploy/vereinsheim/scripts/backup.sh \
#       >> /var/log/vereinsheim-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${BACKUP_DIR:-/var/backups/vereinsheim}"
TS="$(date +%F_%H%M)"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

mkdir -p "$OUT"

echo "==> [$TS] Postgres dumps → $OUT"
docker compose exec -T db pg_dump -U postgres -Fc ringwerk    > "$OUT/ringwerk-$TS.dump"
docker compose exec -T db pg_dump -U postgres -Fc treffsicher > "$OUT/treffsicher-$TS.dump"

# Volume-Namen werden vom compose-Project-Namen geprefixt (siehe `name:` in compose.yml).
VOLUME_PREFIX="vereinsheim"

echo "==> Upload archives"
docker run --rm \
	-v "${VOLUME_PREFIX}_uploads_ringwerk":/src:ro \
	-v "$OUT":/out \
	alpine tar czf "/out/uploads-ringwerk-$TS.tar.gz" -C /src .
docker run --rm \
	-v "${VOLUME_PREFIX}_uploads_treffsicher":/src:ro \
	-v "$OUT":/out \
	alpine tar czf "/out/uploads-treffsicher-$TS.tar.gz" -C /src .

echo "==> Pruning files older than ${RETAIN_DAYS} days"
find "$OUT" -name '*.dump' -mtime "+${RETAIN_DAYS}" -delete
find "$OUT" -name '*.tar.gz' -mtime "+${RETAIN_DAYS}" -delete

echo "==> Current backup directory:"
ls -lh "$OUT" | tail -20
