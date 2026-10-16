# Sourced by the sauron hooks and scripts: sets RUN_DIR, a 0700 per-user directory for logs, locks and stamps.
# Replaces predictable world-writable /tmp paths (symlink and pre-creation attacks by other local users).
_d="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
[ -d "$_d" ] && [ -w "$_d" ] || _d="$HOME/.cache"
RUN_DIR="$_d/calendar"
mkdir -p "$RUN_DIR" && chmod 700 "$RUN_DIR"
unset _d
