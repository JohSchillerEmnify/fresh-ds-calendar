#!/usr/bin/env bash
# Public instance on the netcup VPS (A-67). Run from sauron:
#   scripts/vps.sh harden   SSH keys only, fail2ban (once; keep another session open the first time)
#   scripts/vps.sh env      write /opt/calendar/.env (asks for the Google client and allowed emails)
#   scripts/vps.sh deploy   ship calendar:latest (built by sauron on every merge to main) and (re)start
#   scripts/vps.sh logs     follow the app and Caddy logs
# The VPS (1 CPU, 1 GB) never builds. ufw, Docker, swap and unattended-upgrades are already set up.
set -euo pipefail
HOST=${VPS_HOST:-root@VPS_HOST}
KEY=${VPS_KEY:-$HOME/.ssh/id_ed25519_deploy}
OPTS=(-i "$KEY" -o IdentitiesOnly=yes)
on_vps() { ssh "${OPTS[@]}" "$HOST" "$@"; }
here=$(cd "$(dirname "$0")/.." && pwd)

case "${1:-}" in
  harden)
    on_vps 'set -e
      printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n" > /etc/ssh/sshd_config.d/10-hardening.conf
      sshd -t && systemctl reload ssh
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban python3-systemd >/dev/null
      printf "[sshd]\nenabled = true\nbackend = systemd\n" > /etc/fail2ban/jail.local
      systemctl restart fail2ban
      sshd -T | grep -E "^(passwordauthentication|permitrootlogin)"'
    on_vps true && echo "key login still works. Now change the root password: ssh $HOST passwd"
    ;;
  env)
    read -rp "GOOGLE_CLIENT_ID: " id
    read -rsp "GOOGLE_CLIENT_SECRET: " secret; echo
    read -rp "ALLOWED_EMAILS (comma-separated): " emails
    printf 'PUBLIC_URL=https://example.org\nGOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\nALLOWED_EMAILS=%s\nTZ=Europe/Berlin\n' \
      "$id" "$secret" "$emails" | on_vps 'mkdir -p /opt/calendar && umask 077 && cat > /opt/calendar/.env'
    echo "written /opt/calendar/.env"
    ;;
  deploy)
    on_vps 'test -f /opt/calendar/.env' || { echo "no /opt/calendar/.env yet: run scripts/vps.sh env" >&2; exit 1; }
    scp "${OPTS[@]}" -q "$here/deploy/vps/compose.yml" "$here/deploy/vps/Caddyfile" "$HOST:/opt/calendar/"
    docker save calendar:latest | gzip -1 | on_vps 'gunzip | docker load'
    on_vps 'cd /opt/calendar && docker compose up -d --remove-orphans && docker image prune -f >/dev/null && docker compose ps'
    ;;
  logs)
    on_vps 'cd /opt/calendar && docker compose logs -f --tail=100'
    ;;
  *)
    sed -n '2,7p' "$0" >&2; exit 2
    ;;
esac
