#!/usr/bin/env bash
# Leak guard: gitleaks (rules in .gitleaks.toml) plus a private denylist of literal values that must never reach git.
#
#   leak-check.sh staged                  pre-commit: the staged diff
#   leak-check.sh push [remote] < refs    pre-push: the commits being pushed (git's pre-push stdin; without it HEAD vs remotes)
#   leak-check.sh all                     CI and manual: full history, all refs, commit messages, author/committer, tags
#
# The denylist (domain, server IP, real e-mails ...) is NOT in the repo: one literal per line in
# ~/.config/calendar/leak-denylist, or newline-separated in $LEAK_DENYLIST (CI secret). Matching is case-insensitive.
# Findings name the file/commit and "denylist entry #N" (Nth non-empty, non-# line); the value itself is never printed.
set -uo pipefail

mode="${1:-}"
remote="${2:-}"
root="$(git rev-parse --show-toplevel)"
cd "$root" || exit 2
IMAGE="zricethezav/gitleaks:v8.24.3"
CONFIG=".gitleaks.toml"
ZERO="0000000000000000000000000000000000000000"
failed=0

# Denylist: env var wins, else the private file. Comments and blank lines are dropped.
load_denylist() {
  local raw=""
  if [ -n "${LEAK_DENYLIST:-}" ]; then raw="$LEAK_DENYLIST"
  elif [ -f "$HOME/.config/calendar/leak-denylist" ]; then raw="$(cat "$HOME/.config/calendar/leak-denylist")"
  fi
  DENY="$(printf '%s\n' "$raw" | tr -d '\r' | grep -v -e '^[[:space:]]*$' -e '^#' || true)"
}

# gitleaks: local binary if installed, else the pinned docker image (worktree-safe: git dir mounted separately).
run_gitleaks() {
  local common gitdir rel
  if command -v gitleaks >/dev/null 2>&1; then
    gitleaks "$@" --config "$CONFIG" --redact --no-banner .
    return
  fi
  command -v docker >/dev/null 2>&1 || { echo "leak-check: need gitleaks or docker" >&2; return 2; }
  common="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
  gitdir="$(git rev-parse --absolute-git-dir)"
  rel="${gitdir#"$common"}"
  docker run --rm -v "$root:/repo:ro" -v "$common:/gitcommon:ro" \
    -e "GIT_DIR=/gitcommon$rel" -e GIT_WORK_TREE=/repo \
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0='*' \
    "$IMAGE" "$@" --config /repo/$CONFIG --redact --no-banner /repo
}

# Scans a stream of git output for denylist literals; prints findings without ever printing the literal.
scan_stream() {
  LC_ALL=C DENY="$DENY" awk '
    BEGIN { n = split(tolower(ENVIRON["DENY"]), e, "\n"); zone = "diff"; commit = "staged"; file = "" }
    function hit(i, where) { k = commit SUBSEP where SUBSEP i; if (!(k in seen)) { seen[k] = 1; print "denylist entry #" i " in " (commit == "staged" ? "staged changes" : "commit " substr(commit, 1, 12)) ": " where } }
    function scan(line, where,   l, i) { l = tolower(line); for (i = 1; i <= n; i++) if (e[i] != "" && index(l, e[i])) hit(i, where) }
    /^@@COMMIT / { commit = $2; zone = "msg"; file = ""; next }
    zone == "msg" && /^diff (--git|--cc|--combined) / { zone = "diff" }
    zone == "msg" { scan($0, "commit message, author, committer or tag"); next }
    /^diff (--git|--cc|--combined) / || /^\+\+\+ / || /^rename (from|to) / { scan($0, "file name (hidden)"); if ($0 ~ /^\+\+\+ b\//) file = substr($0, 7); next }
    /^-/ { next }
    { scan($0, "file " (file == "" ? "(unknown)" : file)) }
  '
}

# Reads a stream on stdin; reports denylist findings and returns 1 when there are any.
denylist_report() {
  local label="$1" out
  out="$(scan_stream | head -"${LEAK_MAX_LINES:-50}")"
  if [ -n "$out" ]; then
    echo "leak-check: DENYLIST HIT in $label (values are never printed):" >&2
    echo "$out" >&2
    return 1
  fi
}

history_stream() {
  git log "$@" -p -U0 --text --cc --no-color --no-ext-diff \
    --format='@@COMMIT %H%n%an%n%ae%n%cn%n%ce%n%B'
}

load_denylist
case "$mode" in
  staged)
    run_gitleaks git --pre-commit --staged || failed=1
    if [ -n "$DENY" ]; then
      git diff --cached -U0 --text --no-color --no-ext-diff | denylist_report "the staged diff" || failed=1
    else echo "leak-check: WARNING no denylist found; only gitleaks rules ran" >&2; fi
    ;;
  push | all)
    if [ "$mode" = all ]; then
      revs=(--all)
    else
      positives=() ; newbranch=0
      if [ -t 0 ]; then newbranch=1; positives=(HEAD)
      else
        while read -r _lref lsha _rref rsha; do
          [ -z "${lsha:-}" ] || [ "$lsha" = "$ZERO" ] && continue
          positives+=("$lsha")
          if [ "$rsha" = "$ZERO" ] || ! git cat-file -e "${rsha}^{commit}" 2>/dev/null; then newbranch=1; else positives+=("^$rsha"); fi
        done
      fi
      [ "${#positives[@]}" -gt 0 ] || { echo "leak-check: nothing to push"; exit 0; }
      revs=("${positives[@]}")
      [ "$newbranch" = 1 ] && revs+=(--not "--remotes=${remote:-}")
      if [ -z "$(git rev-list "${revs[@]}" | head -1)" ]; then echo "leak-check: no new commits"; exit 0; fi
    fi
    run_gitleaks git "--log-opts=${revs[*]}" || failed=1
    if [ -n "$DENY" ]; then
      { history_stream "${revs[@]}"
        [ "$mode" = all ] && git for-each-ref refs/tags --format='@@COMMIT tag:%(refname:short)%0a%(taggername)%0a%(taggeremail)%0a%(contents)'
        true
      } | denylist_report "the history" || failed=1
    elif [ "$mode" = all ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
      echo "::warning::LEAK_DENYLIST is empty (fork or missing secret); only gitleaks rules ran"
    else echo "leak-check: WARNING no denylist found; only gitleaks rules ran" >&2; fi
    ;;
  *)
    echo "usage: leak-check.sh staged | push [remote] | all" >&2
    exit 2
    ;;
esac

if [ "$failed" -ne 0 ]; then
  echo "leak-check: FAILED. Remove the value from the change (use placeholders like cal.example.org / example.test)." >&2
  echo "If it was already pushed, follow docs/SECURITY-RUNBOOK.md: rotate first, then rewrite." >&2
  exit 1
fi
echo "leak-check ($mode): OK"
