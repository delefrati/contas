#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <name> <email>"
  echo ""
  echo "Creates (or re-enables) a super admin: someone who isn't a member of any band"
  echo "but can sign in to all of them. The email must be their Google account."
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
source scripts/lib.sh

echo "==> Creating super admin: $NAME <$EMAIL>"

mysql_exec "INSERT INTO super_admins (name, email) VALUES ('$(sql_quote "$NAME")', '$(sql_quote "$EMAIL")')
      ON DUPLICATE KEY UPDATE name = VALUES(name), active = true;"

echo "==> Done."
