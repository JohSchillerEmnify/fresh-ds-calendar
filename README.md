# Fresh-D's Kalender

> Trag ein, trag aus, macht mir nix aus!

A mobile-first Google Calendar clone in Material 3 style, with expandable task lists in the calendar views,
installable as a PWA, plus an Android shell with home-screen widgets. Self-hosted instance: <https://cal.example.org>.

It syncs with Google Calendar through a provider abstraction. A mock Google backend is the default
(`PROVIDER=mock`); real Google (`PROVIDER=google`) needs your own OAuth credentials (see `docs/DEPLOYMENT.md` "Going live with Google").

Spec-driven: `spec/features/*.feature` is the single source of truth and runs directly as the e2e suite.

## Stack

- `web/`: Vue 3 PWA (Vite, TypeScript)
- `server/`: Hono + TypeScript API with static hosting
- `shared/`: code and schemas shared by web and server
- `e2e/`: Playwright + playwright-bdd running `spec/features`
- `android/`: Capacitor shell with native widgets
- pnpm workspace, Node >= 24.11

## Run locally

```sh
pnpm install
pnpm build            # web + server
pnpm dev:server       # API (mock provider by default)
pnpm dev:web          # Vite dev server
pnpm test             # unit tests
pnpm verify           # tsc + unit + i18n + steps + dedup + lint (the pre-merge gate)
pnpm e2e              # Playwright suite over spec/features (needs a browser)
```

Key env vars: `PROVIDER=mock|google`, `DATA_DIR`, `SEED`, `TEST_MODE`, `PUBLIC_URL`, `POLL_INTERVAL_MS`, `TZ`.
Theme tokens: `pnpm -F @calendar/web tokens`. Deployment notes: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Layout

| Path | Contents |
|---|---|
| `BRIEF.md` | Owner brief and fixed technical decisions |
| `spec/features/<domain>/` | Gherkin features (each with an `@id:`), also the e2e suite |
| `docs/architecture/` | LikeC4 architecture model and views |
| `docs/adrs/` | Architecture decision records |
| `e2e/STEPS.md` | Every step phrase as a Cucumber expression; contract for `e2e/steps/` |
| `spec/ARCHITECTURE.md` | Pointer: where each former architecture section now lives |
| `spec/API.md` | REST contract under `/api`, incl. test-only endpoints (`TEST_MODE=true`) |
| `spec/ASSUMPTIONS.md` | Pointer: the retired assumptions were triaged on 2026-10-22 |
| `docs/` | Research, deployment and backlog notes |
| `e2e/scripts/check-steps.py` | Checks every feature step matches exactly one expression in `STEPS.md` |

## Android app

A Capacitor shell around the calendar server `https://cal.example.org`, plus a weekly home-screen widget
(`android/`, architecture: views `androidApp` and `widget`, ADRs 0012–0015, 0022). `scripts/android-build.sh` builds an unsigned release APK
in a Docker image (JDK 21 + Android SDK 36) and signs it with your own release keystore, which is kept outside git
(`*.jks`, `keystore.properties` are ignored). Back the key up: an installed app can only be updated by an APK signed with the same key.
Native unit tests: `./gradlew testDebugUnitTest` in `android/`.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).
