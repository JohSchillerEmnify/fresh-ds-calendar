#!/usr/bin/env bash
# Rebuild the persistent preview (http://preview.cal.mordor.lan) in the background whenever `preview` changes.
# Called by the git hooks (merge into `preview`) and by preview-branch.sh reset. Log: $RUN_DIR/autopreview.log (scripts/rundir.sh)
set -uo pipefail
REPO="/home/sauron/projects/calendar"
WT="/home/sauron/projects/calendar-wt/preview"
. "$REPO/scripts/rundir.sh"
LOG="$RUN_DIR/autopreview.log"
if [ "${1:-}" != "--run" ]; then
  nohup nice -n 19 ionice -c3 "$0" --run >>"$LOG" 2>&1 </dev/null &
  exit 0
fi
exec 9>"$RUN_DIR/autopreview.lock"
flock 9   # one rebuild at a time; a later merge waits and then builds the newest HEAD
echo "[$(date +%T)] preview build $(git -C "$WT" log --oneline -1)"
"$REPO/scripts/preview.sh" up preview "$WT" && echo "[$(date +%T)] preview ready" || echo "[$(date +%T)] PREVIEW BUILD FAILED"
