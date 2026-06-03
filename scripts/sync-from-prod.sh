#!/usr/bin/env bash
set -euo pipefail

# --- Config (override via .env.prod or environment) ---
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Load env if available
if [[ -f "$LOCAL_DIR/.env.prod" ]]; then
  set -a
  source "$LOCAL_DIR/.env.prod"
  set +a
fi

SSH_KEY="${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY in .env.prod}"
SSH_HOST="${DEPLOY_SSH_HOST:?Set DEPLOY_SSH_HOST in .env.prod}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-~/contas-app}"

echo "==> Running tests before deploy..."
bash "$LOCAL_DIR/scripts/run-tests.sh"

echo "==> Building images locally..."
cd "$LOCAL_DIR"
COMPOSE_PROJECT_NAME=contas-app docker compose --env-file .env.prod -f docker-compose.prod.yml build

echo "==> Exporting images..."
docker save contas-app-backend contas-app-frontend | gzip > /tmp/contas-images.tar.gz

echo "==> Uploading images to prod..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  /tmp/contas-images.tar.gz "$SSH_HOST:/tmp/contas-images.tar.gz"

echo "==> Syncing config files..."
rsync -avz \
  -e "ssh -i $SSH_KEY" \
  --include='docker-compose.prod.yml' \
  --include='Caddyfile' \
  --exclude='*' \
  "$LOCAL_DIR/" "$SSH_HOST:$REMOTE_DIR/"

echo "==> Loading images and restarting on prod..."
ssh -i "$SSH_KEY" "$SSH_HOST" \
  "docker load < /tmp/contas-images.tar.gz && \
   rm /tmp/contas-images.tar.gz && \
   cd $REMOTE_DIR && \
   docker compose -f docker-compose.prod.yml up -d"

echo "==> Cleaning up..."
rm -f /tmp/contas-images.tar.gz

echo "==> Done! Prod is up to date."
