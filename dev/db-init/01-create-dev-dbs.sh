#!/bin/bash
# Dev-only db-init: läuft beim ERSTEN Start des Dev-Postgres (leeres Volume),
# analog zur Prod-Isolation (ADR-002): getrennte User + DBs mit Owner-Rechten.
#
# Dev-DB-Namen: ringwerk + treffsicher — identisch zu den Prod-Namen (compose.yml)
# und zu den DATABASE_URLs in apps/*/.env.example. Passwörter sind bewusst trivial
# (nur lokal, nie Prod).
set -euo pipefail

# CREATEDB ist dev-only und nötig für `prisma migrate dev`: die Schema-Engine legt für jede
# neue Migration eine temporäre Shadow-DB an. Prod migriert via `migrate deploy` und braucht
# das nicht — das Prod-db-init (db-init/01-users-and-dbs.sh) vergibt das Recht bewusst NICHT.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
	CREATE USER ringwerk    WITH PASSWORD 'ringwerk'    CREATEDB;
	CREATE USER treffsicher WITH PASSWORD 'treffsicher' CREATEDB;
	CREATE DATABASE ringwerk    OWNER ringwerk;
	CREATE DATABASE treffsicher OWNER treffsicher;
	REVOKE ALL ON DATABASE ringwerk    FROM PUBLIC;
	REVOKE ALL ON DATABASE treffsicher FROM PUBLIC;
EOSQL

echo "vereinsheim dev db-init: created databases ringwerk + treffsicher with separate owners."
