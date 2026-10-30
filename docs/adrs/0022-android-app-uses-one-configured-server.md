# 0022 — The Android app uses one configured server

- Status: accepted (owner, 2026-10-23); supersedes the server choice of ADR 0012
- Views shaped: `androidApp`, `startApp`

## Context

The app asked at the first start which server to use (the public one or the home-network one, ADR 0012) and offered
Change in the settings. The owner wants no such question: the app is for the public instance.

## Decision

- The server is configuration: `ServerConfig.BASE_URL` = `https://cal.example.org`, read by the shell (as Capacitor's
  `server.url`, so the bridge and every plugin work there) and by the widget. No chooser page, no settings row.
- The plugin keeps its name `ServerChoice` because deployed web apps call it (`appVersion`); its `get` and `choose` are gone.
- HTTPS only: the cleartext exception for the home-network host is removed.

- 2026-10-30 note: the URL is build configuration, no longer a constant in the source (the repo is public and does not
  name the production host): `ServerConfig.BASE_URL` = `BuildConfig.SERVER_URL`, from `CAL_SERVER_URL` / `-PcalServerUrl`
  (release builds fail without it; see docs/DEPLOYMENT.md "Deployment settings").

## Alternatives

- *Keep the chooser, default to the public server* — still a first-start question the owner does not want.
- *A build flag per server* — two APKs to sign and publish for a server nobody chooses any more.

## Consequences

- A phone that had chosen the home-network server switches to the public one with the new APK and has to sign in there
  once; the widget's first fetch drops the old choice and its week and snapshot (once), so it shows the public server's
  week after that fetch.
- The offline page offers only "Try again".
