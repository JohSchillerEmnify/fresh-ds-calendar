#!/usr/bin/env bash
# The persistent preview: branch `preview` in calendar-wt/preview, served at http://preview.cal.mordor.lan (and .local).
# Feature increments are merged into it as they become ready, so the owner always looks at one consistent place.
#   scripts/preview-branch.sh add <branch>...   merge the branches into `preview` (stops at a conflict); the git hook
#                                               rebuilds the preview in the background (scripts/auto-preview.sh)
#   scripts/preview-branch.sh reset             reset `preview` to main (after main merges), rebuild
#   scripts/preview-branch.sh status            show what `preview` has on top of main
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$(dirname "$REPO")/calendar-wt/preview"
. "$REPO/scripts/rundir.sh"
cd "$REPO"
[ -d "$WT" ] || git worktree add -q -B preview "$WT" main
case "${1:-status}" in
  add)
    shift
    for b in "$@"; do
      git -C "$WT" merge -q --no-ff --no-edit -m "Preview: merge $b" "$b" || { echo "conflict merging $b into preview: resolve in $WT, commit, then run add again" >&2; exit 1; }
      echo "merged $b"
    done ;;
  reset) git -C "$WT" checkout -q -B preview main && echo "preview reset to main" && "$REPO/scripts/auto-preview.sh" ;;
  status) git -C "$WT" log --oneline main..preview; exit 0 ;;
  *) echo "usage: preview-branch.sh add <branch>... | reset | status" >&2; exit 2 ;;
esac
echo "preview rebuild runs in the background (hook); log: $RUN_DIR/autopreview.log"
