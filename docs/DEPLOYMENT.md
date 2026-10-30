# Deployment guide

How the calendar app is built, deployed and installed. Everything runs from the laptop checkout: the GitHub repository
is the source, the public server (VPS) only runs what the laptop ships. The architecture is in `docs/architecture`
(LikeC4) and `docs/adrs`; this page is the runbook.

## Overview

| What | Where | How it updates |
|---|---|---|
| Source | `git@github.com:JohSchillerEmnify/fresh-ds-calendar.git` (remote `github`), branch `main` | merge on the laptop, `git push github main` |
| Production | `https://cal.example.org` (VPS, Caddy terminates HTTPS) | `scripts/vps.sh deploy` from the laptop, by hand after a merge |
| Android app | `https://cal.example.org/app.apk` (also Settings → Account & data → Android app) | built on the laptop with `scripts/android-build.sh --no-publish`, shipped by `scripts/vps.sh deploy` |

There is no automatic deploy and no preview deployment any more: to show work before a merge, run it locally
(`pnpm dev:server` and `pnpm dev:web`). sauron is no longer a deploy target; its scripts (`scripts/auto-deploy.sh`,
`scripts/deploy.sh`, `scripts/preview-branch.sh`, and the auto-deploy git hooks in `scripts/hooks`, which the laptop
does not enable) are still in the repo but not part of this flow.

## Release flow

1. Work on a branch (worktrees in `~/projects/calendar-wt/<branch>`, main checkout `~/projects/calendar`).
2. Run the quick gate in the checkout (≈45 s, terse output) and the targeted e2e it suggests:

   ```bash
   pnpm --silent verify          # tsc web/server/e2e, unit tests, i18n check, step contract
   pnpm --silent e2e:affected    # prints the --grep for a targeted e2e run of what changed
   pnpm run build:e2e
   CI_LOWPRIO=1 E2E_SKIP_BUILD=1 bash e2e/run.sh --project=mobile --workers=1 --reporter=line --grep "@tasks-view"
   ```

3. Merge into `main` (adding the release-notes lines, see below) and push: `git push github main`.
4. Deploy (next section).

## Production deploy (VPS)

```bash
VPS_HOST=<ip> CAL_DOMAIN=cal.example.org VPS_USER=root scripts/vps.sh deploy
```

`scripts/vps.sh` runs from the laptop checkout; the VPS (1 CPU, 1 GB) never builds. `deploy` builds the checked-out
commit into the `calendar:latest` image here (`APP_VERSION` = `scripts/version.sh` + short sha), copies
`deploy/vps/compose.yml` and `deploy/vps/Caddyfile` to `/opt/calendar/`, sends the image over SSH (`docker save | docker
load`), runs `docker compose up -d`, and then ships the Android APK (below). Caddy gets and renews the Let's Encrypt
certificate for `cal.example.org` itself.

- `VPS_HOST` and `CAL_DOMAIN` are required (neither the address nor the public host name is in the repo; see
  "Deployment settings" below); `deploy` adds a missing `CAL_DOMAIN=` line to an older `/opt/calendar/.env`; `VPS_USER` defaults to `root` (the owner's
  choice of 2026-10-16); `VPS_KEY` defaults to `~/.ssh/id_ed25519`.
- `scripts/vps.sh env` writes `/opt/calendar/.env` (asks for the Google client and the allowed emails); `deploy`
  refuses to run without it. `scripts/vps.sh logs` follows the app and Caddy.
- `scripts/vps.sh harden` is opt-in: it creates a `deploy` user (docker group) with the laptop's key, switches SSH to
  keys only, adds fail2ban, and turns root login off only after the deploy user's login works; after it, deploy with
  `VPS_USER=deploy`.
- Check: `curl -s https://cal.example.org/api/health`.

### Rollback

Check out the last good commit on the laptop and deploy it again (`git checkout <sha>` then the deploy command), then
revert the bad merge on `main` (`git revert -m 1 <merge-sha>`) and push. Data is not touched by deploys; the Drive
backup (below) covers data.

## Deployment settings (where the public host name comes from)

The production host name is never written in the repo (docs and tests use the placeholder `cal.example.org`). Set it
once per place it is used:

| Setting | Where | Used for |
|---|---|---|
| `CAL_DOMAIN` (e.g. `cal.example.org`) | environment of `scripts/vps.sh env` and `scripts/vps.sh deploy` | required; `env` writes it and `PUBLIC_URL=https://$CAL_DOMAIN` into the VPS `.env`, `deploy` prints the APK URL and adds the line to an older `.env` |
| `CAL_DOMAIN` | `/opt/calendar/.env` on the VPS | compose passes it to Caddy, whose `Caddyfile` site address is `{$CAL_DOMAIN}` (HTTPS certificate host) |
| `CAL_DOMAIN` or `CAL_SERVER_URL` (`https://cal.example.org`) | environment of `scripts/android-build.sh` (`CAL_SERVER_URL` wins; the script exits if neither is set) | passed to Gradle as `CAL_SERVER_URL` |
| `CAL_SERVER_URL` env or `-PcalServerUrl=https://...` | Gradle (`android/app/build.gradle`) | `BuildConfig.SERVER_URL`, i.e. `ServerConfig.BASE_URL`. `assembleRelease`/`bundleRelease` fail without it; debug builds and unit tests default to `https://cal.example.org` |

## Configuration (`/opt/calendar/.env` on the VPS)

The VPS compose file (`deploy/vps/compose.yml`) reads `.env` (mode 600, not in git) and sets `PROVIDER=google` and
`SEED=false` itself. `scripts/vps.sh env` writes `CAL_DOMAIN`, `PUBLIC_URL=https://$CAL_DOMAIN`, the Google client,
`ALLOWED_EMAILS` and `TZ`; edit other values on the VPS, then deploy again (or `docker compose up -d` in
`/opt/calendar`).

| Variable | Meaning |
|---|---|
| `PROVIDER` | `mock` (demo data, no sign-in) or `google` |
| `PUBLIC_URL` | external base URL, e.g. `https://cal.home.example.com` (OAuth redirect, cookie `Secure`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client (type *Web application*) |
| `ALLOWED_EMAILS` | comma-separated Google accounts allowed to sign in |
| `DOOR_API_TOKEN`, `DOOR_PERSON` | optional door plugin (ADR 0004, `server/src/plugins/door/README.md`): the board's bearer key and the person it sees; empty = no door |

All variables (defaults from `server/src/config.ts`):

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `PUBLIC_URL` | unset | external base URL, e.g. `https://cal.example.org`: OAuth redirect, allowed origins, `Secure` cookie. Nothing in code hardcodes a host. |
| `ALLOWED_ORIGINS` | `PUBLIC_URL` | comma-separated extra origins for CORS (same-origin needs none) |
| `TZ` | `Europe/Berlin` | calendar time zone |
| `PROVIDER` | `mock` | `mock` \| `google` |
| `DATA_DIR` | `./data` | the app's own files per person, the mock store, sessions and tokens |
| `SEED` | `true` | seed demo data into an empty mock store |
| `TEST_MODE` | `false` | enables `/api/__test/*`; never true in production |
| `POLL_INTERVAL_MS` | `30000` | web polling interval |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | – | OAuth client (PROVIDER=google) |
| `GOOGLE_REFRESH_TOKEN` | – | legacy single-account token, used only if Google returns none at the first sign-in |
| `GOOGLE_CALENDAR_IDS` | `primary` | comma-separated calendars to show |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_URL}/api/auth/google/callback` | OAuth redirect |
| `LOG_LEVEL` | `info` | log level (`debug`/`info`/`warn`/`error`) |
| `ALLOWED_EMAILS` | – | comma-separated Google addresses that may sign in |
| `DOOR_API_TOKEN`, `DOOR_PERSON` | – | optional door plugin (ADR 0003/0004): the board's key (at least 32 characters, e.g. `openssl rand -base64 32`; a shorter key logs a warning and leaves the door off) and the person it sees; unset = no door |
| `TRUST_PROXY` | off | `1` when a reverse proxy in front sets `X-Forwarded-For` (the VPS compose file does): the door rate limit then counts the last entry of that header. Off, the header is ignored and the socket address is used, so never set it when the server is reachable directly |
| `PLACE_SEARCH_URL` | `https://photon.komoot.io/api` | Photon place search the device asks directly for location suggestions (https only). Its origin is added to the CSP `connect-src`; on the VPS also change the Caddyfile CSP |
| `MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | map picture template the device loads directly (https only, needs `{z}` `{x}` `{y}`). Its origin is added to the CSP `img-src` and `connect-src` (the service worker keeps shown pictures for offline use); on the VPS also change the Caddyfile CSP |
| `ALLOW_INSECURE_MOCK` | – | `1` lets the mock (no sign-in) start on a public HTTPS address or in production |
| `CHANGELOG_PATH` | `CHANGELOG.md` | source of the in-app release notes |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | – | Web Push keys; without them the server generates a pair on first start into `DATA_DIR/vapid.json` |
| `WEB_DIST` | `web/dist` | the built web app the server serves |

## Going live with Google (HTTPS + OAuth)

Google only accepts an HTTPS redirect URI on a real domain, so HTTPS comes first.

1. **DNS** — an A record for `cal.example.org` points at the VPS.
2. **HTTPS** — Caddy (`deploy/vps/Caddyfile`) gets the Let's Encrypt certificate on the first deploy; nothing to do
   by hand.
3. **Google Cloud Console** (project e.g. "home-calendar"):
   - enable **Google Calendar API**;
   - OAuth consent screen: *External*; scopes `…/auth/calendar` and `…/auth/drive.appdata` (backups);
     **Publish → In production** (in *Testing*, sign-ins expire after 7 days; unverified is fine for personal use);
   - App logo (optional): `docs/branding/logo-120.png` (120×120, as Google recommends; vector in `logo.svg`). Uploading a
     logo on the consent screen triggers Google's app verification, so only upload it if verification is wanted;
     without it the app works as before (unverified is fine for personal use);
   - Credentials → OAuth client ID → *Web application*, redirect URI `https://cal.example.org/api/auth/google/callback`.
4. Run `scripts/vps.sh env` (client ID, secret, `ALLOWED_EMAILS`), then deploy.
5. Sign in; in Settings → Account & data press **Allow backups to Google Drive** once.
6. Check `GET /api/health` → `provider: "google"`, `providerStatus: "ok"`.

## Backups (Google Drive)

With sign-in on and the Drive permission granted, the server backs up **all** server-side data of each person (prefs,
themes, canvas, shared lists they own, and the server-wide files) to the hidden app folder in their Google Drive:
2 minutes after the last change (at most every 5 minutes) and daily; the last 7 versions are kept. A fresh server restores
automatically at sign-in; Settings → Account & data has **Back up now** and **Restore from backup**.

## Android app

Build on the laptop (Gradle runs in the `calendar-android-build` image from `android/build.Dockerfile`, capped at
3 CPUs / 4 GB with low CPU shares; about 1 min with a warm cache in `~/.cache/calendar-gradle`), then ship it with the
deploy:

```bash
scripts/android-build.sh --no-publish
CAL_APK=android/app/build/outputs/apk/release/app-release.apk \
CAL_APK_INFO=android/app/build/outputs/apk/release/app.json \
VPS_HOST=<ip> CAL_DOMAIN=cal.example.org VPS_USER=root scripts/vps.sh deploy
```

Without `--no-publish` the script copies the APK to sauron (`SAURON=user@host`), which is no longer needed.

- The signing key is `~/calendar-android-key/release.jks` on the build machine (`CAL_ANDROID_KEY_DIR` overrides the
  folder; not in a dot directory because the build container cannot mount those; the key is new since 2026-10-13, so
  the app had to be reinstalled once) (password in `keystore.properties` next to it), **outside git — back it up**:
  updates of an installed app must be signed with the same key. Without it the first build generates a new one.
- **Pinned signing certificate.** `scripts/android-build.sh` and `scripts/vps.sh deploy` check the APK's signing
  certificate against the SHA-256 in `android/release-cert.sha256` (`scripts/apk-cert.sh`) and publish nothing else;
  `/app.json` next to the APK carries the fingerprint, which Settings → About shows.
- The app is a Capacitor shell that always loads `https://cal.example.org` (`ServerConfig.BASE_URL`, set at build time from `CAL_SERVER_URL`, ADR 0022; no
  first-start question); web changes reach it on the next start, no new APK needed. Only native changes (widget, shell) need a rebuild.
- **On the VPS** the APK is not in the image: `scripts/vps.sh deploy` copies `CAL_APK` (default
  `deploy/data/downloads/app.apk`) and its `app.json` sidecar (`CAL_APK_INFO`, default next to the APK) into the running
  app container (`/data/downloads/`, volume `calendar_data`), only if the APK's certificate matches the pinned one.
  Without an APK the server is deployed and `/app.apk` stays as it is. Check: `curl -sI https://cal.example.org/app.apk`
  (200, `application/vnd.android.package-archive`).

Install on a phone: open `https://cal.example.org/app.apk` (or Settings → Android app → Download), allow the
browser to install unknown apps, install ("Install anyway" if Play Protect warns), open the app once, then add the
widget from the home screen's widget list.

## Versioning and release notes

- Versions are semantic and counted on every deploy by `scripts/version.sh`: since the last tag `vX.Y.Z`, a commit
  subject starting `feat` raises the minor version, anything else the patch version; a breaking marker (`type!:` or a
  `BREAKING` body line) raises the major version, except while the major is 0 (it raises the minor; 1.0.0 is set by
  hand when the public instance goes live). Without a tag the version is `0.1.0`. The build carries
  `APP_VERSION=X.Y.Z+<sha>`, which `/api/config` reports.
- Every merge to main adds one or two plain, user-facing English sentences as `- ` bullets under a `## YYYY-MM-DD`
  heading at the top of `CHANGELOG.md`, in the merge commit itself (test, tooling and spec-only merges add nothing).
  Text under `## Older history` is ignored. The server image includes `CHANGELOG.md`.
