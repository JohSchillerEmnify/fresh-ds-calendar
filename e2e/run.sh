#!/usr/bin/env bash
# Run the Gherkin e2e suite (spec/features) in the Playwright docker image.
#
#   e2e/run.sh [playwright args...]          build app, start a TEST_MODE server on a free port, run everything
#   e2e/run.sh --smoke [playwright args...]  @smoke scenarios against the deployment (default http://cal.mordor.local)
#   E2E_BASE_URL=http://localhost:3000 e2e/run.sh [args]   use an already running TEST_MODE server (no build/start)
#
# Env: E2E_BASE_URL, E2E_SPEC_DIR (spec folder relative to e2e/), E2E_SKIP_BUILD=1, E2E_SKIP_INSTALL=1,
#      E2E_SOFT_TEST_API=1 (diagnostics only: setup test-endpoint failures warn instead of fail),
#      E2E_HOST_IP (address cal.mordor.local resolves to in smoke mode, default 192.168.1.38).
# The HTML report lands in e2e/playwright-report, JSON results in e2e/test-results/results.json,
# the server log in e2e/server.log.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$E2E_DIR/.." && pwd)"

# Node for host-side tooling: newest of the user-local installs, else whatever is on PATH.
for n in "$HOME"/.local/opt/node-v24*/bin "$HOME"/.local/opt/node-v22*/bin; do
  [ -x "$n/node" ] && { export PATH="$n:$PATH"; break; }
done
PW_VERSION="$(node -p "require('$E2E_DIR/package.json').devDependencies['@playwright/test']")"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"

SMOKE=0
if [ "${1:-}" = "--smoke" ]; then SMOKE=1; shift; fi

log() { printf '\033[1;34m[e2e]\033[0m %s\n' "$*"; }

install_deps() {
  [ "${E2E_SKIP_INSTALL:-0}" = 1 ] && return
  if [ -f "$ROOT/pnpm-workspace.yaml" ] && grep -q 'e2e' "$ROOT/pnpm-workspace.yaml"; then
    [ -d "$E2E_DIR/node_modules/@playwright/test" ] || (cd "$ROOT" && pnpm install --frozen-lockfile)
  else
    [ -d "$E2E_DIR/node_modules/@playwright/test" ] || (cd "$E2E_DIR" && npm ci --no-audit --no-fund)
  fi
}

build_app() {
  [ "${E2E_SKIP_BUILD:-0}" = 1 ] && return
  log "building app"
  if [ -f "$ROOT/pnpm-workspace.yaml" ]; then
    (cd "$ROOT" && { [ -d node_modules ] || pnpm install --frozen-lockfile; } && pnpm run build)
  else
    (cd "$ROOT" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build)
  fi
}

free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }

SERVER_PID=""
DATA_DIR=""
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "stopping server (pid $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  [ -n "$DATA_DIR" ] && rm -rf "$DATA_DIR"
}
trap cleanup EXIT INT TERM

start_server() {
  local port; port="$(free_port)"
  DATA_DIR="$(mktemp -d -t calendar-e2e-XXXXXX)"
  log "starting TEST_MODE server on 127.0.0.1:$port (DATA_DIR=$DATA_DIR)"
  # Bound to loopback only: the test endpoints must never be reachable from the LAN.
  (cd "$ROOT" && HOST=127.0.0.1 PORT="$port" TEST_MODE=true PROVIDER=mock SEED=false DATA_DIR="$DATA_DIR" \
    POLL_INTERVAL_MS=30000 TZ=Europe/Berlin NODE_ENV=production \
    exec node --expose-gc server/dist/index.js >"$E2E_DIR/server.log" 2>&1) &
  SERVER_PID=$!
  export E2E_BASE_URL="http://localhost:$port"
  for _ in $(seq 1 60); do
    if curl -fsS "$E2E_BASE_URL/api/health" >/dev/null 2>&1; then log "server up: $E2E_BASE_URL"; return; fi
    kill -0 "$SERVER_PID" 2>/dev/null || { cat "$E2E_DIR/server.log"; echo "server exited" >&2; exit 1; }
    sleep 0.5
  done
  echo "server did not become healthy" >&2; exit 1
}

install_deps
DOCKER_ARGS=(--rm --init --ipc=host --network host -u "$(id -u):$(id -g)" -e HOME=/tmp
  -v "$ROOT:/work" -w /work/e2e)
PW_ARGS=("$@")

if [ "$SMOKE" = 1 ]; then
  export E2E_BASE_URL="${E2E_BASE_URL:-http://cal.mordor.local}"
  DOCKER_ARGS+=(--add-host "cal.mordor.local:${E2E_HOST_IP:-192.168.1.38}")
  PW_ARGS=(--grep @smoke "${PW_ARGS[@]}")
elif [ -z "${E2E_BASE_URL:-}" ]; then
  build_app
  start_server
fi

log "running $IMAGE against $E2E_BASE_URL ${PW_ARGS[*]}"
set +e
docker run "${DOCKER_ARGS[@]}" \
  -e E2E_BASE_URL -e E2E_SPEC_DIR -e E2E_SOFT_TEST_API -e CI \
  "$IMAGE" \
  bash -c 'export PATH="/work/e2e/node_modules/.bin:$PATH"; bddgen && playwright test "$@"' bash "${PW_ARGS[@]}"
status=$?
set -e
log "report: $E2E_DIR/playwright-report/index.html (exit $status)"
exit $status
