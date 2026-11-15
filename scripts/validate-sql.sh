#!/bin/sh
# Apply the BlockBuddy migrations to a throwaway Postgres and run the RLS smoke test.
# Uses Docker when it exists, otherwise a local Postgres cluster.
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

run_sql() {
  if command -v docker >/dev/null 2>&1; then
    docker exec -i bb-pg-validate psql -U postgres -d blockbuddy -v ON_ERROR_STOP=1 "$@"
  else
    sudo -u postgres psql -d blockbuddy -v ON_ERROR_STOP=1 "$@"
  fi
}

if command -v docker >/dev/null 2>&1; then
  docker rm -f bb-pg-validate >/dev/null 2>&1 || true
  docker run -d --name bb-pg-validate -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=blockbuddy postgres:16-alpine >/dev/null
  i=0
  while [ "$i" -lt 40 ]; do
    if docker exec bb-pg-validate pg_isready -U postgres -d blockbuddy >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 1
  done
else
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS blockbuddy;" >/dev/null
  sudo -u postgres psql -c "CREATE DATABASE blockbuddy;" >/dev/null
fi

run_sql < "$root/supabase/tests/stub.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115140000_schema.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115140100_storage.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115140000_schema.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115140100_storage.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115150000_more_communities.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115160000_communities_anon_select.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115150000_more_communities.sql" >/dev/null
run_sql < "$root/supabase/migrations/20261115160000_communities_anon_select.sql" >/dev/null
run_sql < "$root/supabase/tests/rls_smoke.sql"

if command -v docker >/dev/null 2>&1; then
  docker rm -f bb-pg-validate >/dev/null
fi
