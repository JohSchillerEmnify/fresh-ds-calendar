#!/usr/bin/env bash
# Public instance on a VPS. Run from a clone of the repository:
#   scripts/vps.sh harden   deploy user + key, SSH keys only, no root login, fail2ban (first run: keep another session open)
#   scripts/vps.sh env      write /opt/calendar/.env (asks for the Google client and allowed emails)
#   scripts/vps.sh deploy   build the checked-out commit here, ship it and the Android APK, and (re)start
#   scripts/vps.sh apk      ship only the Android APK (CD deploys the server; the signing key stays on this machine)
#   scripts/vps.sh config   ship compose.yml, Caddyfile and deploy-from-ghcr.sh, recreate what changed, reload Caddy (no image build)
#   scripts/vps.sh logs     follow the app and Caddy logs
#   scripts/vps.sh rollback [version]   run the previous image (or calendar:<version>) again; deploy does this itself when health fails
# The VPS (1 CPU, 1 GB) never builds. ufw, Docker, swap and unattended-upgrades are already set up.
# Connects as VPS_USER (default root: the owner chose to keep root SSH login, 2026-10-16). `harden` is available to switch
# to a non-root `deploy` user and disable root login, but it is opt-in; run it only if you decide to. VPS_HOST is the bare address.
# CAL_DOMAIN (the public host name, e.g. cal.example.org) is required by `env` and `deploy`; it is not written in the repo.
set -euo pipefail
ADDR=${VPS_HOST:?set VPS_HOST to the server address, e.g. VPS_HOST=1.2.3.4 scripts/vps.sh deploy}; ADDR=${ADDR##*@}  # a leftover `user@` in VPS_HOST is ignored: the user is VPS_USER
KEY=${VPS_KEY:-$HOME/.ssh/id_ed25519}
DEPLOY_USER=deploy
# default to root (current server: root login is on); after `harden` you deploy with VPS_USER=deploy
if [[ "${1:-}" == harden ]]; then VPS_USER=${VPS_USER:-root}; else VPS_USER=${VPS_USER:-root}; fi
HOST=$VPS_USER@$ADDR
OPTS=(-i "$KEY" -o IdentitiesOnly=yes)
# DRY_RUN=1 prints the remote commands instead of running them (DRY_RUN=unhealthy: the health check never reports ok)
on_vps() {
  if [[ -n "${DRY_RUN:-}" ]]; then
    printf '[dry-run] on VPS: %s\n' "$*" >&2
    if [[ "$*" == *api/health* && "$DRY_RUN" != unhealthy ]]; then echo '{"status":"ok"}'; fi
    return 0
  fi
  ssh "${OPTS[@]}" "$HOST" "$@"
}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-120}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-3}
here=$(cd "$(dirname "$0")/.." && pwd)

# Starts the app from calendar:latest and waits until /api/health says ok; non-zero when it does not in HEALTH_TIMEOUT s
up_and_wait() {
  local waited=0 out
  on_vps 'cd /opt/calendar && docker compose up -d --remove-orphans' || return 1
  while (( waited < HEALTH_TIMEOUT )); do
    out=$(on_vps "cd /opt/calendar && docker compose exec -T app sh -c 'wget -qO- \"http://127.0.0.1:\${PORT:-3000}/api/health\"' 2>/dev/null") || true
    [[ "$out" == *'"status":"ok"'* ]] && return 0
    sleep "$HEALTH_INTERVAL"; waited=$((waited + HEALTH_INTERVAL))
  done
  return 1
}

# Makes calendar:<tag> the running image again; tags on the VPS are the version with + written as -
rollback_to() {
  on_vps "docker image inspect calendar:$1 >/dev/null 2>&1 && docker tag calendar:$1 calendar:latest" \
    || { echo "no image calendar:$1 on the VPS; available:" >&2; on_vps 'docker images calendar --format "{{.Tag}}  {{.CreatedSince}}"' >&2; return 1; }
  up_and_wait
}

# Uploads the signed APK and its app.json sidecar into the running app container; the server itself is not touched
ship_apk() {
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
    echo "APK: $(sha256sum "$apk" | cut -c1-16)... -> https://$CAL_DOMAIN/app.apk"
  else
    echo "no APK at $apk: /app.apk on the VPS stays as it is (scripts/android-build.sh builds one)" >&2
  fi
}

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
    : "${CAL_DOMAIN:?set CAL_DOMAIN to the public host name, e.g. CAL_DOMAIN=cal.example.org scripts/vps.sh env}"
    read -rp "GOOGLE_CLIENT_ID: " id
    read -rsp "GOOGLE_CLIENT_SECRET: " secret; echo
    read -rp "ALLOWED_EMAILS (comma-separated): " emails
    # a rewrite keeps the existing token key: a new one would make everyone reconnect Google
    keyline=$(on_vps "grep '^TOKEN_ENC_KEY=.' /opt/calendar/.env 2>/dev/null || true")
    printf 'CAL_DOMAIN=%s\nPUBLIC_URL=https://%s\nGOOGLE_CLIENT_ID=%s\nGOOGLE_CLIENT_SECRET=%s\nALLOWED_EMAILS=%s\nTZ=Europe/Berlin\n' \
      "$CAL_DOMAIN" "$CAL_DOMAIN" "$id" "$secret" "$emails" | on_vps 'mkdir -p /opt/calendar && umask 077 && cat > /opt/calendar/.env'
    # the key that encrypts the stored Google tokens is made on the VPS and never leaves it
    if [ -n "$keyline" ]; then printf '%s\n' "$keyline" | on_vps 'cat >> /opt/calendar/.env'
    else on_vps 'echo "TOKEN_ENC_KEY=$(openssl rand -base64 32)" >> /opt/calendar/.env'; fi
    echo "written /opt/calendar/.env"
    ;;
  deploy)
    : "${CAL_DOMAIN:?set CAL_DOMAIN to the public host name, e.g. CAL_DOMAIN=cal.example.org scripts/vps.sh deploy}"
    on_vps 'test -f /opt/calendar/.env' || { echo "no /opt/calendar/.env yet: run scripts/vps.sh env" >&2; exit 1; }
    # a hand-edited .env without a final newline would glue an appended line onto its last one
    on_vps "sed -i -e '\$a\\' /opt/calendar/.env"
    # an .env from before CAL_DOMAIN existed gets the line (Caddy and compose need it)
    on_vps "grep -q '^CAL_DOMAIN=.' /opt/calendar/.env || echo 'CAL_DOMAIN=$CAL_DOMAIN' >> /opt/calendar/.env"
    # an .env from before token encryption gets a key (made on the VPS; losing it only means signing in again)
    on_vps "grep -q '^TOKEN_ENC_KEY=.' /opt/calendar/.env || echo \"TOKEN_ENC_KEY=\$(openssl rand -base64 32)\" >> /opt/calendar/.env"
    if [[ -z "${DRY_RUN:-}" ]]; then scp "${OPTS[@]}" -q "$here/deploy/vps/compose.yml" "$here/deploy/vps/Caddyfile" "$HOST:/opt/calendar/"; fi
    version="$("$here/scripts/version.sh")+$(git -C "$here" rev-parse --short HEAD)"
    tag=${version//+/-}
    if [[ -z "${DRY_RUN:-}" ]]; then docker build -q -t calendar:latest -t "calendar:$tag" --build-arg "APP_VERSION=$version" "$here"; fi
    # what runs now stays on the VPS as calendar:previous, the rollback target
    on_vps 'if docker image inspect calendar:latest >/dev/null 2>&1; then docker tag calendar:latest calendar:previous; fi'
    if [[ -z "${DRY_RUN:-}" ]]; then docker save calendar:latest "calendar:$tag" | gzip -1 | on_vps 'gunzip | docker load'; fi
    if ! up_and_wait; then
      echo "calendar:$tag did not report ok on /api/health within ${HEALTH_TIMEOUT}s: rolling back to calendar:previous" >&2
      if rollback_to previous; then echo "rolled back: the previous version is running again" >&2
      else echo "ROLLBACK FAILED: check scripts/vps.sh logs" >&2; fi
      exit 1
    fi
    # keep the last three versions (plus latest and previous); only dangling layers are pruned
    on_vps 'docker images calendar --format "{{.Tag}}" | grep -vxE "latest|previous" | tail -n +4 | xargs -r -I{} docker rmi calendar:{} || true
      docker image prune -f >/dev/null; cd /opt/calendar && docker compose ps'
    if [[ -n "${DRY_RUN:-}" ]]; then echo "[dry-run] APK step skipped" >&2; exit 0; fi
    ship_apk
    ;;
  apk)
    : "${CAL_DOMAIN:?set CAL_DOMAIN to the public host name}"
    ship_apk
    ;;
  rollback)
    target=${2:-previous}
    [[ "$target" =~ ^[A-Za-z0-9_.+-]+$ ]] || { echo "rollback takes a version such as 0.18.0+94da588 (or nothing for the previous one)" >&2; exit 2; }
    rollback_to "${target//+/-}" || { echo "rollback to $target failed or the app is not healthy" >&2; exit 1; }
    on_vps 'cd /opt/calendar && docker compose ps'
    ;;
  logs)
    on_vps 'cd /opt/calendar && docker compose logs -f --tail=100'
    ;;
  config)
    # the owner-run step for config changes (ADR 0042): files only, the running image is not touched; no secrets are printed
    for f in deploy/vps/compose.yml deploy/vps/Caddyfile deploy/deploy-from-ghcr.sh; do [[ -f "$here/$f" ]] || { echo "no $f in $here" >&2; exit 1; }; done
    if [[ -z "${DRY_RUN:-}" ]]; then
      scp "${OPTS[@]}" -q "$here/deploy/vps/compose.yml" "$here/deploy/vps/Caddyfile" "$HOST:/opt/calendar/"
      scp "${OPTS[@]}" -q "$here/deploy/deploy-from-ghcr.sh" "$HOST:/opt/calendar/deploy-from-ghcr.sh"
    fi
    on_vps 'cd /opt/calendar && chmod 755 deploy-from-ghcr.sh && chown root:root deploy-from-ghcr.sh \
      && docker compose config -q \
      && docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null \
      && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile \
      && docker compose up -d --remove-orphans && docker compose ps'
    echo "config shipped: compose.yml, Caddyfile, deploy-from-ghcr.sh; Caddy reloaded"
    ;;
  *)
    sed -n '2,10p' "$0" >&2; exit 2
    ;;
esac
