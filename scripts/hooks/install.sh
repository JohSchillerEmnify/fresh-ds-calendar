#!/usr/bin/env bash
# Installs the laptop hooks (pre-commit, pre-push, commit-msg) into this clone's .git/hooks. The post-* hooks are for the home
# server and are deliberately not touched. Each installed file is a stub that runs the hook of the current worktree.
set -euo pipefail
dir="$(git rev-parse --git-path hooks)"
mkdir -p "$dir"
for h in pre-commit pre-push commit-msg; do
  target="$dir/$h"
  if [ -e "$target" ] && ! grep -q 'calendar leak guard stub' "$target"; then
    echo "hooks: $target already exists and is not ours; merge it by hand" >&2
    exit 1
  fi
  printf '%s\n' '#!/usr/bin/env bash' '# calendar leak guard stub: runs the hook of the current worktree' \
    'hook="$(git rev-parse --show-toplevel)/scripts/hooks/'"$h"'"' '[ -x "$hook" ] || exit 0' 'exec "$hook" "$@"' > "$target"
  chmod +x "$target"
  echo "hooks: installed $target"
done
