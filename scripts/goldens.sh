#!/usr/bin/env bash
# Component goldens (web/goldens/*.golden.ts): Vitest runs on this machine, the browser is a Playwright browser server in
# the pinned Playwright image (same version as e2e/), so every machine renders the same pixels.
# Usage: scripts/goldens.sh run|update [vitest args, e.g. a file filter like TaskListCard]
# Heavy: waits for the machine-wide heavy lock (scripts/lowprio.sh), like the e2e run.
set -euo pipefail
if [ -z "${CI_LOWPRIO:-}" ]; then exec "$(dirname "$0")/lowprio.sh" "$0" "$@"; fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mode=${1:-run}
shift || true
case "$mode" in
  run) args=(run) ;;
  update) args=(run --update) ;;
  *) echo "usage: $0 run|update [vitest args]" >&2; exit 2 ;;
esac

# The image's browsers only work with the playwright release they were built for: web's playwright must equal e2e's.
PW_VERSION="$(node -p "require('./e2e/package.json').devDependencies['@playwright/test']")"
lock="$(cd web && node -p "require('playwright/package.json').version")"
[ "$lock" = "$PW_VERSION" ] || { echo "goldens: web has playwright $lock, e2e pins $PW_VERSION: align web/package.json" >&2; exit 1; }
# Pinned by digest, so a re-pushed tag can never change the pixels; bump both lines with the e2e Playwright version.
IMAGE_VERSION=1.64.1
IMAGE="mcr.microsoft.com/playwright:v${IMAGE_VERSION}-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf"
[ "$IMAGE_VERSION" = "$PW_VERSION" ] || { echo "goldens: e2e pins playwright $PW_VERSION, the goldens image is $IMAGE_VERSION: update IMAGE_VERSION and the digest in $0" >&2; exit 1; }

port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
name="calendar-goldens-$port"
# The whole checkout read-only at the same path: pnpm's node_modules are symlinks into the root store.
docker run -d --rm --init --name "$name" --cpus=1.5 --memory=1536m --memory-swap=1536m --ipc=host \
  -u "$(id -u):$(id -g)" -e HOME=/tmp -p "127.0.0.1:${port}:3000" -v "$ROOT:$ROOT:ro" -w "$ROOT/web" \
  "$IMAGE" node node_modules/playwright/cli.js run-server --port 3000 --host 0.0.0.0 >/dev/null
trap 'docker stop "$name" >/dev/null 2>&1 || true' EXIT
# The server prints its endpoint once it accepts connections (read the whole log: no grep -q closing the pipe early).
ready() { [[ "$(docker logs "$name" 2>&1)" == *'Listening on'* ]]; }
for _ in $(seq 1 60); do
  ready && break
  sleep 0.5
done
ready || { docker logs "$name" >&2; echo "goldens: browser server did not start" >&2; exit 1; }

cd web
GOLDENS_WS="ws://127.0.0.1:${port}/" npx vitest --config vitest.goldens.config.ts "${args[@]}" "$@"
