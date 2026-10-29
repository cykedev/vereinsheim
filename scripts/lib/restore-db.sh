# shellcheck shell=bash
# restore_db <compose-funktion> <app> <dump>: spielt einen Dump (pg_dump -Fc) in die Datenbank einer App, für
# restore.sh, dev-restore und local-up --restore.
#
# Erst in eine frische Datenbank <app>_restore (Owner <app>, PUBLIC ohne Rechte wie db-init), mit --exit-on-error;
# erst wenn das gelingt, ersetzt sie <app>. So steht danach genau der Stand des Dumps da, auch wenn die laufende
# Datenbank ein neueres Schema hat: `pg_restore --clean` löscht nur, was im Dump steht, und Tabellen des neueren
# Schemas mit Fremdschlüssel auf Tabellen des Dumps lassen dessen DROP scheitern. Ein kaputter Dump lässt die laufende
# Datenbank unberührt. DROP … WITH (FORCE) trennt offene Verbindungen (etwa `pnpm dev`).
#
# Die Compose-Funktion bestimmt den Stack (compose, dev_compose, local_compose); sie braucht einen Dienst db.
# Läuft im CLI links von `||`, dort gilt `set -e` nicht: Jeder Schritt prüft seinen Exit-Code selbst.
restore_db() {
	local compose="$1" app="$2" dump="$3"
	local scratch="${app}_restore"
	# ohne NOTICE-Zeilen (DROP … IF EXISTS); jedes -c läuft für sich, DROP DATABASE braucht das
	local psql=("$compose" exec -T -e PGOPTIONS='-c client_min_messages=warning' db
		psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

	if ! "${psql[@]}" -c "DROP DATABASE IF EXISTS $scratch" -c "CREATE DATABASE $scratch OWNER $app" \
		-c "REVOKE ALL ON DATABASE $scratch FROM PUBLIC"; then
		echo "ERROR: Wegwerf-Datenbank $scratch ließ sich nicht anlegen (fehlt die Rolle $app?)." >&2
		return 1
	fi

	if ! "$compose" exec -T db pg_restore -U postgres -d "$scratch" --no-owner --role="$app" --exit-on-error <"$dump"; then
		"${psql[@]}" -c "DROP DATABASE IF EXISTS $scratch" || true
		echo "ERROR: pg_restore ist gescheitert, die Datenbank $app ist unverändert." >&2
		return 1
	fi

	if ! "${psql[@]}" -c "DROP DATABASE IF EXISTS $app WITH (FORCE)" -c "ALTER DATABASE $scratch RENAME TO $app"; then
		echo "ERROR: Tausch gescheitert; der Dump liegt eingespielt in der Datenbank $scratch." >&2
		return 1
	fi
}
