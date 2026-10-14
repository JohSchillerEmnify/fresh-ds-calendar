#!/usr/bin/env bash
# Builds the Android app (Capacitor shell + home-screen widget) as a release-signed APK and publishes it, so the server
# hands it out as http://cal.mordor.lan/app.apk (DATA_DIR/downloads/app.apk).
# Usage: scripts/android-build.sh [--no-publish]
# The public instance gets the APK from sauron's DOWNLOADS dir through `scripts/vps.sh deploy`.
# Publishing works from sauron (local copy) and from any other machine (scp/ssh to sauron, SAURON=user@host).
# Runs on sauron: Gradle builds inside the `calendar-android-build` image (android/build.Dockerfile, built on first use),
# capped at 3 CPUs / 4 GB with low CPU shares so Pi-hole keeps priority; the APK is copied straight into the data dir.
# Needs: docker, node 24 + pnpm (see README "Android app").
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/opt/node-v24.21.0-linux-x64/bin:$PATH"
# the compose mounts deploy/data of the repo on sauron as /data (DATA_DIR) in the container
DOWNLOADS="/home/sauron/projects/calendar/deploy/data/downloads"
SAURON="${SAURON:-sauron@192.168.1.38}"
# not under a dot directory: the build container cannot mount those here; mounted as /key, so storeFile=/key/release.jks
KEY_DIR="${CAL_ANDROID_KEY_DIR:-$HOME/calendar-android-key}"
IMAGE="calendar-android-build"

# The release key stays on this machine, out of git: updates of the installed app must be signed with the same key.
if [[ ! -f "$KEY_DIR/keystore.properties" ]]; then
  echo "==> generating the release keystore in $KEY_DIR (keep a backup: a new key means uninstalling the app first)"
  mkdir -p "$KEY_DIR" && chmod 700 "$KEY_DIR"
  PASS="$(openssl rand -hex 16)"
  docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -q -t "$IMAGE" - < "$REPO/android/build.Dockerfile"
  docker run --rm -u "$(id -u):$(id -g)" -v "$KEY_DIR:/key" "$IMAGE" keytool -genkeypair -keystore /key/release.jks -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" \
    -alias calendar -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Calendar, O=mordor.lan"
  (umask 077; printf 'storeFile=/key/release.jks\nstorePassword=%s\nkeyAlias=calendar\nkeyPassword=%s\n' "$PASS" "$PASS" > "$KEY_DIR/keystore.properties")
fi

cd "$REPO"
# every build gets a higher versionCode than the one before (commit count); the sidecar tells the server what it offers
VERSION_CODE="$(git rev-list --count HEAD)"
VERSION_NAME="1.1.$VERSION_CODE"
export VERSION_CODE VERSION_NAME
echo "==> versionCode $VERSION_CODE ($VERSION_NAME)"
echo "==> pnpm install + cap sync"
pnpm install --frozen-lockfile
pnpm exec cap sync android

docker image inspect "$IMAGE" >/dev/null 2>&1 || docker build -q -t "$IMAGE" - < "$REPO/android/build.Dockerfile"
mkdir -p "$HOME/.cache/calendar-gradle"

echo "==> gradle assembleRelease (in $IMAGE)"
docker run --rm --name cal-apk-build --memory=4g --memory-swap=4g --cpus=3 --cpu-shares=256 \
  -u "$(id -u):$(id -g)" -e HOME=/tmp/h -e GRADLE_USER_HOME=/gradle -e CAL_ANDROID_KEYSTORE_PROPS=/key/keystore.properties \
  -e VERSION_CODE -e VERSION_NAME -v "$REPO:$REPO" -v "$KEY_DIR:/key:ro" -v "$HOME/.cache/calendar-gradle:/gradle" -w "$REPO/android" "$IMAGE" \
  bash -c 'mkdir -p /tmp/h && ./gradlew --no-daemon --max-workers=3 -Dorg.gradle.jvmargs=-Xmx2g -PappVersionCode=$VERSION_CODE -PappVersionName=$VERSION_NAME assembleRelease testDebugUnitTest \
    && $ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk | head -2'

APK="$REPO/android/app/build/outputs/apk/release/app-release.apk"
echo "APK: $APK ($(du -h "$APK" | cut -f1))"

INFO="$REPO/android/app/build/outputs/apk/release/app.json"
printf '{"versionCode":%s,"versionName":"%s"}\n' "$VERSION_CODE" "$VERSION_NAME" > "$INFO"
if [[ "${1:-}" == "--no-publish" ]]; then exit 0; fi

echo "==> publishing to $DOWNLOADS/app.apk"
if [[ -d "$DOWNLOADS" ]]; then
  # on sauron
  cp "$APK" "$DOWNLOADS/app.apk.part" && chmod 644 "$DOWNLOADS/app.apk.part" && mv "$DOWNLOADS/app.apk.part" "$DOWNLOADS/app.apk"
  cp "$INFO" "$DOWNLOADS/app.json" && chmod 644 "$DOWNLOADS/app.json"
  curl -s --max-time 5 -o /dev/null -w 'http://cal.mordor.lan/app.apk -> %{http_code} %{content_type}\n' -H 'Host: cal.mordor.lan' http://127.0.0.1/app.apk
else
  # elsewhere: the directory is on sauron, so copy over ssh and move into place there
  scp -q "$APK" "$SAURON:projects/calendar/deploy/data/downloads/app.apk.new"
  scp -q "$INFO" "$SAURON:projects/calendar/deploy/data/downloads/app.json.new"
  ssh "$SAURON" 'cd projects/calendar/deploy/data/downloads && chmod 644 app.apk.new app.json.new && mv app.apk.new app.apk && mv app.json.new app.json && sha256sum app.apk'
fi
