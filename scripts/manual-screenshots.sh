#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--keep] [<screenshot>...]"
  echo "       $0 --down"
  echo ""
  echo "Starts a separate local stack (its own database, never your dev one), fills it with the"
  echo "made-up band \"Os Exemplos\" (scripts/manual/seed.mjs) and retakes the user manual's"
  echo "screenshots in frontend/public/manual/ (scripts/manual/screenshots.mjs)."
  echo ""
  echo "  <screenshot>  only these, e.g. agenda evento (default: all of them)"
  echo "  --keep        leave the stack running, to look around or take prints by hand"
  echo "  --down        stop a stack left running with --keep"
  echo ""
  echo "Uses the same ports as the dev stack (51731, 8001, 33061): stop that one first."
  exit 1
}

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
export COMPOSE_PROJECT_NAME=minhabanda-manual
export COMPOSE_FILE=docker-compose.yml
# Requests to localhost go to this band (seed.mjs renames the one the migrations create)
export DEFAULT_BAND=os-exemplos

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

KEEP=0
SHOTS=()
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    --down)
      docker compose down -v
      exit 0
      ;;
    -h|--help) usage ;;
    -*) usage ;;
    *) SHOTS+=("$arg") ;;
  esac
done

running=$(docker compose ps -q backend 2>/dev/null || true)
if [[ -z "$running" ]] && curl -sf http://localhost:8001/api/health >/dev/null 2>&1; then
  echo "Something is already answering on localhost:8001 (the dev stack?). Stop it first." >&2
  exit 1
fi

echo "==> Starting a fresh stack ($COMPOSE_PROJECT_NAME)..."
docker compose down -v >/dev/null 2>&1 || true
docker compose up -d --build db backend frontend
until curl -sf http://localhost:8001/api/health >/dev/null; do sleep 3; done
until curl -sf http://localhost:51731 >/dev/null; do sleep 2; done

echo "==> Installing the screenshot tools..."
(cd scripts/manual && npm install --no-audit --no-fund --silent)
(cd scripts/manual && npx playwright install chromium >/dev/null)

echo "==> Building \"Os Exemplos\"..."
node scripts/manual/seed.mjs

echo "==> Taking screenshots..."
node scripts/manual/screenshots.mjs "${SHOTS[@]}"

if [[ "$KEEP" == "1" ]]; then
  member=$(node -e "const s=require('$ROOT/scripts/manual/.session.json');console.log(JSON.stringify({auth_token:s.member.token,auth_member:JSON.stringify(s.member.user),admin_token:s.admin.token,admin_user:JSON.stringify(s.admin.user)}))")
  echo ""
  echo "The stack is still running: http://localhost:51731"
  echo "To sign in as Ana Souza (and Paula Admin in /admin), paste this in the browser console there,"
  echo "then reload:"
  echo ""
  echo "  Object.entries($member).forEach(([k, v]) => localStorage.setItem(k, v))"
  echo ""
  echo "Stop it with: $0 --down"
else
  docker compose down -v >/dev/null
fi

echo ""
echo "==> Done. Check the images with: git status frontend/public/manual"
