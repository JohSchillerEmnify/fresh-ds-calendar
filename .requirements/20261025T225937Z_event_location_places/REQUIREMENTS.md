# Event location: place suggestions + small map (board item g6) — SPEC ONLY

Owner answers 2026-10-26: Q1 straight from the device (no proxy); Q2 map under the field in the event sheet and
the read-only sheet, location + map under the title on an opened event; Q3 Android → the phone's maps app, browser →
openstreetmap.org in a new tab; Q6 offline: maps seen before from the device, else the placeholder.
Rest (same day): Q4 only the typed text (3+ chars, short pause) + app language go to Photon, no Settings switch in
slice 1; Q5 Google gets "<name>, <address>", the place in private extended properties; Q7 app language, no nearby
preference in slice 1; Q8 "find on map" is a later slice, only on request; Q9 the field shows the place's NAME and the
ADDRESS as a small second line under it (no cut-off address).

Scenarios: `spec/features/events/event-location.feature` (all `@backlog`). Steps: `e2e/STEPS.md` →
"Places for an event's location". Mockups: canvas frames L1–L4 (scratchpad `canvas-location/project/`).

## As Is

- `location` is a free-text field (max 500) in the event form (`EventDialog.vue`, `TextField` `event-location`,
  between Reminders and Description). Enter in it moves to Description (events-crud scenario).
- There is no separate event details page: tapping an event opens the edit sheet (`AdaptiveSheet`, bottom sheet on
  phones). Read-only events show a details section (`event-readonly`) with the location as a plain line.
- Stored as Google `location` (string) only (`server/src/services/calendar.ts`, `GoogleProvider.ts`); no position.
- Shown on event chips when there is room (`event-chip-location`, `EventItem.vue`). Not in Android notifications or
  widgets.
- The CSP (server `securityHeaders.ts` and `deploy/vps/Caddyfile`) allows `connect-src 'self'` and `img-src 'self' data:
  blob:` only; `Permissions-Policy` has `geolocation=()`.
- Referrer: the public instance sends `Referrer-Policy: strict-origin-when-cross-origin` (Caddyfile); the server's own
  headers set none, so browsers use their default, which is the same policy. Either way a cross-origin request carries
  the page's origin (`https://cal.example.org/`) as Referer, which is what the OSM tile policy asks of web pages.
- Android app: a Capacitor shell whose WebView loads the server URL (`MainActivity`, `ServerConfig.BASE_URL`), so the
  page is an ordinary https web origin: the WebView sends the same origin Referer and its default WebView User-Agent
  (Chrome UA with `; wv`); nothing appends an app name today (`capacitor.config.ts` has no `appendUserAgent`).
- Device-first: ADR 0025 (accepted, branch `docs/adr-device-first`, not on main yet) — all data on the device, outbox
  for writes. Today (ADR 0023) the last known state holds whole `CalendarEvent`s, so the location text is offline already.

## To Be

Typing ≥3 characters in the location field shows up to 5 place suggestions (name + address) under the field, from
Photon (OpenStreetMap data) asked straight from the device; the map pictures also come straight from the OSM tile
server. Picking one puts the place's name in the field with its address as a
small second line under it, writes `"<name>, <address>"` to Google's `location` and stores the place (name, position)
with the event; a small non-interactive OSM map with a pin and the "© OpenStreetMap" credit shows
under the field (and in the read-only sheet); an opened event with a location shows location + map right under the
title. Tapping the map opens the place in the phone's maps app (Android app) or on openstreetmap.org in a new tab
(browser). Typed text that is not
picked stays exactly as typed and has no map. Offline: plain text field, no suggestions, the map from cached pictures
or a placeholder with pin + name.

## Requirements

1. **Suggestions.** After ≥3 characters and a pause (~300 ms), the field shows up to 5 suggestions (name, address) from
   the place search; a newer input cancels an older request; no suggestions for fewer characters.
2. **Credit.** The suggestion list carries "© OpenStreetMap" (ODbL attribution); the map carries "© OpenStreetMap"
   visibly on the map, never hidden (OSMF tile policy).
3. **Pick.** Picking puts the place's name in the field and its address as a small second line right under the field
   (`event-location-address`, label-medium, on-surface-variant, wraps instead of cutting off) and keeps the place
   (name, address, lat/lon) with the form. Saving writes `"<name>, <address>"` to Google's `location` (Q5).
4. **Store.** On save the position is written to the Google event in `extendedProperties.private` (proposed keys
   `placeName`, `placeLat`, `placeLon`) next to `location`; the API's `CalendarEvent` gains
   `place?: { name: string; lat: number; lon: number }`. The address line is `location` minus the leading
   `"<name>, "`; when `location` no longer starts with the name (changed in Google Calendar), the place is ignored and
   the event shows its location as plain text without a map. Reading an event returns it; the device store keeps it (ADR 0023/0025).
5. **Free text.** Text not picked is saved as typed, with no place. Editing the text of a picked place drops the
   place (map disappears; saved without position). Clearing the field clears both.
6a. **Placement.** New event: the location field stays where it is (after Reminders) and the map appears under it
   after a pick. Opened event with a location: the form order becomes Title, Location (+ map), then the rest, so the
   map is visible without scrolling on a 390×844 phone (owner, frame L3).
6. **Map.** With a place, the sheet shows a small static map (~full width × 140 px, zoom ~16) of OSM tiles centred on the
   pin; no panning/zooming, no map library (ADR 0020 spirit: built in house).
7. **Offline.** No connection: typing works exactly as today, no suggestions, no error. The map shows from tiles the
   device has already loaded (the service worker keeps the tiles it has shown in a runtime cache, honouring their
   cache headers, ≥ 7 days, capped in size; it never fetches tiles that were not shown — OSM forbids pre-fetching and
   offline bulk use); otherwise a placeholder with the pin and the place's name. Never a blocking state.
8. **Keyboard.** Enter with no highlighted suggestion closes the list and moves to Description (today's behaviour);
   Arrow down/up highlight, Enter picks the highlighted one; Escape closes the list (not the dialog).
9. **Open in maps** (owner). Tapping the map: browser → the OpenStreetMap page of the position in a new tab
   (`https://www.openstreetmap.org/?mlat=…&mlon=…#map=17/…/…`); Android app → a `geo:<lat>,<lon>?q=<lat>,<lon>(<name>)`
   intent (the phone's maps app, through a small native bridge or Capacitor's app launcher).
10. **Read-only events** with a place show the map in the read-only sheet.
11. **Find on map** (later slice, only on request — owner): an event whose location has no place (e.g. typed in Google Calendar)
    offers a "find on map" action that searches the text and lets the person pick.
12. **Direct calls** (owner). The web app calls Photon (`GET <placeSearchUrl>?q=&lang=&limit=5`, a CORS `fetch`) and
    loads tiles as `<img>` from `<mapTileUrl>` (`{z}/{x}/{y}.png`). Both URLs come from `/api/config` (new fields
    `placeSearchUrl`, `mapTileUrl`), which the device keeps like the rest of the config. Defaults:
    `https://photon.komoot.io/api` and `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; server env can override them
    (deployment config, never in scenarios). In TEST_MODE the server answers its own same-origin fakes instead:
    `GET /api/__test/photon` (Photon GeoJSON from the places set by `POST /api/__test/places`) and
    `GET /api/__test/tiles/:z/:x/:y.png` (a generated plain picture). The e2e fixture also aborts any request to a host
    other than the test server, so a test can never reach the real hosts.
12a. **Security headers.** The CSP gains exactly the two hosts: `connect-src 'self' https://photon.komoot.io` and
    `img-src 'self' data: blob: https://tile.openstreetmap.org`, in BOTH `server/src/lib/securityHeaders.ts` (built from
    the configured URLs' origins, so an override stays consistent) and `deploy/vps/Caddyfile` (the defaults);
    `server/test/security-headers.test.ts` keeps the two in step. The Referrer-Policy stays
    `strict-origin-when-cross-origin` (never `no-referrer`/`same-origin`, which OSM forbids for web traffic); the
    server's own headers add the same value so sauron matches the public instance. Images carry no
    `referrerpolicy="no-referrer"`.
12b. **Android app identity.** The WebView already sends a Referer (the page origin) and a browser User-Agent, which the
    OSM policy accepts for browser traffic ("Modern browsers, with default settings, already satisfy these technical
    requirements"). To be identifiable as an app as well, the shell appends ` FreshDKalender/<version>` to the WebView
    User-Agent (Capacitor `android.appendUserAgent` / the `CapConfig.Builder` in `MainActivity`), without impersonating
    anything. [assumption, see A6]
13. **Privacy.** A search sends only the typed text, the app language and the limit; never the person, the event title,
    times or the device position. No geolocation permission (stays `geolocation=()`). Because the calls are direct,
    Photon and the OSM tile server see the device's IP address and the app's origin (Referer) — accepted with Q1;
    no settings switch in slice 1 (owner, Q4). No nearby preference (no `lat`/`lon` sent) in slice 1 (Q7).

## Acceptance Criteria

- R1: scenarios "Typing a location suggests matching places", "Fewer than three characters suggest nothing"; unit: debounce
  and cancel of stale requests.
- R2: "the suggestions credit OpenStreetMap", "the map credits OpenStreetMap" (credit inside the map box, not covered).
- R3: "Picking a place puts its name in the field, its address under it, and shows a small map"; the address-line and
  Google `location` checks in "The picked place is saved …".
- R4: "The picked place is saved with the event and its map shows again"; server unit: mapping place ↔ extended
  properties both ways; validation of lat (−90..90) / lon (−180..180).
- R5: "A location typed without picking …", "Changing the text of a picked place drops its map".
- R6: map scenarios + `@visual` picture of the sheet with the map (phone size), looked at.
- R7: the three `@offline` scenarios.
- R8: the three keyboard scenarios (incl. the existing events-crud Enter scenario still green).
- R9: "Tapping the map opens the place on OpenStreetMap…"; Android: app unit test for the `geo:` intent.
- R10: "A read-only event with a picked place shows the map".
- R11: "A location from Google without a place offers to find it on the map".
- R6a: "An opened event shows its location and map right under the title".
- R12: web unit: the search client builds `?q=&lang=&limit=5` from the configured URL and nothing else; server unit:
  `/api/config` returns the default URLs, the env overrides, and the same-origin fakes in TEST_MODE; the fakes answer
  Photon's shape / a PNG. e2e: every location scenario passes with outside requests aborted.
- R12a: server unit: CSP contains exactly the two origins (and the overrides' origins); the Caddyfile test fails when
  its CSP or Referrer-Policy differs; Referrer-Policy present on the server's own answers.
- R12b: Android unit/instrumented test: the WebView User-Agent ends with the app token.
- R13: web unit: a failing or slow Photon request leaves the field usable, shows no error, and a newer input cancels it.

## Testing Plan

- Server (Vitest): `/api/config` URLs (defaults, env override, TEST_MODE fakes); the TEST_MODE fakes; CSP and
  Referrer-Policy; place ↔ extendedProperties.
- Web (Vitest + test-utils): Photon client (query building, GeoJSON → `{ name, address, lat, lon }`), location field
  suggestion component (debounce, min length, stale-request cancel, keyboard, Escape, Enter), pick → form state, edit
  after pick drops place, form order on an opened event; static map component (tile maths: lat/lon → tile
  x/y and pixel offset; attribution present; placeholder when tiles fail).
- e2e (targeted, `--grep` the scenario names) after `@backlog` is removed per slice; `@visual` pictures looked at.

## Implementation Plan (after the owner's answers)

Slice 1 = PR 1 (suggestions + pick + map + placement + offline):
1. Server: `place` in `CalendarEvent` + extended properties mapping + validation → unit tests.
2. Server: `placeSearchUrl` / `mapTileUrl` in `/api/config` (defaults, env override) + TEST_MODE same-origin fakes
   (`/api/__test/places`, `/api/__test/photon`, `/api/__test/tiles`) → unit tests.
3. Server + Caddyfile: CSP gains the two origins, Referrer-Policy on the server's answers; security-headers test in step
   → unit tests.
4. e2e fixture: abort requests to any other host (guard) → run one existing scenario to prove nothing breaks.
5. Web: Photon client + suggestion list on the location field → unit/component tests; e2e "Typing…", "Fewer…",
   "Picking…", Enter/Escape.
6. Web: static map (tiles as `<img>`) + credit + placeholder; form order on an opened event → component tests; e2e
   "saved … shows again", free text, change drops map, "opened event … under the title".
7. Service worker: runtime cache for shown tiles (cache headers honoured, size cap) → e2e the three `@offline` scenarios.
   **PR boundary (slice 1).**
Slice 2 = PR 2: tap map → openstreetmap.org tab / Android `geo:` intent; Android WebView User-Agent token; read-only map;
arrow-key pick (desktop).
Slice 3 = PR 3 (only if the owner wants it, Q8): "find on map" for locations without a place; bias (Q7).

## Assumptions (to confirm)

- A1: ~~Proxy through our server~~ → owner chose direct calls from the device (2026-10-26).
- A2: Map in the event sheet under the field and in the read-only sheet; location + map under the title on an opened
  event (owner, 2026-10-26).
- A3: Location text written back = `"<name>, <address>"` (owner, Q5).
- A4: Static tile map, no Leaflet/MapLibre dependency.
- A5: Suggestions in the app's UI language (en/de), no location bias in slice 1 (owner, Q7).
- A8: A location changed in Google Calendar so it no longer starts with the stored place name drops the place (shown as
  plain text, no map) — inferred from Q5/Q9 so a stale map never shows next to a changed location.
- A6: The Android WebView's own Referer + browser UA is acceptable to OSM as browser traffic (the policy says nothing
  about WebViews); appending an app token to the UA is extra identification, not a requirement. If the owner prefers,
  it can be dropped.
- A7: The two hosts are the public instances named by the owner; an operator override (env) changes the CSP origins
  with it.

## Policy findings (checked 2026-10-25)

- Photon public API (https://photon.komoot.io/): "You can use the API for your project, but please be fair - extensive
  usage will be throttled"; no availability guarantee; no key. Params `q`, `lang`, `limit`, `lat`/`lon` (+`zoom`,
  `location_bias_scale`), `bbox`, `layer` (https://github.com/komoot/photon/blob/master/docs/api-v1.md). Data is OSM
  (ODbL) → credit OpenStreetMap.
- OSM tile policy (https://operations.osmfoundation.org/policies/tiles/): "From web pages, ensure a valid HTTP Referer
  header is sent"; "Do not set a restrictive Referrer-Policy that prevents the Referer header being sent"; "Browsers will
  use the browser's default User-Agent"; "Modern browsers, with default settings, already satisfy these technical
  requirements"; "Native apps usually do not have a referer, this is ok"; WebViews are not mentioned. Attribution clearly on the map, never hidden;
  apps must send a distinct, stable User-Agent (generic library UAs are blocked); browsers must send a Referer (no
  restrictive Referrer-Policy); honour cache headers, else cache ≥ 7 days; HTTPS; **offline use and pre-fetching tiles
  not being viewed are not permitted**; a caching proxy is "generally not recommended" but allowed with a clear
  contactable User-Agent and honoured caching.
- Alternative without these limits: OpenFreeMap (https://openfreemap.org/) — no key, no registration, no view limits,
  offline download allowed up to 3,000 tiles / 50 MB; vector tiles (needs a renderer such as MapLibre, a big dependency).
- Checked live 2026-10-26: Photon answers `Access-Control-Allow-Origin: *` (`Cache-Control: max-age=3600`), so a direct
  `fetch` from the page works; the OSM tile server answers `access-control-allow-origin: *` and
  `cache-control: max-age≈3 h, stale-while-revalidate=604800, stale-if-error=604800`. Consequence for R7: the device
  cache may show a seen tile offline for up to 7 days after it went stale (`stale-if-error`); a map seen longer ago
  than that shows the placeholder. Keeping tiles longer than the headers allow would break the "honour cache headers"
  rule — decide with the owner only if this proves too short.
