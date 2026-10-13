#!/usr/bin/env bash
# One-line status of the last auto-deploy on sauron plus the age of the running `calendar` container.
# Usage: scripts/deploy-status.sh        (override the host with DEPLOY_HOST=user@host)
set -uo pipefail
HOST="${DEPLOY_HOST:-sauron@192.168.1.38}"
LOG="${DEPLOY_LOG:-/tmp/calendar-autodeploy.log}"

# The summarising awk runs on the remote side so only a few bytes cross the wire.
read -r -d '' REMOTE <<'SH'
log="$1"
tail -n 6000 "$log" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | awk '
  /^\[[0-9:]+\] auto-deploy / { sha=substr($3,1,7); started=substr($1,2,5); fails=""; delete cnt; order=0; state="RUNNING"; when=started; next }
  /^\[[0-9:]+\] [0-9a-f]+ already deployed/ { sha=substr($2,1,7); when=substr($1,2,5); state="OK"; next }
  /^\[[0-9:]+\] deployed / { sha=substr($3,1,7); when=substr($1,2,5); state="OK"; next }
  /^\[[0-9:]+\] DEPLOY FAILED/ { when=substr($1,2,5); state="FAILED"; next }
  / FAIL +[^ ]+\.(test|spec)\.[a-z]+/ { for (i=1;i<=NF;i++) if ($i ~ /\.(test|spec)\.[a-z]+$/) { f=$i; break }
      if (!(f in cnt)) order_f[++order]=f; cnt[f]++; next }
  /error TS[0-9]+/ { if (tserr=="") tserr=$0; next }
  END {
    out="deploy: " state " " sha " at " when
    if (state=="FAILED") {
      d=""
      for (i=1;i<=order;i++) d=d (i>1?", ":"") order_f[i] " (" cnt[order_f[i]] " failed)"
      if (d=="" && tserr!="") d=substr(tserr,1,100)
      if (d=="") d="see " "'"'"'$log'"'"'"
      out=out " — " d
    }
    print out
  }'
docker ps --filter name='^calendar$' --format 'container: {{.Names}} {{.Status}}' 2>/dev/null | grep . || echo "container: calendar not running"
SH
timeout 30 ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" bash -s -- "$LOG" <<<"$REMOTE" || { echo "deploy-status: ssh to $HOST failed" >&2; exit 1; }
