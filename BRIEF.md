# Project brief (shared by all agents)

> The original brief of 2026-10-12. The app has grown since; where a line below no longer holds, the list here wins,
> and `spec/`, `docs/adrs/` and `docs/DEVELOPER-GUIDE.md` are the current source.
> - Hosting: the app runs on a VPS under a public domain with HTTPS and a real Google sign-in, deployed by GitHub CD
>   (ADR 0036, `docs/DEPLOYMENT.md`); the home-server and `.local` lines below are history.
> - Languages: German and English (plus two fun languages), ADR 0021; settings are per person (ADR 0035).
> - Task lists live in a hidden per-person Google calendar (ADR 0006); shared lists and templates live on the server
>   (ADR 0011, 0024). Native Android app and widgets: ADR 0012, 0022; iPhone widget: ADR 0044.
> - `spec/ACCEPTANCE.md` is gone; behaviour is in `spec/features/`, the architecture in `docs/architecture/`.
> - Versions are in `package.json`, `pnpm-workspace.yaml` and the `Dockerfile`, not here.

Owner request (2026-10-12): a Google Calendar clone, used mainly on Android and iOS phones,
with embeddable, expandable task lists inside the calendar views. Spec-driven development.

## Product requirements
- Views: month overview, week view (Monday to Sunday), day view.
- Create, edit, delete events (title, start/end, all-day, description, location, color/calendar).
- Create, edit, delete **task lists** placed on a date (or date+time) in the calendar.
  - Collapsed in calendar views: shows the list title and the item titles (compact) plus a done count like `2/5`.
  - Tap/click: expands, items can be ticked/unticked, added, renamed, removed.
- Everything syncs with Google Calendar in the background (Google Tasks would be nice, Calendar is required).
- Real Google OAuth needs a Google Cloud project, a client ID and an HTTPS domain (`.local` hosts are not allowed as
  redirect). So the first build used a **mock Google backend**; the real adapter sits behind the same interface and is
  chosen by `PROVIDER=mock|google` (the mock is still used for development and tests).
- Mobile-first responsive UI, installable PWA (manifest + icons). Must also work on desktop.
- Deployed behind a reverse proxy (originally a home server, now a VPS; see the note above).

## Fixed technical decisions
- Monorepo with `shared/` (code used by web and server) next to the folders below:
  - `spec/` Gherkin `.feature` files (the single source of truth), `ARCHITECTURE.md`, `API.md`.
  - `server/` Node 22 + TypeScript + Fastify. Vitest for unit/integration tests (use `fastify.inject`).
  - `web/` Vue 3 (Composition API, `<script setup lang="ts">`) + Vite + TypeScript + Pinia + Vue Router + date-fns.
    Vitest + @vue/test-utils + jsdom for unit/component tests.
  - `e2e/` Playwright **1.48.2** (exact version) + `playwright-bdd` that executes the `spec/**/*.feature` files directly.
- Storage of task lists in Google: a Google Calendar event with
  `extendedProperties.private.kind = "tasklist"`; items stored in `extendedProperties.private.items` (JSON, chunked
  if > 1024 chars) and mirrored human-readably into the event description as `☐ item` / `☑ item` lines, so the
  list is readable in the official Google Calendar app too.
- Backend `CalendarProvider` interface with two implementations (original design; the storage detail above was refined by ADR 0006):
  - `MockGoogleProvider`: emulates Google Calendar API v3 semantics (ids, etag, updated, extendedProperties,
    syncToken-ish). Persists to a JSON file in `DATA_DIR` (default `./data`). Seeds a few demo events/task lists
    when empty (disable with `SEED=false`).
  - `GoogleProvider`: real implementation on `@googleapis/calendar`, with each person's own sign-in (ADR 0008).
    Selected via `PROVIDER=mock|google`.
- Server serves the built web app as static files and the REST API under `/api`. Single container.
- Week starts Monday everywhere. Timezone Europe/Berlin default. 24h time. (UI language: see the note above.)
- Every UI element used by tests gets a stable `data-testid`.
- Toolchain: Node and pnpm versions are pinned by `.nvmrc`, `engines` and the `packageManager` field; Playwright runs in
  the docker image matching the `@playwright/test` version (see `e2e/README.md`). Avoid more than 2 heavy jobs
  (docker build / Playwright) at once.
- Deployment: `deploy/docker-compose.yaml` and `deploy/vps/compose.yml`; `TZ=Europe/Berlin`, one data volume.

## Update: mobile first + installable (owner, 2026-10-12)
- Mobile first is the primary target (phones 375–430px portrait). Desktop must work but is secondary.
- Installable as an app on iOS and Android from the browser = PWA (manifest, icons incl. maskable + apple-touch-icon,
  service worker via vite-plugin-pwa, iOS meta tags, Android install button, iOS "Add to Home Screen" hint).
- Full install/offline needs HTTPS (secure context); the public deployment has it. Tests check PWA bits on localhost.

## Update: efficiency, leaks, Material 3 (owner, 2026-10-12)
- Resource efficiency is a priority (server RAM/CPU, image size, bundle size, phone battery). Stack may change per
  `docs/RESEARCH.md` "Decision" section (e.g. Bun as package manager); that section overrides fixed decisions above.
- No memory leaks: clean up timers/listeners on unmount; automated heap-growth tests (frontend + server soak).
- UI follows Material 3 (Expressive) design: M3 tokens/color roles, light+dark, top app bar, navigation bar, FAB,
  bottom sheets, chips, state layers. Still pleasant on iOS.

## Update: prettiness, settings, categories (owner, 2026-10-12)
- Not an exact Google clone; looks matter. Settings screen: theme seed color (presets + custom) generating M3
  dynamic palettes, theme mode System/Light/Dark, persisted server-side (`/api/settings`, per person since ADR 0035).
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
- Node 24 LTS (Docker `node:24.x-alpine`), pnpm workspaces (`server`, `web`, `e2e`, `shared`, `catalog:`),
  slim image via `pnpm deploy --prod`.
- Server: Hono + `@hono/node-server` (not Fastify); tests use `app.request()`. Google via
  `@googleapis/calendar`, `@googleapis/people` + `google-auth-library`, never the full `googleapis`.
- Web: Vue 3.5, vue-router, Pinia, vue-i18n, date-fns, @vueuse/core, Vite, TypeScript + vue-tsc.
- UI: hand-built M3 Expressive components on `--md-sys-*` CSS tokens; colors from `@material/material-color-utilities`
  (default seed inlined in `web/src/theme/tokens.css`, user seed generated at runtime by a lazy chunk). Icons:
  `unplugin-icons` + Material Symbols (inline SVG). System fonts. No component library.
- PWA: vite-plugin-pwa. Unit tests: Vitest, @vue/test-utils, jsdom.
- E2E: `@playwright/test` + playwright-bdd in the matching `mcr.microsoft.com/playwright` image (versions must match).
- Gates: `pnpm verify` (incl. `pnpm quality` ratchet), size-limit budgets (`pnpm size`), heap/DOM growth and soak tests.
  Container: see `deploy/docker-compose.yaml` (`mem_limit`, `NODE_OPTIONS`).

## Update: Mordor theme (owner, 2026-10-12)
- Secondary theme "Mordor": ember-on-black palette preset + top-bar scene with original SVG Barad-dûr and
  flickering Eye of Sauron (eye opens on app open). The scene is now one of many (`spec/API.md` "Scenes"), stored in
  the person's theme; preset id `mordor` (seed #c43e00).
