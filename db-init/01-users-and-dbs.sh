#!/bin/bash
# Wird vom Postgres-Image beim ERSTEN Container-Start automatisch ausgeführt
# (Konvention: alle Scripts in /docker-entrypoint-initdb.d/).
# Läuft NICHT mehr, sobald das postgres_data-Volume initialisiert ist.
#
# Legt die App-User mit dedizierten Datenbanken und Owner-Rechten an,
# damit cross-DB-Zugriffe technisch ausgeschlossen sind.
set -euo pipefail

: "${RINGWERK_DB_PASSWORD:?Set RINGWERK_DB_PASSWORD via compose env}"
: "${TREFFSICHER_DB_PASSWORD:?Set TREFFSICHER_DB_PASSWORD via compose env}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
	CREATE USER ringwerk    WITH PASSWORD '${RINGWERK_DB_PASSWORD}';
	CREATE USER treffsicher WITH PASSWORD '${TREFFSICHER_DB_PASSWORD}';
	CREATE DATABASE ringwerk    OWNER ringwerk;
	CREATE DATABASE treffsicher OWNER treffsicher;
	REVOKE ALL ON DATABASE ringwerk    FROM PUBLIC;
	REVOKE ALL ON DATABASE treffsicher FROM PUBLIC;
EOSQL

echo "vereinsheim db-init: created databases ringwerk + treffsicher with separate owners."
