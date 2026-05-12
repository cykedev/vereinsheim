#!/usr/bin/env bash
# Erstellt:
#   - pg_dump (custom format) beider Datenbanken
#   - tar.gz beider Upload-Volumes
# Behält die letzten BACKUP_RETAIN_DAYS Tage (Default 14), aber
# immer mindestens BACKUP_MIN_KEEP Dumps/Archive pro App (Default 7),
# auch wenn diese älter als RETAIN_DAYS sind. So bleibt nach einer
# Reihe fehlgeschlagener oder kaputter Backups immer ein Fallback.
#
# Aufruf vom Repo-Root oder via Cron-Eintrag mit absolutem Pfad:
#   0 3 * * * /home/deploy/vereinsheim/scripts/backup.sh \
#       >> /home/deploy/vereinsheim/logs/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

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

	docker compose exec -T db pg_dump -U postgres -Fc "$app" > "$tmp"

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

	docker run --rm \
		-v "${volume}":/src:ro \
		-v "$OUT":/out \
		alpine tar czf "/out/$(basename "$tmp")" -C /src .

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
dump_db ringwerk
dump_db treffsicher

# Volume-Namen werden vom compose-Project-Namen geprefixt (siehe `name:` in compose.yml).
VOLUME_PREFIX="vereinsheim"

echo "==> Upload archive (treffsicher only — ringwerk has no uploads)"
archive_uploads treffsicher "${VOLUME_PREFIX}_uploads_treffsicher"

echo "==> Pruning (retain ${RETAIN_DAYS}d, floor ${MIN_KEEP} per app)"
prune_pattern 'ringwerk-*.dump'
prune_pattern 'treffsicher-*.dump'
prune_pattern 'uploads-treffsicher-*.tar.gz'

echo "==> Current backup directory:"
ls -lh "$OUT" | tail -20
