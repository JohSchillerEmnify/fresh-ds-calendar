# Project brief (shared by all agents)

Owner request (2026-10-12): a Google Calendar clone, used mainly on Android and iOS phones,
with embeddable, expandable task lists inside the calendar views. Spec-driven development.

## Product requirements
- Views: month overview, week view (Monday to Sunday), day view.
- Create, edit, delete events (title, start/end, all-day, description, location, color/calendar).
- Create, edit, delete **task lists** placed on a date (or date+time) in the calendar.
  - Collapsed in calendar views: shows the list title and the item titles (compact) plus a done count like `2/5`.
  - Tap/click: expands, items can be ticked/unticked, added, renamed, removed.
- Everything syncs with Google Calendar in the background (Google Tasks would be nice, Calendar is required).
- Real Google OAuth needs owner action (Google Cloud project, client ID, HTTPS domain; `.local` hosts
  are not allowed as OAuth redirect). So: **mock Google backend now**, real adapter behind the same interface,
  switchable by env var later.
- Mobile-first responsive UI, installable PWA (manifest + icons). Must also work on desktop.
- Deployed on the home server at `http://cal.mordor.local` via Traefik.

## Fixed technical decisions
- Monorepo at `/home/sauron/projects/calendar`:
  - `spec/` Gherkin `.feature` files (the single source of truth), `ACCEPTANCE.md`, `ARCHITECTURE.md`, `API.md`.
  - `server/` Node 22 + TypeScript + Fastify. Vitest for unit/integration tests (use `fastify.inject`).
  - `web/` Vue 3 (Composition API, `<script setup lang="ts">`) + Vite + TypeScript + Pinia + Vue Router + date-fns.
    Vitest + @vue/test-utils + jsdom for unit/component tests.
  - `e2e/` Playwright **1.48.2** (exact version) + `playwright-bdd` that executes the `spec/**/*.feature` files directly.
- Storage of task lists in Google: a Google Calendar event with
  `extendedProperties.private.kind = "tasklist"`; items stored in `extendedProperties.private.items` (JSON, chunked
  if > 1024 chars) and mirrored human-readably into the event description as `☐ item` / `☑ item` lines, so the
  list is readable in the official Google Calendar app too.
- Backend `CalendarProvider` interface with two implementations:
  - `MockGoogleProvider`: emulates Google Calendar API v3 semantics (ids, etag, updated, extendedProperties,
    syncToken-ish). Persists to a JSON file in `DATA_DIR` (default `./data`). Seeds a few demo events/task lists
    when empty (disable with `SEED=false`).
  - `GoogleProvider`: real implementation using `googleapis`, OAuth2 refresh token from env. Implemented and unit
    tested with mocked HTTP, but not active. Selected via `PROVIDER=mock|google`.
- Server serves the built web app as static files and the REST API under `/api`. Single container.
- Week starts Monday everywhere. Timezone Europe/Berlin default. UI language English. 24h time.
- Every UI element used by tests gets a stable `data-testid`.
- Toolchain: Node 24.21.0 LTS at `~/.local/opt/node-v24.21.0-linux-x64/bin` (prepend to PATH; system node is 18),
  with pnpm 12.11.2 installed globally in that Node (`packageManager` field pins it). No sudo. Playwright browsers:
  run e2e inside the docker image matching the `@playwright/test` version (see "Stack (final)").
  Immich is stopped for now, ~5 GB RAM free. Still avoid more than 2 heavy jobs (docker build / Playwright) at once.
- Deployment: `/home/sauron/docker-compose/calendar/docker-compose.yaml` builds from the monorepo, joins external
  network `proxy-network`, Traefik labels `Host(\`cal.mordor.local\`)`, `TZ=Europe/Berlin`, data volume `./data`.
  Follow the style of `/home/sauron/docker-compose/filebrowser/docker-compose.yaml`.

## Update: mobile first + installable (owner, 2026-10-12)
- Mobile first is the primary target (phones 375–430px portrait). Desktop must work but is secondary.
- Installable as an app on iOS and Android from the browser = PWA (manifest, icons incl. maskable + apple-touch-icon,
  service worker via vite-plugin-pwa, iOS meta tags, Android install button, iOS "Add to Home Screen" hint).
- Full install/offline needs HTTPS (secure context). http://cal.mordor.local is not secure, so HTTPS on Traefik
  is an owner action. Tests check PWA bits on localhost.

## Update: efficiency, leaks, Material 3 (owner, 2026-10-12)
- Resource efficiency is a priority (server RAM/CPU, image size, bundle size, phone battery). Stack may change per
  `docs/RESEARCH.md` "Decision" section (e.g. Bun as package manager); that section overrides fixed decisions above.
- No memory leaks: clean up timers/listeners on unmount; automated heap-growth tests (frontend + server soak).
- UI follows Material 3 (Expressive) design: M3 tokens/color roles, light+dark, top app bar, navigation bar, FAB,
  bottom sheets, chips, state layers. Still pleasant on iOS.

## Update: prettiness, settings, categories (owner, 2026-10-12)
- Not an exact Google clone; looks matter. Settings screen: theme seed color (presets + custom) generating M3
  dynamic palettes, theme mode System/Light/Dark, persisted server-side (/api/settings).
- Task lists have a user-defined category (name, color, icon) + optional tags; filter calendar by category/tag.
  Default categories: Shopping, To-do, Work, Home. Events can pick a color.

## Update: demo data (owner, 2026-10-12)
- Mock mode ships with rich demo data: ~25 realistic events spread around the current date (past 2 weeks to next
  4 weeks: work meetings, dentist, gym, birthdays, all-day and multi-day trips) and ~6 task lists across the default
  categories (shopping list, weekend chores, packing list...) with some items ticked. Dates relative to "now" at first
  seed. Only when PROVIDER=mock and SEED is not false; never written to real Google. Tests reset data, so seed is off
  under TEST_MODE. A "Reset demo data" action in Settings (mock mode only) is welcome.

## Update: ADHD focus, year view, month picker (owner, 2026-10-12)
- Target users include people with ADHD. Key: time blindness (time-proportional timeline, live "now" marker,
  "time remaining / starts in" displays) and out-of-sight-out-of-mind (open task lists always visible, overdue
  carried forward gently). Research + derived requirements: docs/ADHD-RESEARCH.md and spec.
- Year overview (brief, 12 mini months). Month/day picker dropdown from the top-bar title, like Google Calendar app,
  with own M3 spin.

## Update: reward + drag-and-drop physics (owner, 2026-10-12, high priority)
- Ticking off must feel very rewarding: springy check, strike-through, sparkle burst; full-list completion =
  bigger celebration. Micro-interactions throughout. Short, non-blocking, not overdone.
- Drag and drop events/task lists in views (long-press on mobile). Lift + wiggle on pick-up, spring/tilt while
  dragging, drop with settle wobble + bling, snap 15 min, persist, spring back on failure. Haptics where supported.
- prefers-reduced-motion + Settings "Animations: Full/Reduced/Off". Compositor-only animations, no heavy libs,
  particles cleaned up (no leaks).
- Daily check-in streak: small flame + count in top app bar, ~1 s crackle on first open of a day, synced
  server-side, quiet reset (no shaming).
- Plant companion (A/B prototype vs flame): watered by check-ins/creating/ticking (daily cap), grows in 5 stages,
  wilts gently without activity, never dies, perks up when watered. Settings: Flame / Plant / Both / None.
- Sunflower field variant: sunflowers earned by sustained care grow subtly in the top app bar background,
  sway gently, droop with neglect, never die. Selectable alongside flame/plant for A/B.
- Butterfly: on app open lands on a sunflower, flaps, flies away (~3-4 s, once per session, Full animations only).

## Stack (final, from docs/RESEARCH.md "Decision"; overrides the fixed decisions above)
- Node 24.21.0 LTS (Docker `node:24.21.0-alpine3.24`), pnpm 12.11.2 workspaces (`server`, `web`, `e2e`, `catalog:`),
  slim image via `pnpm deploy --prod`. Move to Node 26 LTS after 2026-10-28.
- Server: Hono 4.13 + `@hono/node-server` 2.1 (not Fastify); tests use `app.request()`. Google via
  `@googleapis/calendar` + `google-auth-library`, never the full `googleapis`.
- Web: Vue 3.5, vue-router 5, Pinia 4, date-fns 4, @vueuse/core 15, Vite 8, TypeScript ~6.0 + vue-tsc 3.3.
- UI: hand-built M3 Expressive components on `--md-sys-*` CSS tokens; colors from `@material/material-color-utilities`
  (default seed inlined in `web/src/theme/tokens.css`, user seed generated at runtime by a lazy chunk). Icons:
  `unplugin-icons` + Material Symbols (inline SVG). System fonts. No component library.
- PWA: vite-plugin-pwa 2. Unit tests: Vitest 5, @vue/test-utils 2.5, jsdom 30.
- E2E: `@playwright/test` 1.64.0 + playwright-bdd 9.2.1 in `mcr.microsoft.com/playwright:v1.64.0-noble` (versions must match).
- Gates: size-limit budgets (`pnpm size`), heap/DOM growth and soak tests. Container: `mem_limit: 192m`,
  `NODE_OPTIONS=--max-old-space-size=96 --heapsnapshot-signal=SIGUSR2`.
