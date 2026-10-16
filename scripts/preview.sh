#!/usr/bin/env bash
# Deploy a branch/worktree as an isolated preview before merging.
#   scripts/preview.sh up   <name> [worktree-dir]   build + run at http://<name>.cal.mordor.local and http://<name>.cal.mordor.lan
#                                                   (.lan for Linux clients, where .local goes to mDNS and does not resolve)
#   scripts/preview.sh down <name>                  stop + remove preview and its data
#   scripts/preview.sh list                         show running previews
# <name> defaults the worktree dir to /home/sauron/projects/calendar-wt/<name>.
# Previews use the mock provider with fresh demo data (under ~/.local/share, not /tmp: after a reboot docker would
# recreate a missing bind-mount source as root), never touch the real data volume.
set -euo pipefail

cmd="${1:-list}"; name="${2:-}"
WT_ROOT="/home/sauron/projects/calendar-wt"
BASE="cal.mordor.local"
BASE_LAN="cal.mordor.lan"
DATA_ROOT="$HOME/.local/share/calendar-preview"

case "$cmd" in
  up)
    [ -n "$name" ] || { echo "usage: preview.sh up <name> [dir]" >&2; exit 2; }
    dir="${3:-$WT_ROOT/$name}"
    [ -f "$dir/Dockerfile" ] || { echo "no Dockerfile in $dir" >&2; exit 1; }
    host="$name.$BASE"
    host_lan="$name.$BASE_LAN"
    cname="calendar-preview-$name"
    echo "==> building image calendar-preview:$name from $dir (low priority, waits for other heavy jobs)"
    exec 8>/tmp/calendar-heavy.lock; flock 8
    renice -n 19 $$ >/dev/null 2>&1 || true
    nice -n 19 docker build -q --build-arg "APP_VERSION=$(VERSION_REPO="$dir" "$(dirname "${BASH_SOURCE[0]}")/version.sh" --preview)+$(git -C "$dir" rev-parse --short HEAD)" -t "calendar-preview:$name" "$dir" >/dev/null
    flock -u 8
    docker rm -f "$cname" >/dev/null 2>&1 || true
    mkdir -p "$DATA_ROOT/$name"
    docker run -d --name "$cname" --restart unless-stopped --network proxy-network \
      --memory 192m \
      -l traefik.enable=true \
      -l "traefik.http.routers.$cname.rule=Host(\`$host\`) || Host(\`$host_lan\`)" \
      -l "traefik.http.services.$cname.loadbalancer.server.port=3000" \
      -e TZ=Europe/Berlin -e PROVIDER=mock -e ALLOW_INSECURE_MOCK=1 -e PORT=3000 -e DATA_DIR=/data \
      -e NODE_OPTIONS=--max-old-space-size=96 \
      -v "$DATA_ROOT/$name:/data" \
      "calendar-preview:$name" >/dev/null
    for _ in $(seq 1 30); do
      if curl -fs -H "Host: $host" http://127.0.0.1/api/health >/dev/null 2>&1; then
        echo "==> preview ready: http://$host  |  http://$host_lan"; exit 0
      fi
      sleep 1
    done
    echo "preview did not become healthy" >&2; docker logs --tail 30 "$cname" >&2; exit 1
    ;;
  down)
    [ -n "$name" ] || { echo "usage: preview.sh down <name>" >&2; exit 2; }
    docker rm -f "calendar-preview-$name" >/dev/null 2>&1 || true
    docker rmi "calendar-preview:$name" >/dev/null 2>&1 || true
    rm -rf "$DATA_ROOT/$name"
    echo "removed preview $name"
    ;;
  list)
    docker ps --filter name=calendar-preview- --format '{{.Names}}\t{{.Status}}' | sed -E "s|calendar-preview-([^\t]*)\t|http://\1.$BASE  http://\1.$BASE_LAN\t|"
    ;;
  *) echo "usage: preview.sh up|down|list" >&2; exit 2 ;;
esac
