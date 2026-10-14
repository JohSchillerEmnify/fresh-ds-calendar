#!/usr/bin/env bash
# Public instance on the netcup VPS (A-67). Run from the laptop clone (sauron does not build for the VPS):
#   scripts/vps.sh harden   SSH keys only, fail2ban (once; keep another session open the first time)
#   scripts/vps.sh env      write /opt/calendar/.env (asks for the Google client and allowed emails)
#   scripts/vps.sh deploy   build the checked-out commit here, ship it and the Android APK, and (re)start
#   scripts/vps.sh logs     follow the app and Caddy logs
# The VPS (1 CPU, 1 GB) never builds. ufw, Docker, swap and unattended-upgrades are already set up.
set -euo pipefail
HOST=${VPS_HOST:-root@VPS_HOST}
KEY=${VPS_KEY:-$HOME/.ssh/id_ed25519}
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
    printf 'PUBLIC_URL=https://cal.example.org\nGOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\nALLOWED_EMAILS=%s\nTZ=Europe/Berlin\n' \
      "$id" "$secret" "$emails" | on_vps 'mkdir -p /opt/calendar && umask 077 && cat > /opt/calendar/.env'
    echo "written /opt/calendar/.env"
    ;;
  deploy)
    on_vps 'test -f /opt/calendar/.env' || { echo "no /opt/calendar/.env yet: run scripts/vps.sh env" >&2; exit 1; }
    scp "${OPTS[@]}" -q "$here/deploy/vps/compose.yml" "$here/deploy/vps/Caddyfile" "$HOST:/opt/calendar/"
    version="$("$here/scripts/version.sh")+$(git -C "$here" rev-parse --short HEAD)"
    docker build -q -t calendar:latest --build-arg "APP_VERSION=$version" "$here"
    docker save calendar:latest | gzip -1 | on_vps 'gunzip | docker load'
    on_vps 'cd /opt/calendar && docker compose up -d --remove-orphans && docker image prune -f >/dev/null && docker compose ps'
    # the APK is not part of the image: it goes into the data volume (/data/downloads/app.apk, served as /app.apk)
    apk="${CAL_APK:-$here/deploy/data/downloads/app.apk}"
    if [[ -f "$apk" ]]; then
      scp "${OPTS[@]}" -q "$apk" "$HOST:/opt/calendar/app.apk.new"
      on_vps 'set -e; cd /opt/calendar && chmod 644 app.apk.new
        docker compose exec -T app mkdir -p /data/downloads
        docker compose cp app.apk.new app:/data/downloads/app.apk.part
        docker compose exec -T app mv /data/downloads/app.apk.part /data/downloads/app.apk
        rm -f app.apk.new'
      # the sidecar with the APK's versionCode/versionName (written by android-build.sh) makes the app offer the download
      info="${CAL_APK_INFO:-$(dirname "$apk")/app.json}"
      if [[ -f "$info" ]]; then
        scp "${OPTS[@]}" -q "$info" "$HOST:/opt/calendar/app.json.new"
        on_vps 'set -e; cd /opt/calendar && chmod 644 app.json.new
          docker compose cp app.json.new app:/data/downloads/app.json
          rm -f app.json.new'
      fi
      echo "APK: $(sha256sum "$apk" | cut -c1-16)... -> https://cal.example.org/app.apk"
    else
      echo "no APK at $apk: /app.apk on the VPS stays as it is (scripts/android-build.sh builds one)" >&2
    fi
    ;;
  logs)
    on_vps 'cd /opt/calendar && docker compose logs -f --tail=100'
    ;;
  *)
    sed -n '2,7p' "$0" >&2; exit 2
    ;;
esac
