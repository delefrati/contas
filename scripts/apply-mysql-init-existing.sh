#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INIT_DIR="$ROOT_DIR/mysql/init"

if [[ ! -d "$INIT_DIR" ]]; then
  echo "init directory not found: $INIT_DIR" >&2
  exit 1
fi

echo "Applying SQL init files to existing database volume..."

docker compose exec -T db mysql -uroot -proot contas <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL

while IFS= read -r -d '' sql_file; do
  filename="$(basename "$sql_file")"
  already_applied="$(docker compose exec -T db mysql -N -s -uroot -proot contas -e "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';" </dev/null)"

  if [[ "$already_applied" == "1" ]]; then
    echo "- skipping $filename (already applied)"
    continue
  fi

  echo "- applying $filename"
  docker compose exec -T db mysql -uroot -proot contas < "$sql_file"
  docker compose exec -T db mysql -uroot -proot contas -e "INSERT INTO schema_migrations (filename) VALUES ('$filename');" </dev/null
done < <(find "$INIT_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

echo "Done."
