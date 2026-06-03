#!/usr/bin/env bash
set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Ensure nvm is loaded
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

echo "==> Running backend tests..."
cd "$LOCAL_DIR/backend-nest"
npm test -- --forceExit

echo ""
echo "==> Running frontend tests..."
cd "$LOCAL_DIR/frontend"
npx vitest run

echo ""
echo "✅ All tests passed!"
