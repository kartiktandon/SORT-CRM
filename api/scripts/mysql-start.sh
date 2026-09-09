#!/bin/sh
set -eu
CRM_API_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CRM_MYSQLD=${CRM_MYSQLD:-/opt/homebrew/opt/mysql/bin/mysqld}
exec "$CRM_MYSQLD" --no-defaults \
  --datadir="$CRM_API_DIR/.mysql/data" \
  --socket="$CRM_API_DIR/.mysql/mysql.sock" \
  --pid-file="$CRM_API_DIR/.mysql/mysql.pid" \
  --log-error="$CRM_API_DIR/.mysql/server.log" \
  --port=3307 --bind-address=127.0.0.1 --mysqlx=OFF --daemonize
