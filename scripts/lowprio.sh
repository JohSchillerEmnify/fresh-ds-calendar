#!/usr/bin/env bash
# Run a heavy command (docker build, e2e, full test run) politely: lowest CPU/IO priority and ONE heavy job at a time
# machine-wide (pihole + immich + others share this box). Usage: scripts/lowprio.sh <command...>
export VITEST_MAX_WORKERS=2 CI_LOWPRIO=1
exec nice -n 19 ionice -c3 flock /tmp/calendar-heavy.lock "$@"
