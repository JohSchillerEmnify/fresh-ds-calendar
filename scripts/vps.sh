#!/usr/bin/env bash
# Public instance on the netcup VPS (A-67). Run from the laptop clone (sauron does not build for the VPS):
#   scripts/vps.sh harden   deploy user + key, SSH keys only, no root login, fail2ban (first run: keep another session open)
#   scripts/vps.sh env      write /opt/calendar/.env (asks for the Google client and allowed emails)
#   scripts/vps.sh deploy   build the checked-out commit here, ship it and the Android APK, and (re)start
#   scripts/vps.sh logs     follow the app and Caddy logs
# The VPS (1 CPU, 1 GB) never builds. ufw, Docker, swap and unattended-upgrades are already set up.
# Everything but `harden` connects as VPS_USER (default `deploy`, in the docker group); `harden` itself defaults to root,
# the only user that exists before it ran (VPS_USER=root scripts/vps.sh harden). VPS_HOST is the bare address.
set -euo pipefail
ADDR=${VPS_HOST:-VPS_HOST}; ADDR=${ADDR##*@}  # a leftover `user@` in VPS_HOST is ignored: the user is VPS_USER
KEY=${VPS_KEY:-$HOME/.ssh/id_ed25519}
DEPLOY_USER=deploy
if [[ "${1:-}" == harden ]]; then VPS_USER=${VPS_USER:-root}; else VPS_USER=${VPS_USER:-$DEPLOY_USER}; fi
HOST=$VPS_USER@$ADDR
OPTS=(-i "$KEY" -o IdentitiesOnly=yes)
on_vps() { ssh "${OPTS[@]}" "$HOST" "$@"; }
here=$(cd "$(dirname "$0")/.." && pwd)

case "${1:-}" in
  harden)
    # Idempotent. Order matters: the deploy user's key login must work before root login is switched off.
    [[ "$VPS_USER" == root ]] || { echo "harden creates the $DEPLOY_USER user, so it connects as root (VPS_USER=$VPS_USER given)" >&2; exit 2; }
    if ! on_vps true 2>/dev/null; then
      # root is already locked out: fine if the deploy user gets in
      if ssh "${OPTS[@]}" -o BatchMode=yes "$DEPLOY_USER@$ADDR" docker ps >/dev/null 2>&1; then
        echo "already hardened: root cannot log in and $DEPLOY_USER@$ADDR can run docker"; exit 0
      fi
      echo "cannot log in as root@$ADDR, nor as $DEPLOY_USER with $KEY" >&2; exit 1
    fi
    pub="$(cat "$KEY.pub")"
    # 1+2: deploy user (docker group), the laptop's key, /opt/calendar owned by it, SSH keys only, fail2ban; root key login still allowed
    on_vps "PUB=$(printf %q "$pub") DEPLOY_USER=$DEPLOY_USER bash -s" <<'REMOTE'
set -e
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
home=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$home/.ssh"
touch "$home/.ssh/authorized_keys"
grep -qxF "$PUB" "$home/.ssh/authorized_keys" || echo "$PUB" >> "$home/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$home/.ssh/authorized_keys"; chmod 600 "$home/.ssh/authorized_keys"
mkdir -p /opt/calendar && chown -R "$DEPLOY_USER:$DEPLOY_USER" /opt/calendar
printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n" > /etc/ssh/sshd_config.d/10-hardening.conf
sshd -t && systemctl reload ssh
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban python3-systemd >/dev/null
printf "[sshd]\nenabled = true\nbackend = systemd\n" > /etc/fail2ban/jail.local
systemctl restart fail2ban
REMOTE
    # 3: the deploy user must get in with the key and use docker, or root login stays as it is
    if ! ssh "${OPTS[@]}" -o BatchMode=yes "$DEPLOY_USER@$ADDR" docker ps >/dev/null; then
      echo "ssh $DEPLOY_USER@$ADDR docker ps failed: NOT disabling root login. Fix the deploy user first." >&2; exit 1
    fi
    echo "$DEPLOY_USER@$ADDR can run docker"
    # 4: only now switch root login off
    on_vps 'set -e
      printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n" > /etc/ssh/sshd_config.d/10-hardening.conf
      sshd -t && systemctl reload ssh
      sshd -T | grep -E "^(passwordauthentication|permitrootlogin)"'
    echo "hardened: root login is off. Deploy as $DEPLOY_USER (no sudo; the provider console is the way back in as root)"
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
      # the server above is already up; an APK that is not signed by the pinned release cert is never uploaded
      source "$here/scripts/apk-cert.sh"
      verify_apk_cert "$apk" || { echo "APK NOT uploaded (the server itself is deployed)" >&2; exit 1; }
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
