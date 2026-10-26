#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <band-slug> <name> <email>"
  echo ""
  echo "Creates an admin member in a band."
  echo "Run this after first deployment to set up the initial user."
  echo ""
  echo "Examples:"
  echo "  $0 maverick 'Alice' 'alice@example.com'"
  echo "  COMPOSE_FILE=docker-compose.prod.yml $0 maverick 'Alice' 'alice@example.com'"
  exit 1
}

if [[ $# -lt 3 ]]; then
  usage
fi

SLUG="$1"
NAME="$2"
EMAIL="$3"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

cd "$(dirname "$0")/.."
source scripts/lib.sh

BAND_ID="$(mysql_exec "SELECT id FROM bands WHERE slug = '$(sql_quote "$SLUG")';")"
if [[ -z "$BAND_ID" ]]; then
  echo "Band '$SLUG' not found. Create it first with scripts/create-band.sh." >&2
  exit 1
fi

echo "==> Creating admin member in band '$SLUG': $NAME <$EMAIL>"

mysql_exec "INSERT INTO members (band_id, name, email, active) VALUES ($BAND_ID, '$(sql_quote "$NAME")', '$(sql_quote "$EMAIL")', true) ON DUPLICATE KEY UPDATE name = VALUES(name);"

echo "==> Done."
