#!/usr/bin/env bash
# Forced command of the CD key on the VPS (installed as /opt/calendar/deploy-from-ghcr.sh, see docs/DEPLOYMENT.md "Automatic deploy").
# The only input is SSH_ORIGINAL_COMMAND: an image digest (sha256:<64 hex>) or a commit sha (40 hex). The image repository is
# not input: it comes from /opt/calendar/deploy.env (IMAGE_REPO=ghcr.io/<owner>/<repo>), so the key can run nothing but "pull
# that app image and restart". Health check and rollback mirror scripts/vps.sh deploy; the laptop path stays the way to ship
# compose.yml, Caddyfile and the APK.
set -euo pipefail

ref=${SSH_ORIGINAL_COMMAND:-${1:-}}
if [[ "$ref" =~ ^sha256:[0-9a-f]{64}$ ]]; then sep=@
elif [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then sep=:
else echo "deploy-from-ghcr: expected sha256:<64 hex> or a 40-hex commit sha" >&2; exit 2; fi

DIR=${DEPLOY_DIR:-/opt/calendar}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-120}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-3}
cd "$DIR"

# the repository is read from a file the key cannot write, never from the command line
IMAGE_REPO=$(sed -n 's/^IMAGE_REPO=//p' deploy.env | head -n 1)
[[ "$IMAGE_REPO" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._/-]+$ ]] || { echo "deploy-from-ghcr: IMAGE_REPO in $DIR/deploy.env is missing or invalid" >&2; exit 2; }

# one deploy at a time: a second run waits instead of racing on the tags
exec 9>"$DIR/.deploy.lock"; flock -w 600 9

# Starts the app from calendar:latest and waits until /api/health says ok; non-zero when it does not in HEALTH_TIMEOUT s
up_and_wait() {
  local waited=0 out
  docker compose up -d --remove-orphans || return 1
  while (( waited < HEALTH_TIMEOUT )); do
    out=$(docker compose exec -T app sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health"' 2>/dev/null) || true
    [[ "$out" == *'"status":"ok"'* ]] && return 0
    sleep "$HEALTH_INTERVAL"; waited=$((waited + HEALTH_INTERVAL))
  done
  return 1
}

echo "pulling $IMAGE_REPO$sep$ref"
docker pull -q "$IMAGE_REPO$sep$ref" >/dev/null
# tags on the VPS are the version with + written as -, like scripts/vps.sh
version=$(docker image inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$IMAGE_REPO$sep$ref" | sed -n 's/^APP_VERSION=//p')
tag=${version//+/-}
[[ "$tag" =~ ^[A-Za-z0-9_.-]+$ ]] || tag=${ref//[:@]/-}

# what runs now stays as calendar:previous, the rollback target
if docker image inspect calendar:latest >/dev/null 2>&1; then docker tag calendar:latest calendar:previous; fi
docker tag "$IMAGE_REPO$sep$ref" calendar:latest
docker tag "$IMAGE_REPO$sep$ref" "calendar:$tag"

if ! up_and_wait; then
  echo "calendar:$tag did not report ok on /api/health within ${HEALTH_TIMEOUT}s: rolling back to calendar:previous" >&2
  if docker image inspect calendar:previous >/dev/null 2>&1 && docker tag calendar:previous calendar:latest && up_and_wait; then
    echo "rolled back: the previous version is running again" >&2
  else
    echo "ROLLBACK FAILED: check docker compose logs on the VPS" >&2
  fi
  exit 1
fi

# keep the last three versions (plus latest and previous); the pulled GHCR tag is dropped, only dangling layers are pruned
docker rmi "$IMAGE_REPO$sep$ref" >/dev/null 2>&1 || true
docker images calendar --format '{{.Tag}}' | grep -vxE 'latest|previous' | tail -n +4 | xargs -r -I{} docker rmi calendar:{} || true
docker image prune -f >/dev/null
echo "deployed calendar:$tag"
