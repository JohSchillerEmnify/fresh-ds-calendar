#!/usr/bin/env bash
# Sourced by scripts/android-build.sh and scripts/vps.sh: verify_apk_cert APK refuses (returns 1) any APK that is not
# signed by the release certificate pinned in android/release-cert.sha256, and while that file is still a placeholder.
# apksigner comes from PATH, ANDROID_HOME/build-tools, or the calendar-android-build image (override: APKSIGNER=...).

# Prints the pinned fingerprint (64 lowercase hex digits); returns 1 while the pin file is a placeholder or malformed.
pinned_cert() {
  local pin
  pin="$(grep -v '^#' "${CAL_CERT_PIN_FILE:-$(dirname "${BASH_SOURCE[0]}")/../android/release-cert.sha256}" | sed -E 's/^ *(SHA-?256)?:? *//I' | tr -d ': \n' | tr 'A-F' 'a-f')"
  [[ "$pin" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf '%s\n' "$pin"
}

# Prints the SHA-256 fingerprint of the APK's one signing certificate (lowercase hex); returns 1 when it has none, several, or a bad signature.
apk_cert() {
  local apk="$1" out
  if [[ -n "${APKSIGNER:-}" ]]; then out="$("$APKSIGNER" verify --print-certs "$apk")"
  elif command -v apksigner >/dev/null; then out="$(apksigner verify --print-certs "$apk")"
  elif [[ -x "$(ls -d "${ANDROID_HOME:-/nonexistent}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)" ]]; then
    out="$("$(ls -d "$ANDROID_HOME"/build-tools/*/apksigner | sort -V | tail -1)" verify --print-certs "$apk")"
  else
    out="$(docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$(realpath "$apk"):/app.apk:ro" "${CAL_ANDROID_IMAGE:-calendar-android-build}" \
      bash -c '"$ANDROID_HOME"/build-tools/36.0.0/apksigner verify --print-certs /app.apk')"
  fi
  out="$(sed -n 's/^Signer #[0-9]* certificate SHA-256 digest: //p' <<<"$out" | tr 'A-F' 'a-f')"
  [[ "$(wc -l <<<"$out")" -eq 1 && "$out" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf '%s\n' "$out"
}

# Returns 0 only for an APK signed by the pinned release certificate.
verify_apk_cert() {
  local apk="$1" pin got
  got="$(apk_cert "$apk")" || { echo "cannot read a single signing certificate from $apk (unsigned or bad signature?)" >&2; return 1; }
  pin="$(pinned_cert)" || {
    echo "android/release-cert.sha256 is still a placeholder: not shipping. $apk is signed with $got." >&2
    echo "Pin the release cert once: keytool -list -v -keystore ~/calendar-android-key/release.jks -alias calendar | grep SHA256" >&2
    return 1
  }
  [[ "$got" == "$pin" ]] || { echo "$apk is signed with $got, not the pinned release cert $pin: not shipping" >&2; return 1; }
  echo "signer OK: $got"
}
