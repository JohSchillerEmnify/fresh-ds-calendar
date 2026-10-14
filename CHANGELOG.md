# Changelog

## 2026-10-14

- Google rate limits no longer break syncing: calendars are cached per person and the app backs off after a failed sync.
- The "New version available" prompt no longer comes back after you reload.
- In the Horizontal view, dragging sideways moves through time instead of jumping to the next week.
- A tapped task list grows over its whole day column, without scrollbars.

## Older history

## Iteration 1 — walking skeleton (2026-10-12)

Live at **http://cal.mordor.local** (also linked on Homepage as "Calendar").

What you can see:
- App shell, mobile first (works at 375px): top bar with the current period, **Today**, previous/next.
- Bottom tab bar **Month / Week / Day**; floating **+** button opens a "coming soon" sheet.
- Month view: Monday-first grid of the real month, today highlighted; tap a day to open its day view.
- Week view: Mon–Sun columns with an hourly grid (24h). Day view: hour list.
- Deep links: `/month/2026-10`, `/week/2026-10-12`, `/day/2026-10-12`; `/` opens the current month.
- Light and dark mode (follows the phone setting).
- PWA basics: manifest, placeholder icons (192, 512, maskable, apple-touch-icon), service worker, iOS meta tags.
  Installing needs HTTPS, which is still an owner action.

Not yet: events, task lists, Google sync (no data is shown yet).

Under the hood:
- `server/`: Fastify (Node 22, TypeScript), `GET /api/health`, serves the built web app with SPA fallback.
- `web/`: Vue 3 + Vite + Pinia + Vue Router + date-fns.
- Single Docker image; compose file at `/home/sauron/docker-compose/calendar/docker-compose.yaml`.
- Redeploy: `scripts/deploy.sh` (runs tests, rebuilds, waits for health).

## Iteration 1.1 — stack migration (2026-10-12)

No visible feature change; the app looks and works as before, with Material 3 colors and icons.

- Runtime: Node 24.21.0 LTS (was 22.11). Package manager: pnpm 12.11.2 workspaces (`server`, `web`, `e2e`) with a
  `catalog:`; `package-lock.json` and the `light-my-request` override are gone.
- Server: Fastify replaced by Hono 4.13.13 + `@hono/node-server` 2.1.4. Same behavior: `GET /api/health`, JSON 404
  under `/api`, static `web/dist` with SPA fallback. Route modules in `server/src/routes/`, provider folder
  `server/src/providers/`. Tests use `app.request()`.
- Web: Vite 8.3.4, Vue 3.5.43, vue-router 5.4.0, Pinia 4.0.3, Vitest 5.0.3, jsdom 30.1.2, TypeScript 6.0.3,
  vite-plugin-pwa 2.0.0. M3 color roles (`--md-sys-color-*`) from `@material/material-color-utilities`:
  default seed pre-generated into `web/src/theme/tokens.css` (no flash), custom seed generated at runtime by
  `web/src/theme` (lazy chunk), light + dark, forced mode via `<html data-theme>`. Material Symbols via
  `unplugin-icons`; the FAB is now an M3 primary-container FAB.
- Budgets: `pnpm size` (size-limit): initial JS 50.6 kB gz (limit 75), all JS 52.5 kB, CSS 3.4 kB.
- Docker: `node:24.21.0-alpine3.24`, `pnpm deploy --prod`, npm/corepack/yarn stripped from the runtime image.
  Image 172 MB (was 208 MB), about 64 MB gzipped. Idle memory about 21 MiB (docker stats).
  Compose: `mem_limit: 192m`, `NODE_OPTIONS=--max-old-space-size=96 --heapsnapshot-signal=SIGUSR2 --diagnostic-dir=/data`.
- Redeploy: `pnpm redeploy` or `scripts/deploy.sh` (renamed from `deploy`, because `pnpm deploy` is a pnpm command).

## Iteration 2 — full feature set (2026-10-12 ~06:00)
Live at http://cal.mordor.local (mock Google backend with demo data).
- Server: mock Google Calendar provider (JSON in DATA_DIR), full REST API, task lists stored as Google events,
  settings + categories, streak/plant/sunflowers rules, demo seed, inactive real Google adapter.
- Web: Material 3 shell (month picker from title, year/month/week/day, swipe), settings (theme presets incl. Mordor,
  custom color, light/dark, scenes, animations, calm mode, categories), event dialog, time-proportional timeline with
  live now marker, Now card ("35 min left"), transition warnings, drag and drop with spring physics, task list cards,
  expandable lists with rewarding ticks + list-complete celebration, open tasks tray with gentle carry-over,
  streak flame, plant, sunflower field + butterfly, Mordor scene with the Eye.
- Tests: 154 server + 203 web unit tests green; e2e suite (playwright-bdd) executes all spec features — being
  driven to green next.
