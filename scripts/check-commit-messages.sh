#!/usr/bin/env bash
# Checks every commit message in a range with the commit-msg hook (personal words; the repo is public).
# Usage: scripts/check-commit-messages.sh <from>..<to>   (CI: the pushed range or the PR's commits)
set -euo pipefail
range="${1:?usage: check-commit-messages.sh <from>..<to>}"
hook="$(dirname "$0")/hooks/commit-msg"
msg="$(mktemp)"; trap 'rm -f "$msg"' EXIT
bad=0
for sha in $(git rev-list "$range"); do
  git log -1 --format=%B "$sha" > "$msg"
  if ! out=$("$hook" "$msg" 2>&1); then echo "$(git log -1 --format='%h %s' "$sha"): ${out#commit-msg: }"; bad=1; fi
done
exit "$bad"
