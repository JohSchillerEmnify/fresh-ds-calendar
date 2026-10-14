# Calendar

A mobile-first Google Calendar clone in Material 3 style, with expandable task lists in the calendar views, installable as a PWA.
It syncs with Google Calendar through a provider abstraction. A mock Google backend is the default until the owner
enables real Google (see `spec/ARCHITECTURE.md` §9).

Spec-driven: `spec/features/*.feature` is the single source of truth and runs directly as the e2e suite.

## Layout

| Path | Contents |
|---|---|
| `BRIEF.md` | Owner brief and fixed technical decisions (binding) |
| `spec/features/` | Gherkin features (navigation, year, month picker, timeline, events, event colors, drag and drop, task lists, open tasks, categories, settings, ADHD support, reward, streak, plant, sunflowers, sync, mobile, PWA, theme, performance, health) |
| `spec/STEPS.md` | Every step phrase as a Cucumber expression; contract for `e2e/steps/` |
| `spec/ACCEPTANCE.md` | Numbered acceptance criteria (AC-01 … AC-87) mapped to scenarios and checks |
| `spec/ARCHITECTURE.md` | Components, `CalendarProvider`, task list ↔ Google mapping, sync, mobile UX, Material 3, resource budgets, PWA, testids, env, owner actions |
| `spec/API.md` | REST contract under `/api`, incl. test-only endpoints (`TEST_MODE=true`) |
| `spec/ASSUMPTIONS.md` | Decisions made without the owner |
| `docs/ADHD-RESEARCH.md` | ADHD research with sources and derived requirements (R1–R24) |
| `spec/scripts/check-steps.py` | Checks that every feature step matches exactly one expression in `STEPS.md` |
| `server/` | API and static hosting; stack per BRIEF / `docs/RESEARCH.md` *(to be built)* |
| `web/` | Web app (PWA); stack per BRIEF / `docs/RESEARCH.md` *(to be built)* |
| `e2e/` | Playwright 1.48.2 + playwright-bdd running `spec/features` *(to be built)* |

## Quick facts

- Deployment: see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (`http://cal.mordor.lan`, Traefik, compose in `deploy/` of the repo; `.env` and `data/` there are git-ignored).
  HTTPS on `https://cal.<subdomain>.<owner-domain>` is planned (owner action), needed for full PWA install and real Google OAuth.
- Key env: `PROVIDER=mock|google`, `DATA_DIR`, `SEED`, `TEST_MODE`, `PUBLIC_URL`, `POLL_INTERVAL_MS`, `TZ`.
- Toolchain: Node 24.21.0 at `~/.local/opt/node-v24.21.0-linux-x64/bin` + pnpm 12.11.2. `pnpm install`, `pnpm test`,
  `pnpm build`, `pnpm size`, `pnpm redeploy` (= `scripts/deploy.sh`). Theme tokens: `pnpm -F @calendar/web tokens`.
- Check the step contract: `python3 spec/scripts/check-steps.py`.

## Android app

A Capacitor shell around `http://cal.mordor.lan` plus a weekly home-screen widget (`android/`, spec: ARCHITECTURE
"Android app and widget"). Build and publish: `scripts/android-build.sh` (`--no-publish` to only build). It runs on sauron:
Gradle runs in the `calendar-android-build` Docker image (`android/build.Dockerfile`: JDK 21 + Android SDK 36), builds `android/app/build/outputs/apk/release/app-release.apk`
and copies it to `DATA_DIR/downloads/app.apk` (served at `http://cal.mordor.lan/app.apk`).

- **Release key**: generated once by the script in `~/calendar-android-key/` (`release.jks` + `keystore.properties`),
  outside git and gitignored. Back it up: an installed app can only be updated by an APK signed with the same key.
- **Install on the phone**: open `http://cal.mordor.lan/app.apk` in Chrome, allow "Install unknown apps" for Chrome when
  asked, open the downloaded file and install; then long-press the home screen, Widgets, Calendar, add the weekly
  widget, the day widget and/or the clock widget (today on the 24-hour clock).
- Tests: `./gradlew testDebugUnitTest` in `android/` (native day splitting), `pnpm -F @calendar/web test` (snapshot builder).

