# Developer guide

The short version of everything you need to run, change and deploy this calendar yourself. The details live in
[`DEPLOYMENT.md`](DEPLOYMENT.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) and the decisions in [`adrs/`](adrs/).

## 1. Read this before you deploy

This is a hobby project, built for a household. Please know what you are getting.

- **This app is vibe-coded.** Most of the code was written by AI agents and steered by one person.
  - Specs, tests, reviews and a security audit keep it in check, but it has not been reviewed line by line by
    experienced humans.
  - Treat it like any unaudited hobby code: read what you run, and don't trust it with anything you can't afford
    to lose or leak.

- **No warranty.** The code is AGPL-3.0 and comes "as is" (see `LICENSE`). If you run it, you run it at your own risk.
  If you offer it to others over a network, the AGPL requires you to offer them your source code too.
- **The admin can read everything.** Whoever has root on the server can read every user's data. That includes their
  settings, task lists, canvas and templates, and, through the stored Google refresh token, their whole Google Calendar.
  Encryption does not change this, because the key sits on the same server. Only invite people who trust you with that.
- **What encryption does protect.** Google refresh tokens are encrypted with AES-256-GCM (`TOKEN_ENC_KEY`, ADR 0026), and
  sessions are stored only as hashes. A leaked data folder or backup alone gives an attacker no working login and no
  Google access. Everything else on the server (settings, lists, canvas, push subscriptions) is plain JSON.
- **Where the data lives.**
  - Events and task lists live in the users' Google Calendars.
  - The app's own data lives in `DATA_DIR` on your server, with a backup in each user's Google Drive app folder.
  - Each device keeps a copy for offline use.
- **Who else sees traffic.**
  - Google sees calendar and Drive access.
  - The users' devices load map pictures from `tile.openstreetmap.org` and place suggestions from `photon.komoot.io`,
    so those services see the device's IP address and the typed search text. You can change both (`MAP_TILE_URL`,
    `PLACE_SEARCH_URL`).
  - Push notifications go through the browser maker's push service.
- **Privacy law (GDPR / DSGVO): not legal advice.**
  - Running it only for yourself and your household is very likely covered by the household exemption (Art. 2(2)(c)
    GDPR). Keep `ALLOWED_EMAILS` limited to those people.
  - Once you let other people in (friends, the public), you become responsible for their data. You then need at least
    a real privacy policy, a data processing agreement with your hosting provider, and in Germany an Impressum. You may
    also need consent or a proxy for the map services.
  - `web/public/privacy.html` is written for a private instance. Adapt it to yours.
- **Google's side.** Your own Google OAuth app stays "unverified", which is fine for personal use. Users see Google's
  warning screen once.
- **Keep these safe**, outside git:
  - your server's `.env`, which holds the Google client secret and `TOKEN_ENC_KEY`;
  - the Android signing key, if you build the app.

  If something leaks, follow [`SECURITY-RUNBOOK.md`](SECURITY-RUNBOOK.md). Report vulnerabilities in this code as
  [`SECURITY.md`](../SECURITY.md) describes.

## 2. Try it locally (no Google, no server)

You need Node ≥ 24.11 and pnpm (version pinned in `package.json`).

```sh
pnpm install
pnpm build
pnpm dev:server   # API with the mock provider and demo data, no sign-in
pnpm dev:web      # opens the web app
```

The mock provider imitates Google Calendar in a local JSON file, so you can click through everything without an
account.

## 3. Deploy your own instance

What you need:
- a small Linux VPS with Docker and Docker Compose, reachable over SSH with your key;
- a domain whose A record points at it, e.g. `cal.example.org`;
- a Google Cloud project;
- Docker on your own machine, because the image is built there and copied to the server; the VPS never builds.

Steps:
1. **Google Cloud Console:**
   - Enable the Google Calendar API.
   - Set the OAuth consent screen to *External*, with the scopes `…/auth/calendar` and `…/auth/drive.appdata`. Publish
     it "In production"; in *Testing*, sign-ins expire after 7 days.
   - Create an OAuth client of type *Web application* with the redirect URI
     `https://cal.example.org/api/auth/google/callback`.
2. **Write the server's settings:**
   `VPS_HOST=<server ip> CAL_DOMAIN=cal.example.org scripts/vps.sh env`.
   - It asks for the client ID, the client secret and the allowed Google accounts.
   - It writes `/opt/calendar/.env` and generates `TOKEN_ENC_KEY` on the server.
3. **Deploy:** `VPS_HOST=<server ip> CAL_DOMAIN=cal.example.org scripts/vps.sh deploy`.
   - It builds the checked-out commit and copies the image over SSH.
   - It starts the app behind Caddy, which gets the HTTPS certificate by itself.
4. **Check:**
   - `curl -s https://cal.example.org/api/health` should show `"provider":"google","providerStatus":"ok"`.
   - Then sign in and, under Settings → Account & data, allow backups to Google Drive.
5. **Optional:**
   - `scripts/vps.sh harden` switches the server to a non-root deploy user with key-only SSH.
   - The Android app needs `CAL_DOMAIN` set for `scripts/android-build.sh`; see `DEPLOYMENT.md` → Android app.

What the scripts refuse to do (ADR 0029):
- `scripts/vps.sh env` and `deploy` stop at once when `CAL_DOMAIN` is not set. The public host name is never in the repo.
- `scripts/android-build.sh` stops when neither `CAL_DOMAIN` nor `CAL_SERVER_URL` is set, and a release build of the
  Android project fails without an `https://` server URL. The app's server is build configuration.

Updating means running step 3 again. Deploys never touch the data. To roll back, check out the last good commit and
deploy it.

Never run `scripts/vps.sh env` again on a server that is already running unless you mean to: it rewrites `.env`. It
keeps the token key, but it asks for every other value again.

## 4. Working on the code

### Without an AI agent

Two rules shape everything here.

- **Spec-driven development.** The behaviour is written down first, as Gherkin scenarios in `spec/features/`, and
  those scenarios *are* the e2e tests (Playwright runs the `.feature` files directly). The spec is the source of truth:
  if code and spec disagree, the code is wrong or the spec gets changed on purpose, never quietly.
- **Test-driven development.** Red, then green, then refactor: a failing test first, then the smallest code that makes
  it pass, then clean-up while it stays green. A bug gets a reproducing test before its fix.

In practice:

1. **Describe the change.** Write or change the scenario in `spec/features/<area>/*.feature`.
   - Every step sentence must exist in `e2e/STEPS.md`; check with `python3 e2e/scripts/check-steps.py`.
   - A bigger decision also gets a short ADR in `docs/adrs/`.
2. **Build it test-first.** Write the failing test (a unit test, or the scenario as an e2e test), then the code.
3. **Before every merge,** run `pnpm verify`. It runs the type checks, unit tests, i18n, the step contract,
   duplication and lint, in about a minute.
4. **Run only the e2e scenarios you touched.** `pnpm e2e:affected` prints the `--grep` for them. The full suite is
   slow and only needed before a release.
5. **Commit.** Use conventional commits (`feat:`, `fix:`, `docs:` …). They also drive the version number.
6. **Leak guards.** Run `pnpm hooks:install` once. The pre-commit and pre-push hooks (and CI) run `scripts/leak-check.sh`:
   gitleaks rules (secrets, keys, public IPs, e-mail addresses) plus your private denylist, checked in diffs, commit
   messages and author e-mails.
   - Put your own real values (domain, server IP, e-mails, one per line) in `~/.config/calendar/leak-denylist`, outside
     git. `--no-verify` skips the hooks, but CI catches it anyway. Needs gitleaks or Docker.

CI checks every PR (and every push to main): `pnpm verify`, `pnpm audit`, CodeQL, the `@smoke` e2e scenarios and the Android unit tests. PRs from forks wait for the owner's approval before CI runs.

Where things are:
- `web/`: the Vue PWA.
- `server/`: the Hono API.
- `android/`: the Capacitor shell and widgets.
- `spec/`: the behaviour.
- `docs/adrs/`: why things are the way they are.
- `docs/architecture/`: the C4 model.

### With an AI agent

Agents (Claude Code, Codex, Cursor …) read [`AGENTS.md`](../AGENTS.md) in the repo root (for Claude Code, put `@AGENTS.md` in
your own, git-ignored `CLAUDE.md`). It spells out the spec-driven and test-driven workflow for them, step by step:
- the spec first, with a stop for your OK;
- red, then green, then refactor;
- `pnpm verify` before every merge;
- only targeted e2e;
- no secrets or real host names in the repo.

What works well:
- **Let the agent write the scenarios first, and read them before it builds.** Changing a scenario is cheap; changing
  built code is not.
- **One feature per branch.** Give each agent its own git worktree (`git worktree add ../calendar-wt/<name> -b <branch>`)
  so parallel agents don't trip over each other.
- **Review what comes back.** Ask the agent for its list of assumptions and open questions, check the diff, and run
  `pnpm verify` yourself before you merge.
- **Never give an agent your `.env`, the server's root login or the signing key.** It doesn't need them to write code.
