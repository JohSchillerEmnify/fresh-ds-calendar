#!/usr/bin/env bash
# One-command redeploy: test, build image, restart container, wait for health via Traefik.
# Usage: scripts/deploy.sh [--skip-tests]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO/deploy/docker-compose.yaml"   # .env and data/ next to it, git-ignored
HOST="cal.mordor.local"
NODE_BIN="$HOME/.local/opt/node-v24.21.0-linux-x64/bin"
export PATH="$NODE_BIN:$PATH"

cd "$REPO"

if [[ "${1:-}" != "--skip-tests" ]]; then
  echo "==> pnpm install + tests"
  pnpm install --frozen-lockfile
  pnpm test
fi

# Data dir must be writable by the container's non-root `node` user (uid 1000).
mkdir -p "$(dirname "$COMPOSE_FILE")/data"
# Heap snapshots land here (owner-only, outside the repo); the compose file mounts it as /diag.
export CAL_DIAG_DIR="${CAL_DIAG_DIR:-$HOME/.local/share/calendar-diag}"
install -d -m 700 "$CAL_DIAG_DIR"

# Semantic version from the commits since the last tag (scripts/version.sh); main deploys are tagged locally (no remote).
VERSION="$("$REPO/scripts/version.sh")"
if [[ "$(git -C "$REPO" branch --show-current)" == "main" ]] && ! git -C "$REPO" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then
  git -C "$REPO" tag "v$VERSION"
fi
APP_VERSION="$VERSION+$(git -C "$REPO" rev-parse --short HEAD)"
echo "==> docker compose build (APP_VERSION=$APP_VERSION) + up -d"
docker compose -p calendar -f "$COMPOSE_FILE" build --build-arg "APP_VERSION=$APP_VERSION"
docker compose -p calendar -f "$COMPOSE_FILE" up -d --force-recreate  # compose v2.3 sometimes keeps the old container

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
docker compose -p calendar -f "$COMPOSE_FILE" logs --tail 50 >&2
exit 1
