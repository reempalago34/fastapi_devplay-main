#!/usr/bin/env bash
# Postgres propio para desarrollo (sin sudo, no toca el Postgres del sistema).
# Datos en ~/.local/share/devplay-pgdata · puerto 55432 · auth trust en local.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA_DIR="${DATA_DIR:-$HOME/.local/share/devplay-pgdata}"
LOG_FILE="${LOG_FILE:-$HOME/.local/share/devplay-pg.log}"
SOCKET_DIR="${SOCKET_DIR:-/tmp/opencode}"
PORT="${PORT:-55432}"

case "${1:-}" in
  start)
    mkdir -p "$SOCKET_DIR"
    if [ ! -d "$DATA_DIR" ]; then
      "$PGBIN/initdb" -D "$DATA_DIR" -U "$(whoami)" --auth=trust --encoding=UTF8 --locale=C.UTF-8
    fi
    "$PGBIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k $SOCKET_DIR -h 127.0.0.1" -l "$LOG_FILE" start
    sleep 1
    psql -h 127.0.0.1 -p "$PORT" -U "$(whoami)" -d postgres -tc \
      "SELECT 1 FROM pg_database WHERE datname='devplay_api'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$PORT" -U "$(whoami)" -d postgres -c "CREATE DATABASE devplay_api"
    psql -h 127.0.0.1 -p "$PORT" -U "$(whoami)" -d postgres -tc \
      "SELECT 1 FROM pg_database WHERE datname='devplay_api_test'" | grep -q 1 \
      || psql -h 127.0.0.1 -p "$PORT" -U "$(whoami)" -d postgres -c "CREATE DATABASE devplay_api_test"
    echo "Listo: postgresql+psycopg://$(whoami)@127.0.0.1:$PORT/devplay_api"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DATA_DIR" stop
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$DATA_DIR" status
    ;;
  *)
    echo "Uso: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
