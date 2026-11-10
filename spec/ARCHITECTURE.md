# Architecture

## Migrated

Every section of the former prose was ported to the novibe layout and removed here; implementation detail was dropped
(the code is the source):

- §1–4 (overview, server components, task lists in Google, sync, Google rate limits): LikeC4 model
  (`docs/architecture/`: views `index`, `server`, `web`, `prod`, `loadRange`, `rateLimitedRead`, `firstTaskList`),
  ADRs 0005–0007, the encoding contract in `API.md` "Storage in Google", and `spec/features/google/sync.feature`.
- §6 PWA, §7 testing, sign-in, all calendars, diagnostics, §8–10: model (`signIn`, `server`, `web`), ADRs 0008–0009,
  `app/pwa.feature`, `google/signin.feature`, `events/calendars.feature`; env in `docs/DEPLOYMENT.md`, tooling in
  `CONTRIBUTING.md`, test setup in `e2e/README.md`.
- Backups, Shared lists: model (`backupAfterChange`, `restoreAtSignIn`, `shareList`), ADRs 0010–0011, the bundle
  contract in `API.md` "Backups", `google/drive-backup.feature`, `task-lists/shared-lists.feature`.
- §5 Web app core (router, focus date, time grid, zoom, i18n, mobile-first UX, Material 3, settings, categories and
  filters, §5a resource budgets): model (`web`, `switchView`, `settingFailsToSave`), ADRs 0020–0021, `views/navigation`,
  `views/mobile`, `views/timeline`, `events/events-display`, `events/events-crud`, `app/settings`, `app/language`,
  `app/performance`, `themes/theme`, `task-lists/categories` features.
- §5b–5c and the owner sections after them (ADHD features, open tasks tray, motion and rewards, drag and drop, back
  closes overlays, delete with undo, snackbars, bedtime, new version notice, version numbers, release notes, view
  switcher position, left-handed mode): model (`web`, `deleteWithUndo`, `bedtimeNight`, `appUpdate`), versioning and
  release notes in `docs/DEPLOYMENT.md`, `API.md` "`GET /api/release-notes`", `motivation/*`, `events/dnd`,
  `task-lists/open-tasks`, `app/pwa`, `app/release-notes`, `views/nav-position`, `app/left-handed` features.
- Labs (clock, approaching track, zoom month, horizontal view, timeline, strip): model (`web`, `chooseLabsViews`),
  `labs/*` features, `API.md` "Prefs".
- Themes, theme menu, fine-tuning, Seasons & holidays, scenes and the support cat, rounded fields, theme engine and AI
  themes: model (`web`, `server`, `chooseThemeSeasonal`, `importOwnTheme`), ADR 0016, `API.md` "Theme preference" and
  "Imported themes", `themes/*` and `motivation/support-cat` features.
- Task lists UI (undated lists, Tasks view, Archive, Canvas, categories switch, Tasks filter, untitled lists, tapping and
  the grown card, the one "new" dialog): model (`web`, `server`, `tapTaskList`, `moveNote`, `finishList`), ADRs
  0017–0019, `task-lists/*` features.
- Android app and widget, own-events editing, birthdays, reminders and notifications, security hardening: model
  (`androidApp`, `widget`, `startApp`, `signInFromApp`, `widgetWeekRefresh`, `remindersRing`, `prod`), ADRs
  0012–0015 and 0022, `API.md` "Web Push", "Birthdays", "Sign-in", "`GET /app.apk`", `docs/DEPLOYMENT.md` "Android app" and
  "Public server (VPS)", `events/events-readonly`, `events/birthdays`, `events/reminders`, `google/signin`, `app/pwa`,
  `app/android-app`, `app/phone-widget` features.

The architecture now lives in docs/architecture (LikeC4) and docs/adrs; behaviour in spec/features.

## Places for an event's location (direct third-party calls)

Feature `events/event-location`, requirements `.requirements/20261025T225937Z_event_location_places/`.

- **First direct third-party calls from the device.** The web app asks the place search (Photon,
  `https://photon.komoot.io/api`) with a CORS `fetch` and loads the map pictures (OpenStreetMap tiles,
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png`) as `<img crossorigin>` straight from the device, not through the
  server (owner, 2026-10-26). `/api/config` hands out both addresses (`placeSearchUrl`, `mapTileUrl`; env
  `PLACE_SEARCH_URL` / `MAP_TILE_URL`, plain https hosts only); in TEST_MODE they point at the server's own stand-ins,
  and the e2e Chromium resolves no other host. A search sends only the typed text, the app language and the limit.
- **Storage.** The picked place lives with the event in Google's private extended properties (`placeName`, `placeLat`,
  `placeLon`) next to `location = "<name>, <address>"`; it counts only while the location is the name or starts with
  `"<name>, "`. It is part of `CalendarEvent`, so the device's last known state keeps it (device-first).
- **Service worker tile cache** (`web/src/pwa/tileCache.ts`). Map pictures go network first; the ones a map has shown
  are kept (best effort, at most 200, never no-store or error answers, never prefetched) and answer offline for up to
  7 days, the tile server's `stale-if-error`. A picture it cannot get leaves a placeholder with the pin and the name.
- **CSP.** `img-src` adds the tile host and `connect-src` adds Photon **and the tile host**: the service worker fetches
  the pictures it keeps, and a worker's `fetch` falls under its own policy's `connect-src` (the server sends the CSP on
  `sw.js` too). Built from the configured addresses in `server/src/lib/securityHeaders.ts`; the Caddyfile copy holds the
  defaults and `server/test/security-headers.test.ts` keeps both equal. `Referrer-Policy: strict-origin-when-cross-origin`
  (never stricter: the OSM tile policy wants the page origin as Referer).
- **Map picker** (issue #58, ADR 0041). "Pick on map" shows a Leaflet map (lazy) on the same tiles and asks Photon's `/reverse` (derived
  from `placeSearchUrl`, so no new host) for the pin's address; `Permissions-Policy` allows `geolocation=(self)` for "Use my location".
