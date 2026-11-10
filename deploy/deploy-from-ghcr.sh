#!/usr/bin/env bash
# Forced command of the CD key on the VPS (installed as /opt/calendar/deploy-from-ghcr.sh, see docs/DEPLOYMENT.md "Automatic deploy").
# The only input is SSH_ORIGINAL_COMMAND: an image digest (sha256:<64 hex>) or a commit sha (40 hex). The image repository is
# not input: it comes from /opt/calendar/deploy.env (IMAGE_REPO=ghcr.io/<owner>/<repo>), so the key can run nothing but "pull
# that app image and restart". Health check and rollback mirror scripts/vps.sh deploy; the laptop path stays the way to ship
# compose.yml and Caddyfile.
# Second command, `apk apk-<major>.<minor>.<patch>` (ADR 0040): fetch app-release.apk + app.json from that release of the
# repository in deploy.env (IMAGE_REPO without ghcr.io/), check sha256 and the certificate pin APK_CERT_SHA256 from deploy.env,
# then put both into /data/downloads like scripts/vps.sh does.
set -euo pipefail

ref=${SSH_ORIGINAL_COMMAND:-${1:-}}
mode=image
if [[ "$ref" =~ ^sha256:[0-9a-f]{64}$ ]]; then sep=@
elif [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then sep=:
elif [[ "$ref" =~ ^apk\ (apk-[0-9]+\.[0-9]+\.[0-9]+)$ ]]; then mode=apk; apk_tag=${BASH_REMATCH[1]}
else echo "deploy-from-ghcr: expected sha256:<64 hex>, a 40-hex commit sha or 'apk apk-<x.y.z>'" >&2; exit 2; fi

DIR=${DEPLOY_DIR:-/opt/calendar}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-120}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-3}
cd "$DIR"

# the repository is read from a file the key cannot write, never from the command line
IMAGE_REPO=$(sed -n 's/^IMAGE_REPO=//p' deploy.env | head -n 1)
[[ "$IMAGE_REPO" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._/-]+$ ]] || { echo "deploy-from-ghcr: IMAGE_REPO in $DIR/deploy.env is missing or invalid" >&2; exit 2; }

# one deploy at a time: a second run waits instead of racing on the tags
exec 9>"$DIR/.deploy.lock"; flock -w 600 9

# Recreates only the app container from calendar:latest (Caddy keeps running and holds requests meanwhile, ADR 0042) and waits
# until /api/health says ok; non-zero when it does not in HEALTH_TIMEOUT s
up_and_wait() {
  local waited=0 out
  docker compose up -d --no-deps --remove-orphans app || return 1
  while (( waited < HEALTH_TIMEOUT )); do
    out=$(docker compose exec -T app sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health"' 2>/dev/null) || true
    [[ "$out" == *'"status":"ok"'* ]] && return 0
    sleep "$HEALTH_INTERVAL"; waited=$((waited + HEALTH_INTERVAL))
  done
  return 1
}

# Downloads the APK release APK_TAG of the deploy.env repository, verifies it and swaps it into the app's data volume
install_apk() {
  local slug=${IMAGE_REPO#ghcr.io/} pin base work want_sha got_sha cert name_ver
  [[ "$slug" =~ ^[a-z0-9._-]+/[a-z0-9._-]+$ ]] || { echo "deploy-from-ghcr: IMAGE_REPO is not <owner>/<repo>" >&2; return 2; }
  pin=$(sed -n 's/^APK_CERT_SHA256=//p' deploy.env | head -n 1 | tr 'A-F' 'a-f')
  [[ "$pin" =~ ^[0-9a-f]{64}$ ]] || { echo "deploy-from-ghcr: APK_CERT_SHA256 in $DIR/deploy.env is missing or invalid" >&2; return 2; }
  base="https://github.com/$slug/releases/download/$apk_tag"
  work=$(mktemp -d "$DIR/.apk.XXXXXX"); trap 'rm -rf "$work"' RETURN
  for f in app-release.apk app.json; do
    curl -fsSL --proto '=https' --proto-redir '=https' --max-filesize 104857600 --max-time 180 -o "$work/$f" "$base/$f" \
      || { echo "deploy-from-ghcr: download of $base/$f failed" >&2; return 1; }
  done
  # app.json is one flat line written by the apk-sign job; read its fields strictly
  want_sha=$(sed -n 's/.*"sha256":"\([0-9a-f]\{64\}\)".*/\1/p' "$work/app.json")
  cert=$(sed -n 's/.*"certSha256":"\([0-9a-f]\{64\}\)".*/\1/p' "$work/app.json")
  name_ver=$(sed -n 's/.*"versionName":"\([0-9.]*\)".*/\1/p' "$work/app.json")
  got_sha=$(sha256sum "$work/app-release.apk" | cut -d' ' -f1)
  [[ -n "$want_sha" && "$got_sha" == "$want_sha" ]] || { echo "deploy-from-ghcr: APK sha256 does not match app.json" >&2; return 1; }
  [[ "$cert" == "$pin" ]] || { echo "deploy-from-ghcr: app.json certificate is not the pinned release certificate" >&2; return 1; }
  [[ "apk-$name_ver" == "$apk_tag" ]] || { echo "deploy-from-ghcr: app.json versionName does not match $apk_tag" >&2; return 1; }
  chmod 644 "$work/app-release.apk" "$work/app.json"
  # APK first, then the sidecar that makes the app offer it; each is moved into place atomically
  docker compose exec -T app mkdir -p /data/downloads
  docker compose cp "$work/app-release.apk" app:/data/downloads/app.apk.part
  docker compose exec -T app mv /data/downloads/app.apk.part /data/downloads/app.apk
  docker compose cp "$work/app.json" app:/data/downloads/app.json.part
  docker compose exec -T app mv /data/downloads/app.json.part /data/downloads/app.json
  echo "installed $apk_tag (${got_sha:0:16}...)"
}

if [[ "$mode" == apk ]]; then install_apk; exit $?; fi

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
