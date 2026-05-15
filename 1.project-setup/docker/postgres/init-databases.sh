#!/usr/bin/env bash
# Runs automatically on the FIRST startup of the postgres container
# (i.e. when the data directory is empty). Subsequent runs are skipped.
#
# Mounted at /docker-entrypoint-initdb.d/ via docker-compose.yml.
# Idempotent in spirit: uses `\gexec` so re-running by hand is also safe.

set -euo pipefail

DBS=("employee_db_development" "employee_db_production")

for db in "${DBS[@]}"; do
  echo "▶ Ensuring database '${db}' exists"
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE "${db}"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
EOSQL
done

echo "✔ All databases ready: ${DBS[*]}"
