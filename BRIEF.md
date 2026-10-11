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
- Toolchain: Node 22 is at `~/.local/opt/node-v22.11.0-linux-x64/bin` (prepend to PATH; system node is 18).
  No sudo. Playwright browsers: run e2e inside docker image `mcr.microsoft.com/playwright:v1.48.2-noble`
  (already pulled). Immich is stopped for now, ~5 GB RAM free. Still avoid more than 2 heavy jobs (docker build / Playwright) at once.
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
