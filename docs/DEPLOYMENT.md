# Deployment guide

How the calendar app is built, deployed and installed. The GitHub repository is the source. After a green CI run on
`main`, GitHub Actions deploys it to the public server (VPS); the laptop deploys by hand only when that automatic deploy is off. The architecture is in `docs/architecture`
(LikeC4) and `docs/adrs`; this page is the runbook.

## Overview

| What | Where | How it updates |
|---|---|---|
| Source | `github.com/<owner>/<repo>` (remote `github`), branch `main` | merge, `git push github main` |
| Production | `https://cal.example.org` (VPS, Caddy terminates HTTPS) | automatic after a green CI run ("Automatic deploy" below); `scripts/vps.sh deploy` from the laptop only when that is off or for `compose.yml` and the Caddyfile |
| Android app | `https://cal.example.org/app.apk` (also Settings → Account & data → Android app) | built, signed and shipped by CD when native code changed (ADR 0040); by hand with `scripts/android-build.sh --no-publish` and `scripts/vps.sh deploy` |

There is no preview deployment: to show work before a merge, run it locally (`pnpm dev:server` and `pnpm dev:web`).
The old home server is no longer a deploy target; its scripts (`scripts/auto-deploy.sh`,
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
4. Watch the CI and Deploy runs (`gh run list --branch main --limit 3`); CD deploys after a green CI. The by-hand deploy
   (next section) is for when CD is off.

## Production deploy (VPS)

```bash
VPS_HOST=<ip> CAL_DOMAIN=cal.example.org VPS_USER=root scripts/vps.sh deploy
```

`scripts/vps.sh` runs from the laptop checkout; the VPS (1 CPU, 1 GB) never builds. `deploy` builds the checked-out
commit into the `calendar:latest` image here (`APP_VERSION` = `scripts/version.sh` + short sha), copies
`deploy/vps/compose.yml` and `deploy/vps/Caddyfile` to `/opt/calendar/`, sends the image over SSH (`docker save | docker
load`), runs `docker compose up -d`, waits for `/api/health` (rolling back if it never says ok, see Rollback), and then ships the Android APK (below). Caddy gets and renews the Let's Encrypt
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

`deploy` tags the image `calendar:<version>` (the `+` of the version becomes `-`) and `calendar:latest`, and keeps what ran
before as `calendar:previous` and the last three versions on the VPS. After `docker compose up -d` it waits up to 120 s
(`HEALTH_TIMEOUT`) for `/api/health` to say `ok`; if it does not, it runs `calendar:previous` again and exits non-zero.
By hand: `scripts/vps.sh rollback` (the previous image) or `scripts/vps.sh rollback 0.18.0+94da588` (a kept version).
Then revert the bad merge on `main` (`git revert -m 1 <merge-sha>`) and push. A version older than the last three needs a
checkout and a new deploy. Data is not touched by deploys; the Drive backup (below) covers data. `DRY_RUN=1` prints the
remote commands instead of running them.

## Automatic deploy (CD from GitHub Actions)

`.github/workflows/deploy.yml` runs after a green `CI` run on `main` (event `push`) and does nothing unless the repository
variable `DEPLOY_ENABLED` is `true`. It builds the image, pushes it to `ghcr.io/<owner>/<repo>:<sha>`, and runs the digest
on the VPS over SSH with a dedicated key whose `authorized_keys` entry forces `/opt/calendar/deploy-from-ghcr.sh`
(`deploy/deploy-from-ghcr.sh`; ADR 0036). The script validates the digest, pulls, keeps `calendar:previous`, restarts compose,
waits for `/api/health` and rolls back by itself; only the app container is recreated, Caddy holds requests for up to 60 s meanwhile and the server drains requests in flight (ADR 0042, no 502 during a deploy, a pause of a few seconds); the workflow finally curls `APP_URL/api/health`. Deploys run one at a time
(concurrency group `deploy`, never cancelled). It does not ship `compose.yml` or the Caddyfile: use
`scripts/vps.sh config` (files only, reloads Caddy) or `scripts/vps.sh deploy` for those. The APK follows the server deploy automatically, see "Android app".

| Setting | Kind | Value |
|---|---|---|
| `DEPLOY_SSH_KEY` | secret | private half of the CD key |
| `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `APP_URL`, `DEPLOY_ENABLED` | variables | VPS host, its pinned host key line(s), `https://<CAL_DOMAIN>`, `true` |
| `DEPLOY_USER` | variable, optional | SSH user, default `root` |
| `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | secrets of the environment `android-release` only | release keystore (base64) and its credentials; only the job `apk-sign` can read them |
| `APK_CERT_SHA256` | line in `/opt/calendar/deploy.env` on the VPS | public release certificate pin, the forced command's check |

Setup is one command run by the owner (it touches the VPS and repository secrets): `VPS_HOST=<ip> CAL_DOMAIN=<host>
~/.local/share/calendar-tools/bin/setup-cd` (generates `~/.config/calendar/deploy_key`, installs the script and the forced-command key
on the VPS, sets the secret and variables; safe to re-run). Then, once, make the GHCR package public (GitHub: Packages >
the image > Package settings > Change visibility) so the VPS can pull without credentials, and make `CI result` the only
required status check in the branch ruleset. Switch off by setting `DEPLOY_ENABLED` to anything else; a bad deploy rolls back
on the VPS, by hand see Rollback.

CI hardening that goes with it: workflows have `contents: read` by default, checkouts do not persist credentials, every job
has a timeout, pnpm installs run with `--ignore-scripts` (esbuild ships its binary as a platform package and Playwright
browsers and `cap sync` are run explicitly, so nothing needs a lifecycle script), and Dependabot proposes one grouped update
per ecosystem per week for versions older than three days.

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
`ALLOWED_EMAILS` and `TZ`, plus a freshly generated `TOKEN_ENC_KEY` (`deploy` adds one to an older `.env` that lacks it); edit other values on the VPS, then deploy again (or `docker compose up -d` in
`/opt/calendar`).

| Variable | Meaning |
|---|---|
| `PROVIDER` | `mock` (demo data, no sign-in) or `google` |
| `PUBLIC_URL` | external base URL, e.g. `https://cal.home.example.com` (OAuth redirect, cookie `Secure`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client (type *Web application*) |
| `ALLOWED_EMAILS` | comma-separated Google accounts allowed to sign in |
| `TOKEN_ENC_KEY` | AES-256-GCM key (32 bytes, base64) for the stored Google refresh tokens (ADR 0026); generated on the VPS by `env`/`deploy`, never leaves it. The server refuses to start with `PROVIDER=google` without it. Losing or changing it only means everyone signs in again |

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
| `LIVE_GOOGLE_POLL_MS` | `20000` | how often the server asks Google for changes made in Google Calendar while an app is open (live sync, at least 1000; longer after failures) |
| `POLL_INTERVAL_MS` | `30000` | web polling interval; while the live connection is up the app polls at most once a minute |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | – | OAuth client (PROVIDER=google) |
| `GOOGLE_REFRESH_TOKEN` | – | legacy single-account token, used only if Google returns none at the first sign-in |
| `GOOGLE_CALENDAR_IDS` | `primary` | comma-separated calendars to show |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_URL}/api/auth/google/callback` | OAuth redirect |
| `LOG_LEVEL` | `info` | log level (`debug`/`info`/`warn`/`error`) |
| `ALLOWED_EMAILS` | – | comma-separated Google addresses that may sign in |
| `PLACE_SEARCH_URL` | `https://photon.komoot.io/api` | Photon place search the device asks directly for location suggestions (https only). Its origin is added to the CSP `connect-src`; on the VPS also change the Caddyfile CSP |
| `MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | map picture template the device loads directly (https only, needs `{z}` `{x}` `{y}`). Its origin is added to the CSP `img-src` and `connect-src` (the service worker keeps shown pictures for offline use); on the VPS also change the Caddyfile CSP |
| `ALLOW_INSECURE_MOCK` | – | `1` lets the mock (no sign-in) start on a public HTTPS address or in production |
| `CHANGELOG_PATH` | `CHANGELOG.md` | source of the in-app release notes |
| `TOKEN_ENC_KEY` | – | key for the stored refresh tokens (see above); required with `PROVIDER=google` unless `TEST_MODE=1` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | – | Web Push keys; without them the server generates a pair on first start into `DATA_DIR/vapid.json` |
| `WEB_DIST` | `web/dist` | the built web app the server serves |

## Going live with Google (HTTPS + OAuth)

Google only accepts an HTTPS redirect URI on a real domain, so HTTPS comes first.

1. **DNS** — an A record for `cal.example.org` points at the VPS.
2. **HTTPS** — Caddy (`deploy/vps/Caddyfile`) gets the Let's Encrypt certificate on the first deploy; nothing to do
   by hand.
   Live sync (ADR 0030) keeps one `text/event-stream` request open per app (`GET /api/events/stream`, a comment line every
   25 s). The shipped Caddyfile needs nothing extra: `reverse_proxy` flushes `text/event-stream` at once and `encode`
   streams it unbuffered (Caddy docs). Any other proxy in front must not buffer or time out that path (nginx:
   `proxy_buffering off` and a long `proxy_read_timeout`; the server also sends `X-Accel-Buffering: no`).
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

**Automatic (ADR 0040).** After a server deploy, `deploy.yml` builds the unsigned APK (job `apk-build`, no secrets) when native
code changed since the last `apk-*` release (`android/`, `capacitor.config.*`, `@capacitor` dependency lines), or when
started by hand with `force_apk`. Job `apk-sign` (environment `android-release`, the only holder of the keystore secrets)
signs it, checks the pinned certificate and publishes release `apk-<version>` with `app-release.apk` and `app.json`; job
`apk-ship` runs `apk apk-<version>` through the CD key, and the forced command downloads that release, verifies sha256 and
the pin and puts both files into `/data/downloads`. One-time setup by the owner: `VPS_HOST=<ip>
~/.local/share/calendar-tools/bin/apk-ci-setup` (creates the environment for `main` only, sets its secrets from
`~/calendar-android-key`, reinstalls the forced command, writes the pin into `deploy.env`).

Manual path: build on the laptop (Gradle runs in the `calendar-android-build` image from `android/build.Dockerfile`, capped at
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
  `pnpm verify` enforces it: a branch with a `feat`/`fix` commit and no `CHANGELOG.md` change fails.
  Text under `## Older history` is ignored. The server image includes `CHANGELOG.md`.
