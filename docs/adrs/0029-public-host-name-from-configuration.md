# 0029 — The public host name comes from configuration

- Status: accepted (owner, 2026-10-30); refines ADR 0022
- Views shaped: `deployment`, `androidApp`

## Decision
- The repository names no real host. The public host is `CAL_DOMAIN` (e.g. `cal.example.org`), written to the server's
  `.env` by `scripts/vps.sh env`; the Caddyfile and `compose.yml` read it, `PUBLIC_URL` is derived from it.
- `scripts/vps.sh env` and `deploy` stop when `CAL_DOMAIN` is unset; `compose.yml` refuses to start without it.
- The Android app's server is `CAL_SERVER_URL` (or `https://$CAL_DOMAIN`), built into `BuildConfig.SERVER_URL`.
  `scripts/android-build.sh` stops without it, and a release build fails unless it is `https://host` with no path.
  Debug builds and unit tests fall back to `https://cal.example.org`.
- Docs and tests use `cal.example.org` and `example.test`.

## Alternatives weighed
- **A default host in the scripts**: names the production host in a public repo and lets a fork deploy to it by mistake.
- **A chooser in the app** (ADR 0012): a first-start question nobody wants.
- **One APK per server in CI**: needs signing keys outside the owner's machine.

## Why
The repo is public (AGPL). Naming nothing in it costs one required variable and keeps forks safe and the history free of
infrastructure details.
Spec: not a scenario (script and build behaviour); see `docs/DEVELOPER-GUIDE.md` section 3 and `docs/DEPLOYMENT.md`.
