#!/usr/bin/env bash
# Erstellt:
#   - pg_dump (custom format) jeder App-Datenbank, die es gibt (eine fehlende,
#     etwa Spiegel vor `vereinsheim db-ensure`, meldet es und läuft weiter)
#   - tar.gz der Upload-Volumes (nur Treffsicher hat eins)
# Behält die letzten BACKUP_RETAIN_DAYS Tage (Default 14), aber
# immer mindestens BACKUP_MIN_KEEP Dumps/Archive pro App (Default 7),
# auch wenn diese älter als RETAIN_DAYS sind. So bleibt nach einer
# Reihe fehlgeschlagener oder kaputter Backups immer ein Fallback.
#
# Aufruf vom Repo-Root oder via Cron-Eintrag mit absolutem Pfad:
#   0 3 * * * /home/deploy/vereinsheim/scripts/backup.sh \
#       >> /home/deploy/vereinsheim/logs/backup.log 2>&1
#
# ENV_FILE (Vorgabe .env), BACKUP_DIR, COMPOSE_PROJECT_NAME und COMPOSE_FILE aus der
# Umgebung: so prüft tools/stack-e2e/ops.sh das Backup gegen den Teststack.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env}"
APPS=(ringwerk treffsicher spiegel)
UPLOAD_APPS=(treffsicher)
compose() { docker compose --env-file "$ENV_FILE" "$@"; }

OUT="${BACKUP_DIR:-/var/backups/vereinsheim}"
TS="$(date +%F_%H%M)"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
MIN_KEEP="${BACKUP_MIN_KEEP:-7}"
MIN_DUMP_BYTES="${BACKUP_MIN_DUMP_BYTES:-1024}"

mkdir -p "$OUT"

# Schreibt erst in eine .tmp-Datei, prüft das pg-custom-format-Magic
# ("PGDMP") und die Mindestgröße, und benennt nur bei Erfolg um. So
# bleibt nie eine korrupte/leere Datei mit dem finalen Namen liegen.
dump_db() {
	local app="$1"
	local final="$OUT/${app}-$TS.dump"
	local tmp="${final}.tmp"

	compose exec -T db pg_dump -U postgres -Fc "$app" > "$tmp"

	local size
	size=$(stat -c %s "$tmp" 2>/dev/null || stat -f %z "$tmp")
	if [[ "$size" -lt "$MIN_DUMP_BYTES" ]]; then
		rm -f "$tmp"
		echo "ERROR: $app dump suspiciously small (${size} bytes < ${MIN_DUMP_BYTES})" >&2
		return 1
	fi

	# Magic-Check: pg_dump -Fc startet immer mit "PGDMP".
	local magic
	magic=$(head -c 5 "$tmp")
	if [[ "$magic" != "PGDMP" ]]; then
		rm -f "$tmp"
		echo "ERROR: $app dump is not a valid pg custom-format file" >&2
		return 1
	fi

	mv "$tmp" "$final"
	echo "  ok: $(basename "$final") ($((size/1024)) KiB)"
}

# Tarball auch atomar: erst .tmp, dann mv.
archive_uploads() {
	local app="$1"
	local volume="$2"
	local final="$OUT/uploads-${app}-$TS.tar.gz"
	local tmp="${final}.tmp"

	# tar läuft als root im Container, damit es das von der App-UID (1001,
	# Mode 770) geschriebene Upload-Volume überhaupt lesen kann. Damit die
	# Ausgabedatei auf dem Host trotzdem deploy gehört, chownen wir sie noch
	# im Container (vor dem mv) — sonst landet sie als root:root im Host-FS.
	local tmp_name
	tmp_name="$(basename "$tmp")"
	docker run --rm \
		-v "${volume}":/src:ro \
		-v "$OUT":/out \
		-e HOST_UID="$(id -u)" \
		-e HOST_GID="$(id -g)" \
		-e TMP_NAME="$tmp_name" \
		alpine sh -c 'tar czf "/out/$TMP_NAME" -C /src . && chown "$HOST_UID:$HOST_GID" "/out/$TMP_NAME"'

	# tar erzeugt mindestens ~30 Bytes selbst für leere Volumes.
	local size
	size=$(stat -c %s "$tmp" 2>/dev/null || stat -f %z "$tmp")
	if [[ "$size" -lt 32 ]]; then
		rm -f "$tmp"
		echo "ERROR: $app uploads archive empty/corrupt (${size} bytes)" >&2
		return 1
	fi

	mv "$tmp" "$final"
	echo "  ok: $(basename "$final") ($((size/1024)) KiB)"
}

# Prune mit Min-Keep-Floor: sortiere Dateien nach mtime (neuste zuerst),
# behalte immer die ersten MIN_KEEP, lösche vom Rest alles, was älter
# als RETAIN_DAYS ist.
prune_pattern() {
	local pattern="$1"
	mapfile -t files < <(find "$OUT" -maxdepth 1 -name "$pattern" -type f -printf '%T@ %p\n' 2>/dev/null \
		| sort -rn | awk '{print $2}')
	local total=${#files[@]}
	if (( total <= MIN_KEEP )); then
		echo "  keep all ${total} (≤ MIN_KEEP=${MIN_KEEP}): $pattern"
		return
	fi
	local deleted=0
	for ((i=MIN_KEEP; i<total; i++)); do
		local f="${files[i]}"
		if [[ -n "$(find "$f" -mtime "+${RETAIN_DAYS}" 2>/dev/null)" ]]; then
			rm -f "$f"
			deleted=$((deleted+1))
		fi
	done
	echo "  pruned $deleted of $((total-MIN_KEEP)) candidates older than ${RETAIN_DAYS}d: $pattern"
}

echo "==> [$TS] Postgres dumps → $OUT"
for app in "${APPS[@]}"; do
	exists="$(compose exec -T db psql -U postgres -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$app'")"
	if [[ "$exists" == "1" ]]; then
		dump_db "$app"
	else
		echo "  skip: Datenbank $app gibt es nicht (anlegen: ./scripts/vereinsheim db-ensure)"
	fi
done

# Volume-Namen werden vom compose-Project-Namen geprefixt (siehe `name:` in compose.yml).
VOLUME_PREFIX="${COMPOSE_PROJECT_NAME:-vereinsheim}"

echo "==> Upload archive (${UPLOAD_APPS[*]})"
for app in "${UPLOAD_APPS[@]}"; do
	archive_uploads "$app" "${VOLUME_PREFIX}_uploads_${app}"
done

echo "==> Pruning (retain ${RETAIN_DAYS}d, floor ${MIN_KEEP} per app)"
for app in "${APPS[@]}"; do
	prune_pattern "${app}-*.dump"
done
for app in "${UPLOAD_APPS[@]}"; do
	prune_pattern "uploads-${app}-*.tar.gz"
done

echo "==> Current backup directory:"
ls -lh "$OUT" | tail -20
