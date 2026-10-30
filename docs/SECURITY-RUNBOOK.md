# Security runbook

What to do when something that holds secrets leaks. Host: `cal.example.org`, data in `/opt/calendar` (`.env`) and the
Docker volume mounted as `DATA_DIR` (`/data`). Background: ADR 0026.

## `.env` leaked (or the laptop that has a copy)

- [ ] Rotate `GOOGLE_CLIENT_SECRET` in the Google Cloud Console. This alone makes every stored refresh token unusable.
- [ ] Rotate `TOKEN_ENC_KEY`: replace the line with `openssl rand -base64 32`, redeploy. Old token files no longer
      decrypt, so everyone signs in again.
- [ ] Rotate `DOOR_API_TOKEN` (at least 32 characters) and update the door board.
- [ ] Rotate the VAPID keys (delete `vapid.json` or set new `VAPID_*`); people re-enable notifications.
- [ ] Wipe sessions (below).
- [ ] Check `ls -l /opt/calendar/.env`: mode `600`, owned by root.

## `DATA_DIR`, a volume copy or a backup leaked

- [ ] Rotate `GOOGLE_CLIENT_SECRET` (refresh tokens are encrypted, but the key may have leaked too).
- [ ] Rotate `TOKEN_ENC_KEY` if `.env` was in the same copy.
- [ ] Wipe sessions. Stored session ids are hashes, so they cannot be replayed, but wiping is cheap.
- [ ] Each person revokes the app at <https://myaccount.google.com/permissions>.
- [ ] Rotate VAPID keys: `push.json` holds browser push endpoints and keys.
- [ ] Delete old provider snapshots and backup copies that are no longer needed.

## A secret or private value reached the repo (leak guard hit after a push)

- [ ] Rotate first: treat the value as public the moment it was pushed (see the lists above for what to rotate). Forks and
      caches keep copies, so a rewrite alone is not enough.
- [ ] Then remove it from history (`git filter-repo --replace-text`), force-push by hand, and ask GitHub support to purge
      cached views if the repository is public.
- [ ] Re-run `scripts/leak-check.sh all` (full history) until it passes; add the value to the private denylist.

## Wipe sessions

```sh
cd /opt/calendar && docker compose exec app sh -c 'echo {} > /data/sessions.json' && docker compose restart app
```

Everyone signs in again. (A person can also use "sign out everywhere" in the app.)

## Routine checks

- [ ] `.env` is mode 600; `scripts/vps.sh harden` has been run (key-only SSH, fail2ban).
- [ ] Provider snapshots are deleted when not needed.
- [ ] Someone leaves: remove them from `ALLOWED_EMAILS`, redeploy, delete `users/<sub>/`.
