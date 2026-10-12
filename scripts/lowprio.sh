#!/usr/bin/env bash
# Run a heavy command (docker build, e2e, full test run) politely: lowest CPU/IO priority, ONE heavy job at a time
# machine-wide, and a hard memory cap so it cannot push this 8 GB box (pihole + immich + others) into swap thrash.
# Usage: scripts/lowprio.sh <command...>
# Env: LOWPRIO_MEM (default 2G), LOWPRIO_CPU (default 200%), LOWPRIO_MIN_AVAIL_MIB (default 4096).
# Docker containers run under dockerd, outside this cgroup: cap them with their own --cpus/--memory flags.
set -euo pipefail
export VITEST_MAX_WORKERS=2 CI_LOWPRIO=1
MEM="${LOWPRIO_MEM:-2G}"
MIN_AVAIL="${LOWPRIO_MIN_AVAIL_MIB:-4096}"

# Refuse to pile onto a box that is already struggling (room for this job plus an e2e browser container).
load="$(cut -d' ' -f1 /proc/loadavg)"
max_load=$(( 2 * $(nproc) ))
avail_mib="$(awk '/^MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo)"
if awk -v l="$load" -v m="$max_load" 'BEGIN { exit !(l > m) }' || [ "$avail_mib" -lt "$MIN_AVAIL" ]; then
  echo "lowprio: refusing to start (load $load, max $max_load; ${avail_mib} MiB available, need ${MIN_AVAIL})" >&2
  exit 75
fi

# No swap for the job: past the cap it gets OOM-killed instead of thrashing the whole machine.
props=(-p MemoryMax="$MEM" -p MemorySwapMax=0)
# Cap CPU too where the cpu controller is delegated to the user (a dev desktop; not this server).
if grep -qw cpu "/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers" 2>/dev/null; then
  props+=(-p CPUQuota="${LOWPRIO_CPU:-200%}")
fi
exec systemd-run --user --scope --quiet --collect "${props[@]}" \
  nice -n 19 ionice -c3 flock /tmp/calendar-heavy.lock "$@"
