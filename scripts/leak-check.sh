#!/usr/bin/env bash
# Leak guard: gitleaks (rules in .gitleaks.toml) plus a private denylist of literal values that must never reach git.
#
#   leak-check.sh staged                  pre-commit: the staged diff
#   leak-check.sh push [remote] < refs    pre-push: the commits and tags being pushed (git's pre-push stdin; without it HEAD vs remotes)
#   leak-check.sh all                     CI and manual: HEAD, all local branches and tags (diffs, messages, author/committer, tag objects)
#
# The denylist (domain, server IP, real e-mails ...) is NOT in the repo: one literal per line in
# ~/.config/calendar/leak-denylist, or newline-separated in $LEAK_DENYLIST (CI secret). Matching is ASCII case-insensitive.
# Findings name the commit and "denylist entry #N" (Nth non-empty, non-# line) plus "file #K" or "commit message";
# values and file names are never printed. A missing or empty denylist fails push and all unless LEAK_ALLOW_NO_DENYLIST=1.
# No `set -e`: every step's status is collected and the run fails closed at the end, so one error cannot hide the others.
set -uo pipefail

mode="${1:-}"
remote="${2:-}"
root="$(git rev-parse --show-toplevel)" || exit 2
cd "$root" || exit 2
IMAGE="zricethezav/gitleaks@sha256:e1b35e12a8c6fa8901f060459cfb6b2fc4c484d3afbe3b029733a3bbfab07055" # v8.24.3
CONFIG=".gitleaks.toml"
ZERO="0000000000000000000000000000000000000000"
failed=0
tmp="$(mktemp -d "${TMPDIR:-/tmp}/leak-check.XXXXXX")" || exit 2
trap 'rm -rf "$tmp"' EXIT
findings="$tmp/findings"; : > "$findings"
G=(git -c core.quotepath=off)

# Denylist: env var wins, else the private file. BOM, CR, indentation, blank and # lines are dropped.
load_denylist() {
  local raw=""
  if [ -n "${LEAK_DENYLIST:-}" ]; then raw="$LEAK_DENYLIST"
  elif [ -f "$HOME/.config/calendar/leak-denylist" ]; then raw="$(cat "$HOME/.config/calendar/leak-denylist")"
  fi
  DENY="$(printf '%s\n' "$raw" | sed -e '1s/^\xEF\xBB\xBF//' -e 's/\r$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | grep -v -e '^$' -e '^#' || true)"
}

# gitleaks: local binary if installed, else the pinned docker image (worktree-safe: git dir mounted separately).
# Without --verbose gitleaks prints no author, e-mail or message, and --redact hides the secret.
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

# kind=diff: a patch stream ("COMMIT_MARK <sha>" separates commits; file hunks are numbered, names never printed).
# kind=obj:  one raw commit or tag object (headers up to the first blank line, then the message).
AWK='
BEGIN { n = split(tolower(ENVIRON["DENY"]), e, "\n"); commit = label; k = 0; hdr = 0; inmsg = 0 }
function hit(i, where,   key) { key = commit SUBSEP where SUBSEP i; if (!(key in seen)) { seen[key] = 1; print "denylist entry #" i " in " commit ", " where } }
function scan(line, where,   l, i) { l = tolower(line); for (i = 1; i <= n; i++) if (e[i] != "" && index(l, e[i])) hit(i, where) }
kind == "obj" { if (!inmsg && $0 == "") { inmsg = 1; next } scan($0, inmsg ? "commit message" : "author, committer or headers"); next }
/^COMMIT_MARK / { commit = "commit " substr($2, 1, 12); k = 0; hdr = 0; next }
/^diff (--git|--cc|--combined) / { k++; hdr = 1; scan($0, "file #" k); next }
hdr && /^@@/ { hdr = 0 }
hdr { scan($0, "file #" k); next }
/^-/ { next }
{ scan($0, "file #" (k ? k : 1)) }
'

# Scans the file $2 as kind $1 under label $3; appends findings, fails closed on awk errors.
scan_file() {
  LC_ALL=C DENY="$DENY" awk -v kind="$1" -v label="$3" "$AWK" < "$2" >> "$findings" || { echo "leak-check: denylist scan failed" >&2; failed=1; }
}

# Scans one commit or tag object by id.
scan_object() {
  if "${G[@]}" cat-file "$1" "$2" > "$tmp/obj" 2>/dev/null; then scan_file obj "$tmp/obj" "$3"
  else echo "leak-check: cannot read object" >&2; failed=1; fi
}

# Denylist scan of everything the revs cover: diffs, then every commit object, then tag objects.
scan_history() {
  local sha i=0 ref t
  "${G[@]}" log "$@" -p -U0 --text --cc --no-color --no-ext-diff --format='COMMIT_MARK %H' > "$tmp/diff" \
    || { echo "leak-check: git log failed" >&2; failed=1; return; }
  scan_file diff "$tmp/diff" ""
  while read -r sha; do scan_object commit "$sha" "commit ${sha:0:12}"; done < "$tmp/list"
  for ref in "${tagrefs[@]}"; do
    i=$((i + 1))
    t="$("${G[@]}" cat-file -t "$ref" 2>/dev/null)" || { failed=1; continue; }
    [ "$t" = tag ] && scan_object tag "$ref" "tag #$i"
    printf '%s\n' "${ref#refs/tags/}" > "$tmp/name"; scan_file obj "$tmp/name" "tag #$i name"
  done
}

load_denylist
tagrefs=()
case "$mode" in
  staged)
    run_gitleaks git --pre-commit --staged || failed=1
    if [ -n "$DENY" ]; then
      "${G[@]}" diff --cached -U0 --text --no-color --no-ext-diff > "$tmp/diff" || { echo "leak-check: git diff failed" >&2; failed=1; }
      scan_file diff "$tmp/diff" "staged changes"
    else echo "leak-check: WARNING no denylist found; only gitleaks rules ran" >&2; fi
    ;;
  push | all)
    if [ "$mode" = all ]; then
      # own HEAD, branches and tags only: remote-tracking refs of private mirrors may hold pre-scrub history
      revs=(HEAD --branches --tags)
      while read -r ref; do tagrefs+=("$ref"); done < <(git for-each-ref refs/tags --format='%(refname)')
    else
      positives=(); newbranch=0
      if [ -t 0 ]; then newbranch=1; positives=(HEAD)
      else
        while read -r lref lsha _rref rsha || [ -n "${lref:-}" ]; do
          if [ -z "${lsha:-}" ] || [ "$lsha" = "$ZERO" ]; then continue; fi
          positives+=("$lsha")
          case "$lref" in refs/tags/*) tagrefs+=("$lsha") ;; esac
          if [ "$rsha" = "$ZERO" ] || ! git cat-file -e "${rsha}^{commit}" 2>/dev/null; then newbranch=1; else positives+=("^$rsha"); fi
        done
      fi
      [ "${#positives[@]}" -gt 0 ] || { echo "leak-check: nothing to push"; exit 0; }
      revs=("${positives[@]}")
      [ "$newbranch" = 1 ] && revs+=(--not "--remotes=${remote:-}")
    fi
    git rev-list "${revs[@]}" > "$tmp/list" || { echo "leak-check: git rev-list failed" >&2; exit 1; }
    if [ ! -s "$tmp/list" ]; then
      if [ "$mode" = all ]; then echo "leak-check: no commits to scan (fail closed)" >&2; exit 1; fi
      echo "leak-check: no new commits"; exit 0
    fi
    run_gitleaks git "--log-opts=${revs[*]}" || failed=1
    if [ -n "$DENY" ]; then scan_history "${revs[@]}"
    elif [ "${LEAK_ALLOW_NO_DENYLIST:-}" = 1 ]; then echo "leak-check: WARNING denylist skipped (LEAK_ALLOW_NO_DENYLIST=1); only gitleaks rules ran" >&2
    else echo "leak-check: no denylist (missing or empty). Create ~/.config/calendar/leak-denylist or set LEAK_DENYLIST; LEAK_ALLOW_NO_DENYLIST=1 skips this." >&2; failed=1; fi
    ;;
  *)
    echo "usage: leak-check.sh staged | push [remote] | all" >&2
    exit 2
    ;;
esac

if [ -s "$findings" ]; then
  echo "leak-check: DENYLIST HIT (values and file names are never printed):" >&2
  head -"${LEAK_MAX_LINES:-50}" "$findings" >&2
  failed=1
fi
if [ "$failed" -ne 0 ]; then
  echo "leak-check: FAILED. Remove the value from the change (use placeholders like cal.example.org / example.test)." >&2
  echo "If it was already pushed, follow docs/SECURITY-RUNBOOK.md: rotate first, then rewrite." >&2
  exit 1
fi
echo "leak-check ($mode): OK"
