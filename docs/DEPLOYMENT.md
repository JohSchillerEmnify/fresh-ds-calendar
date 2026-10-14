# Deployment guide

How the calendar app is built, previewed, deployed and installed. The host is **sauron** (`ssh sauron@192.168.1.38`).
The specs (`spec/ARCHITECTURE.md` §8 Configuration, §9 Owner actions) hold the details; this page is the runbook.

## Overview

| What | Where | How it updates |
|---|---|---|
| Production | `http://cal.mordor.lan` (alias `cal.mordor.local`) | automatically after every merge into `main` on sauron |
| Preview | `http://preview.cal.mordor.lan` | automatically after every merge into the `preview` branch on sauron |
| Android app | `http://cal.mordor.lan/app.apk` and `https://cal.example.org/app.apk` (also Settings → Account & data → Android app) | `scripts/android-build.sh` on sauron (Gradle in Docker); `scripts/vps.sh deploy` puts the APK on the VPS |
| Source mirror | `github.com/JohSchillerEmnify/fresh-ds-calendar` (private), branch `main` | push from a clone (see below) |

Everything is LAN-only: the `*.mordor.lan` names resolve through Pi-hole to `192.168.1.38`; Traefik routes them to the
containers.

## Repository layout on sauron

- Main checkout: `~/projects/calendar` (branch **`main`**). Git hooks live in `scripts/hooks`
  (`core.hooksPath=scripts/hooks`).
- Worktrees: `~/projects/calendar-wt/<branch>`; the preview worktree is `~/projects/calendar-wt/preview`.
- Compose: `deploy/docker-compose.yaml` in the repo (`~/projects/calendar/deploy/`; `~/docker-compose/calendar` is a symlink to it); data volume `deploy/data` (git-ignored) → `/data` in the
  container (`DATA_DIR`).

## Production deploy

1. Merge into `main` in `~/projects/calendar` (fast-forward or merge commit).
2. The `post-merge` / `post-commit` hook runs `scripts/auto-deploy.sh` detached:
   unit tests → Docker build (`APP_VERSION` from `scripts/version.sh`, semver from conventional commits) → `docker compose
   up -d --force-recreate` → health check. On failure the old container keeps running.
3. Check the result:

   ```bash
   scripts/deploy-status.sh            # from a clone; prints "deploy: OK <sha> at HH:MM" or the failing test
   ```

   Log on sauron: `/tmp/calendar-autodeploy.log`.

Manual redeploy: `pnpm redeploy` (= `scripts/deploy.sh`) on sauron.

**Before every merge**, run the quick gate in your checkout (≈45 s, terse output):

```bash
pnpm --silent verify          # tsc web/server/e2e, unit tests, i18n check, step contract
pnpm --silent e2e:affected    # prints the --grep for a targeted e2e run of what changed
```

e2e runs on the laptop (never on sauron), targeted and with one worker, e.g.:

```bash
pnpm run build:e2e
CI_LOWPRIO=1 E2E_SKIP_BUILD=1 bash e2e/run.sh --project=mobile --workers=1 --reporter=line --grep "@tasks-view"
```

### Rollback

Revert the merge on `main` (`git revert -m 1 <merge-sha>`) — the hook deploys the reverted state. Data is not touched
by deploys; the Drive backup (below) covers data.

## Preview

```bash
scripts/preview-branch.sh add <branch>   # merge a branch into `preview` and rebuild
scripts/preview-branch.sh reset          # reset `preview` to main (after main merges)
scripts/preview-branch.sh status         # what `preview` has on top of main
```

Log: `/tmp/calendar-autopreview.log`. Preview builds (version `…-preview+<sha>`) reload themselves in the browser when a
new build is out.

## Configuration (`~/projects/calendar/deploy/.env`)

The compose file reads `.env` (mode 600, not in git). Edit on sauron, then redeploy:

```bash
nano ~/projects/calendar/deploy/.env
cd ~/projects/calendar && pnpm redeploy
```

| Variable | Meaning |
|---|---|
| `PROVIDER` | `mock` (demo data, no sign-in) or `google` |
| `PUBLIC_URL` | external base URL, e.g. `https://cal.home.example.com` (OAuth redirect, cookie `Secure`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client (type *Web application*) |
| `ALLOWED_EMAILS` | comma-separated Google accounts allowed to sign in |

All variables: `spec/ARCHITECTURE.md` §8.

## Going live with Google (HTTPS + OAuth)

Google only accepts an HTTPS redirect URI on a real domain, so HTTPS comes first.

1. **DNS at Cloudflare** — move the domain's nameservers (Namecheap) to Cloudflare (free). Create an API token with the
   *Edit zone DNS* template for that domain. Put it into `~/docker-compose/traefik/.env.cloudflare`
   (`CF_DNS_API_TOKEN=…`, `CAL_DOMAIN=…`). Guide: `~/docker-compose/traefik/HTTPS-GUIDE.md`.
2. **Traefik** gets a Let's Encrypt wildcard certificate via DNS-01 and a `websecure` router for
   `cal.<sub>.<domain>`; Pi-hole resolves `*.<sub>.<domain>` to sauron (LAN only, no public records).
3. **Google Cloud Console** (project e.g. "home-calendar"):
   - enable **Google Calendar API**;
   - OAuth consent screen: *External*; scopes `…/auth/calendar` and `…/auth/drive.appdata` (backups);
     **Publish → In production** (in *Testing*, sign-ins expire after 7 days; unverified is fine for personal use);
   - App logo (optional): `docs/branding/logo-120.png` (120×120, as Google recommends; vector in `logo.svg`). Uploading a
     logo on the consent screen triggers Google's app verification, so only upload it if verification is wanted;
     without it the app works as before (unverified is fine for personal use);
   - Credentials → OAuth client ID → *Web application*, redirect URI `https://cal.<sub>.<domain>/api/auth/google/callback`.
4. Fill `PROVIDER=google`, `PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` in `.env`; redeploy.
5. Sign in; in Settings → Account & data press **Allow backups to Google Drive** once.
6. Check `GET /api/health` → `provider: "google"`, `providerStatus: "ok"`.

## Backups (Google Drive)

With sign-in on and the Drive permission granted, the server backs up **all** server-side data of each person (prefs,
themes, canvas, shared lists they own, and the server-wide files) to the hidden app folder in their Google Drive:
2 minutes after the last change (at most every 5 minutes) and daily; the last 7 versions are kept. A fresh server restores
automatically at sign-in; Settings → Account & data has **Back up now** and **Restore from backup**.

## Android app

Build and publish on sauron (Gradle runs in the `calendar-android-build` image from `android/build.Dockerfile`, capped at
3 CPUs / 4 GB with low CPU shares; about 1 min with a warm cache in `~/.cache/calendar-gradle`):

```bash
scripts/android-build.sh            # builds a release-signed APK and copies it to DATA_DIR/downloads/app.apk
scripts/android-build.sh --no-publish
```

- The signing key is `~/calendar-android-key/release.jks` (new key since 2026-10-13: the laptop's key is gone, so the app
  had to be reinstalled once; not in a dot directory because the build container cannot mount those here) (password in `keystore.properties` next to it), **outside
  git — back it up**: updates of an installed app must be signed with the same key.
- The app is a Capacitor shell that loads the server chosen on the first start (`https://cal.example.org` or
  `http://cal.mordor.lan`; Settings → Account & data → Server → Change goes back to the chooser); web changes reach it on
  the next start, no new APK needed. Only native changes (widget, shell) need a rebuild.
- From another machine than sauron, `scripts/android-build.sh` publishes with scp/ssh to sauron (`SAURON=user@host`). Build
  with sauron's key (`~/calendar-android-key`): an APK signed with another key cannot update the installed app.
- **Public server (VPS)**: the APK is not in the image. `scripts/vps.sh deploy` (run on sauron) also copies
  `deploy/data/downloads/app.apk` into the running app container (`/data/downloads/app.apk`, volume `calendar_data`), so
  `https://cal.example.org/app.apk` and the Settings button work there. Check:
  `curl -sI https://cal.example.org/app.apk` (200, `application/vnd.android.package-archive`). To update only the APK, run
  the same deploy (the image is re-sent but unchanged) or do the `scp` + `docker compose cp` steps by hand.

Install on a phone: open `https://cal.example.org/app.apk` or (home Wi-Fi) `http://cal.mordor.lan/app.apk` (or Settings → Android app → Download), allow the
browser to install unknown apps, install ("Install anyway" if Play Protect warns), open the app once, then add the
widget from the home screen's widget list.

## GitHub mirror

```bash
git remote add github git@github.com:JohSchillerEmnify/fresh-ds-calendar.git   # once
git fetch origin && git push github origin/main:refs/heads/main
```

`origin` is the sauron repo: `sauron@192.168.1.38:projects/calendar`.
