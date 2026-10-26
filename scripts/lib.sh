# Shared helpers for the database scripts. Source it after setting COMPOSE_FILE.

# Run SQL in the database container; prints query results without headers.
mysql_exec() {
  docker compose -f "$COMPOSE_FILE" exec -T db mysql -N -s \
    -uroot -p"${MYSQL_ROOT_PASSWORD:-root}" "${MYSQL_DATABASE:-contas}" -e "$1"
}

# Escape a value for use inside a single-quoted SQL string.
sql_quote() {
  printf '%s' "${1//\'/\'\'}"
}
