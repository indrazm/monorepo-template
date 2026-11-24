#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: dev-infra [up|down|status]

Runs PostgreSQL and Redis for local development.

  up      start PostgreSQL on 15432 and Redis on 16379 (default)
  down    stop both
  status  report whether each is running

Data and logs live in .dev/ at the repository root. Override the ports with
PGPORT and REDISPORT.
USAGE
}

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
state="$root/.dev"
pgdata="$state/postgres"
pglog="$state/postgres.log"
pgport="${PGPORT:-15432}"
redisdata="$state/redis"
redislog="$state/redis.log"
redispid="$state/redis.pid"
redisport="${REDISPORT:-16379}"
database="monorepo_template"

postgres_running() {
  pg_ctl --pgdata="$pgdata" status >/dev/null 2>&1
}

redis_running() {
  redis-cli -p "$redisport" ping >/dev/null 2>&1
}

postgres_up() {
  mkdir -p "$state"

  if [ ! -f "$pgdata/PG_VERSION" ]; then
    initdb --pgdata="$pgdata" --username=postgres --auth=trust --encoding=UTF8 >/dev/null
  fi

  if postgres_running; then
    echo "PostgreSQL already running on 127.0.0.1:$pgport."
  else
    pg_ctl --pgdata="$pgdata" --log="$pglog" --options="-p $pgport -k $state" start >/dev/null
    echo "PostgreSQL running on 127.0.0.1:$pgport."
  fi

  if ! psql \
    --host=127.0.0.1 \
    --port="$pgport" \
    --username=postgres \
    --dbname=postgres \
    --tuples-only \
    --no-align \
    --command="SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -qx 1; then
    createdb --host=127.0.0.1 --port="$pgport" --username=postgres "$database"
    echo "Created database $database."
  fi
}

redis_up() {
  mkdir -p "$redisdata"

  if redis_running; then
    echo "Redis already running on 127.0.0.1:$redisport."
  else
    redis-server \
      --port "$redisport" \
      --dir "$redisdata" \
      --daemonize yes \
      --pidfile "$redispid" \
      --logfile "$redislog"
    echo "Redis running on 127.0.0.1:$redisport."
  fi
}

postgres_down() {
  if postgres_running; then
    pg_ctl --pgdata="$pgdata" --mode=fast stop >/dev/null
    echo "PostgreSQL stopped."
  else
    echo "PostgreSQL was not running."
  fi
}

redis_down() {
  if redis_running; then
    redis-cli -p "$redisport" shutdown nosave >/dev/null 2>&1 || true
    echo "Redis stopped."
  else
    echo "Redis was not running."
  fi
}

status() {
  if postgres_running; then
    echo "PostgreSQL: running on 127.0.0.1:$pgport (data in $pgdata)"
  else
    echo "PostgreSQL: stopped (data in $pgdata)"
  fi

  if redis_running; then
    echo "Redis: running on 127.0.0.1:$redisport (data in $redisdata)"
  else
    echo "Redis: stopped (data in $redisdata)"
  fi
}

case "${1:-up}" in
  up)
    postgres_up
    redis_up
    ;;
  down)
    postgres_down
    redis_down
    ;;
  status)
    status
    ;;
  help | -h | --help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
