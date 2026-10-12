#!/usr/bin/env bash
# The persistent preview: branch `preview` in calendar-wt/preview, served at http://preview.cal.mordor.lan (and .local).
# Feature increments are merged into it as they become ready, so the owner always looks at one consistent place.
#   scripts/preview-branch.sh add <branch>...   merge the branches into `preview` (stops at a conflict), rebuild
#   scripts/preview-branch.sh reset             reset `preview` to master (after master merges), rebuild
#   scripts/preview-branch.sh status            show what `preview` has on top of master
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$(dirname "$REPO")/calendar-wt/preview"
cd "$REPO"
[ -d "$WT" ] || git worktree add -q -B preview "$WT" master
case "${1:-status}" in
  add)
    shift
    for b in "$@"; do
      git -C "$WT" merge -q --no-ff --no-edit -m "Preview: merge $b" "$b" || { echo "conflict merging $b into preview: resolve in $WT, commit, then run add again" >&2; exit 1; }
      echo "merged $b"
    done ;;
  reset) git -C "$WT" checkout -q -B preview master && echo "preview reset to master" ;;
  status) git -C "$WT" log --oneline master..preview; exit 0 ;;
  *) echo "usage: preview-branch.sh add <branch>... | reset | status" >&2; exit 2 ;;
esac
"$REPO/scripts/preview.sh" up preview "$WT"
