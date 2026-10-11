# Calendar

A mobile-first Google Calendar clone in Material 3 style, with expandable task lists in the calendar views, installable as a PWA.
It syncs with Google Calendar through a provider abstraction. A mock Google backend is the default until the owner
enables real Google (see `spec/ARCHITECTURE.md` §9).

Spec-driven: `spec/features/*.feature` is the single source of truth and runs directly as the e2e suite.

## Layout

| Path | Contents |
|---|---|
| `BRIEF.md` | Owner brief and fixed technical decisions (binding) |
| `spec/features/` | Gherkin features (navigation, events, task lists, sync, mobile, PWA, theme, performance, health) |
| `spec/STEPS.md` | Every step phrase as a Cucumber expression; contract for `e2e/steps/` |
| `spec/ACCEPTANCE.md` | Numbered acceptance criteria (AC-01 … AC-62) mapped to scenarios and checks |
| `spec/ARCHITECTURE.md` | Components, `CalendarProvider`, task list ↔ Google mapping, sync, mobile UX, Material 3, resource budgets, PWA, testids, env, owner actions |
| `spec/API.md` | REST contract under `/api`, incl. test-only endpoints (`TEST_MODE=true`) |
| `spec/ASSUMPTIONS.md` | Decisions made without the owner |
| `spec/scripts/check-steps.py` | Checks that every feature step matches exactly one expression in `STEPS.md` |
| `server/` | API and static hosting; stack per BRIEF / `docs/RESEARCH.md` *(to be built)* |
| `web/` | Web app (PWA); stack per BRIEF / `docs/RESEARCH.md` *(to be built)* |
| `e2e/` | Playwright 1.48.2 + playwright-bdd running `spec/features` *(to be built)* |

## Quick facts

- Deployment: `http://cal.mordor.local` (Traefik, compose file in `/home/sauron/docker-compose/calendar/`).
  HTTPS on `https://cal.<subdomain>.<owner-domain>` is planned (owner action), needed for full PWA install and real Google OAuth.
- Key env: `PROVIDER=mock|google`, `DATA_DIR`, `SEED`, `TEST_MODE`, `PUBLIC_URL`, `POLL_INTERVAL_MS`, `TZ`.
- Toolchain: Node 22 at `~/.local/opt/node-v22.11.0-linux-x64/bin`; e2e in `mcr.microsoft.com/playwright:v1.48.2-noble`.
- Check the step contract: `python3 spec/scripts/check-steps.py`.
