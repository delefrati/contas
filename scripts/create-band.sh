#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <slug> <band-name> [<admin-name> <admin-email>]"
  echo ""
  echo "Creates a band served at https://<slug>.<BASE_DOMAIN> and, optionally, its first admin member."
  echo "Without one, only super admins can sign in until they add the members."
  echo "The slug may contain lowercase letters, digits and hyphens."
  echo ""
  echo "Examples:"
  echo "  $0 maverick 'Maverick' 'Alice' 'alice@example.com'"
  echo "  $0 maverick 'Maverick'"
  echo "  COMPOSE_FILE=docker-compose.prod.yml $0 maverick 'Maverick' 'Alice' 'alice@example.com'"
  exit 1
}

if [[ $# -ne 2 && $# -ne 4 ]]; then
  usage
fi

SLUG="$1"
BAND_NAME="$2"
ADMIN_NAME="${3:-}"
ADMIN_EMAIL="${4:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [[ ! "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "Invalid slug '$SLUG': use lowercase letters, digits and hyphens (not at the start or end)." >&2
  exit 1
fi

case "$SLUG" in
  www|api|app|admin|mail|static)
    echo "Slug '$SLUG' is reserved." >&2
    exit 1
    ;;
esac

cd "$(dirname "$0")/.."
source scripts/lib.sh

echo "==> Creating band '$SLUG': $BAND_NAME"

mysql_exec "INSERT INTO bands (slug, name) VALUES ('$SLUG', '$(sql_quote "$BAND_NAME")');
      INSERT INTO event_types (band_id, name, color)
        SELECT id, 'Show', '#667eea' FROM bands WHERE slug = '$SLUG'
        UNION ALL SELECT id, 'Ensaio', '#48bb78' FROM bands WHERE slug = '$SLUG';"

if [[ -n "$ADMIN_EMAIL" ]]; then
  COMPOSE_FILE="$COMPOSE_FILE" scripts/create-admin.sh "$SLUG" "$ADMIN_NAME" "$ADMIN_EMAIL"
fi

echo ""
echo "Next steps:"
echo "  - Open https://$SLUG.${BASE_DOMAIN:-minhabanda.com} (the HTTPS certificate is issued on the first visit)."
