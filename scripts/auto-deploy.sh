#!/usr/bin/env bash
# Deploy master to http://cal.mordor.local when it changes. Called by the git hooks in scripts/hooks.
# Runs detached, serialized (flock), skips if this commit is already deployed. Log: /tmp/calendar-autodeploy.log
set -uo pipefail
REPO="/home/sauron/projects/calendar"
LOG="/tmp/calendar-autodeploy.log"
STAMP="/tmp/calendar-deployed-sha"

if [ "${1:-}" != "--run" ]; then
  # entry from a hook: only on master in the main checkout, then detach
  [ "$(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null)" = "master" ] || exit 0
  [ "$(pwd -P)" = "$(cd "$REPO" && pwd -P)" ] || [ -n "${FORCE_AUTODEPLOY:-}" ] || exit 0
  nohup nice -n 19 ionice -c3 "$0" --run >>"$LOG" 2>&1 </dev/null &
  exit 0
fi

exec 9>/tmp/calendar-autodeploy.lock
flock 9   # wait for a running deploy, then deploy whatever HEAD is now
exec 8>/tmp/calendar-heavy.lock; flock 8   # one heavy job at a time machine-wide
sha="$(git -C "$REPO" rev-parse HEAD)"
if [ "$(cat "$STAMP" 2>/dev/null)" = "$sha" ]; then echo "[$(date +%T)] $sha already deployed"; exit 0; fi
echo "[$(date +%T)] auto-deploy $sha ($(git -C "$REPO" log -1 --format=%s))"
if "$REPO/scripts/deploy.sh" ; then
  echo "$sha" > "$STAMP"; echo "[$(date +%T)] deployed $sha"
else
  echo "[$(date +%T)] DEPLOY FAILED for $sha (old version still live)"
fi
