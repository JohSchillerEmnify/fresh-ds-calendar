#!/usr/bin/env bash
# Runs the instrumented widget smoke test on the booted emulator, keeps the device log and fails on a crash in it
# (the test checks the log itself; this is the second net, also for a crash that ends the test run early).
set -uo pipefail
cd "$(dirname "$0")/../android"
log="${1:-build/emulator-logcat.txt}"
mkdir -p "$(dirname "$log")"
adb logcat -c
./gradlew --no-daemon connectedDebugAndroidTest
status=$?
adb logcat -d > "$log"
if grep -E "FATAL EXCEPTION|has died: .*lan\.mordor\.calendar|Process lan\.mordor\.calendar .*has died" "$log" > "$log.crash"; then
  echo "::error::the device log shows a crash of the app"
  head -40 "$log.crash"
  exit 1
fi
exit "$status"
