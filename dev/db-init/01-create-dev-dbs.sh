#!/bin/bash
# Dev-only db-init: läuft beim ERSTEN Start des Dev-Postgres (leeres Volume),
# analog zur Prod-Isolation (ADR-002): getrennte User + DBs mit Owner-Rechten.
#
# Dev-DB-Namen: liga (ringwerk) + treffsicher — passend zu den DATABASE_URLs in
# apps/*/.env.example. Passwörter sind bewusst trivial (nur lokal, nie Prod).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
	CREATE USER liga        WITH PASSWORD 'liga';
	CREATE USER treffsicher WITH PASSWORD 'treffsicher';
	CREATE DATABASE liga        OWNER liga;
	CREATE DATABASE treffsicher OWNER treffsicher;
	REVOKE ALL ON DATABASE liga        FROM PUBLIC;
	REVOKE ALL ON DATABASE treffsicher FROM PUBLIC;
EOSQL

echo "vereinsheim dev db-init: created databases liga + treffsicher with separate owners."
