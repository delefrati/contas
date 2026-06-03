#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <name> <email>"
  echo ""
  echo "Creates an admin member in the database."
  echo "Run this after first deployment to set up the initial user."
  echo ""
  echo "Examples:"
  echo "  $0 'Alice' 'alice@example.com'"
  echo "  COMPOSE_FILE=docker-compose.prod.yml $0 'Alice' 'alice@example.com'"
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

NAME="$1"
EMAIL="$2"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

cd "$(dirname "$0")/.."

echo "==> Creating admin member: $NAME <$EMAIL>"

docker compose -f "$COMPOSE_FILE" exec -T db mysql \
  -u"${MYSQL_USER:-root}" -p"${MYSQL_ROOT_PASSWORD:-root}" "${MYSQL_DATABASE:-contas}" \
  -e "INSERT INTO members (name, email, active) VALUES ('${NAME//\'/\'\'}', '${EMAIL//\'/\'\'}', true) ON DUPLICATE KEY UPDATE name = VALUES(name);"

echo "==> Done."
