#!/usr/bin/env bash
# Builds the Android app (Capacitor shell + home-screen widget) as a release-signed APK and publishes it to sauron, where
# the server hands it out as http://cal.mordor.lan/app.apk (DATA_DIR/downloads/app.apk).
# Usage: scripts/android-build.sh [--no-publish]
# Needs: JDK 17, the Android SDK in $ANDROID_HOME (default ~/Android/Sdk), node 24 + pnpm (see README "Android app").
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/opt/node-v24.21.0-linux-x64/bin:$PATH"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
SAURON="sauron@192.168.1.38"
# sauron's compose mounts ./data of /home/sauron/docker-compose/calendar as /data (DATA_DIR) in the container
REMOTE_DIR="/home/sauron/docker-compose/calendar/data/downloads"
KEY_DIR="${CAL_ANDROID_KEY_DIR:-$HOME/.config/calendar-android}"
export CAL_ANDROID_KEYSTORE_PROPS="$KEY_DIR/keystore.properties"

# The release key stays on this machine, out of git: updates of the installed app must be signed with the same key.
if [[ ! -f "$CAL_ANDROID_KEYSTORE_PROPS" ]]; then
  echo "==> generating the release keystore in $KEY_DIR (keep a backup: a new key means uninstalling the app first)"
  mkdir -p "$KEY_DIR" && chmod 700 "$KEY_DIR"
  PASS="$(openssl rand -hex 16)"
  keytool -genkeypair -keystore "$KEY_DIR/release.jks" -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" \
    -alias calendar -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=Calendar, O=mordor.lan"
  (umask 077; printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=calendar\nkeyPassword=%s\n' "$KEY_DIR/release.jks" "$PASS" "$PASS" > "$CAL_ANDROID_KEYSTORE_PROPS")
fi

cd "$REPO"
echo "==> pnpm install + cap sync"
pnpm install --frozen-lockfile
pnpm exec cap sync android

echo "==> gradle assembleRelease"
(cd android && ./gradlew assembleRelease)

APK="$REPO/android/app/build/outputs/apk/release/app-release.apk"
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)apksigner"
"$APKSIGNER" verify --print-certs "$APK" | head -2
echo "APK: $APK ($(du -h "$APK" | cut -f1))"

if [[ "${1:-}" == "--no-publish" ]]; then exit 0; fi

echo "==> publishing to $SAURON:$REMOTE_DIR/app.apk"
chmod 644 "$APK"
ssh "$SAURON" "mkdir -p '$REMOTE_DIR'"
scp -q "$APK" "$SAURON:$REMOTE_DIR/app.apk.part"
ssh "$SAURON" "mv '$REMOTE_DIR/app.apk.part' '$REMOTE_DIR/app.apk'"
type="$(curl -fsSI --max-time 5 http://cal.mordor.lan/app.apk | tr -d '\r' | grep -i '^content-type:' || true)"
echo "http://cal.mordor.lan/app.apk -> ${type:-no answer} (application/vnd.android.package-archive once the server route is deployed)"
