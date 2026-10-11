#!/usr/bin/env bash
# One-command redeploy: test, build image, restart container, wait for health via Traefik.
# Usage: scripts/deploy.sh [--skip-tests]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="/home/sauron/docker-compose/calendar/docker-compose.yaml"
HOST="cal.mordor.local"
NODE_BIN="$HOME/.local/opt/node-v22.11.0-linux-x64/bin"
export PATH="$NODE_BIN:$PATH"

cd "$REPO"

if [[ "${1:-}" != "--skip-tests" ]]; then
  echo "==> npm ci + tests"
  [[ -d node_modules ]] || npm ci --no-audit --no-fund
  npm test
fi

# Data dir must be writable by the container's non-root `node` user (uid 1000).
mkdir -p "$(dirname "$COMPOSE_FILE")/data"

echo "==> docker compose up -d --build"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> waiting for http://$HOST/api/health"
for i in $(seq 1 60); do
  if body=$(curl -fsS --max-time 3 "http://$HOST/api/health" 2>/dev/null) \
     || body=$(curl -fsS --max-time 3 -H "Host: $HOST" "http://127.0.0.1/api/health" 2>/dev/null); then
    echo "healthy: $body"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done
echo "!! health check failed after 120s" >&2
docker compose -f "$COMPOSE_FILE" logs --tail 50 >&2
exit 1
