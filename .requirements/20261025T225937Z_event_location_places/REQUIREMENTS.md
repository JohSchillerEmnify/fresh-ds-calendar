# Event location: place suggestions + small map (board item g6) — SPEC ONLY, awaiting the owner

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
- Device-first: ADR 0025 (accepted, branch `docs/adr-device-first`, not on main yet) — all data on the device, outbox
  for writes. Today (ADR 0023) the last known state holds whole `CalendarEvent`s, so the location text is offline already.

## To Be

Typing ≥3 characters in the location field shows up to 5 place suggestions (name + address) under the field, from
Photon (OpenStreetMap data) asked through our server. Picking one fills the field with `"<name>, <address>"` and stores
the place's position with the event; a small non-interactive OSM map with a pin and the "© OpenStreetMap" credit shows
under the field (and in the read-only sheet). Tapping the map opens the place in a maps app. Typed text that is not
picked stays exactly as typed and has no map. Offline: plain text field, no suggestions, the map from cached pictures
or a placeholder with pin + name.

## Requirements

1. **Suggestions.** After ≥3 characters and a pause (~300 ms), the field shows up to 5 suggestions (name, address) from
   the place search; a newer input cancels an older request; no suggestions for fewer characters.
2. **Credit.** The suggestion list carries "© OpenStreetMap" (ODbL attribution); the map carries "© OpenStreetMap"
   visibly on the map, never hidden (OSMF tile policy).
3. **Pick.** Picking fills the field with `"<name>, <address>"` and keeps the position (lat/lon) with the form.
4. **Store.** On save the position is written to the Google event in `extendedProperties.private` (proposed keys
   `placeLat`, `placeLon`; plus the OSM id if useful) next to `location`; the API's `CalendarEvent` gains
   `place?: { lat: number; lon: number }`. Reading an event returns it; the device store keeps it (ADR 0023/0025).
5. **Free text.** Text not picked is saved as typed, with no place. Editing the text of a picked place drops the
   place (map disappears; saved without position). Clearing the field clears both.
6. **Map.** With a place, the sheet shows a small static map (~full width × 140 px, zoom ~16) of OSM tiles centred on the
   pin; no panning/zooming, no map library (ADR 0020 spirit: built in house).
7. **Offline.** No connection: typing works exactly as today, no suggestions, no error. The map shows from tiles the
   device has already loaded; otherwise a placeholder with the pin and the place's name. Never a blocking state.
8. **Keyboard.** Enter with no highlighted suggestion closes the list and moves to Description (today's behaviour);
   Arrow down/up highlight, Enter picks the highlighted one; Escape closes the list (not the dialog).
9. **Open in maps.** Tapping the map: browser → the OpenStreetMap page of the position in a new tab; Android app →
   a `geo:` intent (the phone's maps app). [pending owner answer]
10. **Read-only events** with a place show the map in the read-only sheet.
11. **Find on map** (later slice, pending owner): an event whose location has no place (e.g. typed in Google Calendar)
    offers a "find on map" action that searches the text and lets the person pick.
12. **Server proxy** (proposed): `GET /api/places?q=&lang=` (signed-in only, per-person rate limit, short cache) asks
    Photon with an identifying `User-Agent` and returns `{ name, address, lat, lon }[]`; `GET /api/map/tile/:z/:x/:y.png`
    fetches OSM tiles with an identifying `User-Agent`, honours cache headers (≥ 7 days) and caches them on disk.
    TEST_MODE: fake places (`POST /api/__test/places`) and generated tiles; no outside calls in tests.
13. **Privacy.** Only the typed text and the app language leave the server; never the person, the event title, times or
    the device position. No geolocation permission (stays `geolocation=()`).

## Acceptance Criteria

- R1: scenarios "Typing a location suggests matching places", "Fewer than three characters suggest nothing"; unit: debounce
  and cancel of stale requests.
- R2: "the suggestions credit OpenStreetMap", "the map credits OpenStreetMap" (credit inside the map box, not covered).
- R3: "Picking a place fills the location and shows a small map".
- R4: "The picked place is saved with the event and its map shows again"; server unit: mapping place ↔ extended
  properties both ways; validation of lat (−90..90) / lon (−180..180).
- R5: "A location typed without picking …", "Changing the text of a picked place drops its map".
- R6: map scenarios + `@visual` picture of the sheet with the map (phone size), looked at.
- R7: the three `@offline` scenarios.
- R8: the three keyboard scenarios (incl. the existing events-crud Enter scenario still green).
- R9: "Tapping the map opens the place on OpenStreetMap…"; Android: app unit test for the `geo:` intent.
- R10: "A read-only event with a picked place shows the map".
- R11: "A location from Google without a place offers to find it on the map".
- R12/R13: server unit tests (`app.request`): User-Agent set, only `q`/`lang`/`limit` forwarded, unauthenticated → 401,
  rate limit → 429, upstream error → empty list `503` that the field ignores quietly; tile cache honours headers.

## Testing Plan

- Server (Vitest): places route (fake upstream via injected fetch), query building, response shaping, rate limit,
  error handling; tile route caching (Cache-Control/ETag/7-day minimum, conditional requests); place ↔ extendedProperties.
- Web (Vitest + test-utils): location field suggestion component (debounce, min length, stale-request cancel, keyboard,
  Escape, Enter), pick → form state, edit after pick drops place; static map component (tile maths: lat/lon → tile
  x/y and pixel offset; attribution present; placeholder when tiles fail).
- e2e (targeted, `--grep` the scenario names) after `@backlog` is removed per slice; `@visual` pictures looked at.

## Implementation Plan (after the owner's answers)

Slice 1 = PR 1 (suggestions + pick + map + offline-plain-text):
1. Server: `place` in `CalendarEvent` + extended properties mapping + validation → unit tests.
2. Server: `/api/places` proxy + TEST_MODE fake + `/api/__test/places` → unit tests.
3. Server: `/api/map/tile` proxy with disk cache + TEST_MODE generated tiles → unit tests.
4. Web: suggestion list on the location field → component tests; e2e "Typing…", "Fewer…", "Picking…", Enter/Escape.
5. Web: static map + credit + placeholder → component tests; e2e "saved … shows again", free text, change drops map.
6. Web: offline (no suggestions, no error; map from cache / placeholder) → the three `@offline` scenarios.
   **PR boundary (slice 1).**
Slice 2 = PR 2: tap map → OSM page / Android `geo:` intent; read-only map; arrow-key pick (desktop).
Slice 3 = PR 3 (if the owner wants it): "find on map" for locations without a place; bias near the last picked place.

## Assumptions (to confirm)

- A1: Proxy through our server (CSP stays `'self'`, privacy, identifying User-Agent, deterministic tests) — open Q1.
- A2: The map sits in the event sheet under the location field (no details page exists) — open Q2.
- A3: Location text written back = `"<name>, <address>"` (readable in Google Calendar, like its own place picks) — Q5.
- A4: Static tile map, no Leaflet/MapLibre dependency.
- A5: Suggestions in the app's UI language (en/de), no location bias in slice 1 — Q7.

## Policy findings (checked 2026-10-25)

- Photon public API (https://photon.komoot.io/): "You can use the API for your project, but please be fair - extensive
  usage will be throttled"; no availability guarantee; no key. Params `q`, `lang`, `limit`, `lat`/`lon` (+`zoom`,
  `location_bias_scale`), `bbox`, `layer` (https://github.com/komoot/photon/blob/master/docs/api-v1.md). Data is OSM
  (ODbL) → credit OpenStreetMap.
- OSM tile policy (https://operations.osmfoundation.org/policies/tiles/): attribution clearly on the map, never hidden;
  apps must send a distinct, stable User-Agent (generic library UAs are blocked); browsers must send a Referer (no
  restrictive Referrer-Policy); honour cache headers, else cache ≥ 7 days; HTTPS; **offline use and pre-fetching tiles
  not being viewed are not permitted**; a caching proxy is "generally not recommended" but allowed with a clear
  contactable User-Agent and honoured caching.
- Alternative without these limits: OpenFreeMap (https://openfreemap.org/) — no key, no registration, no view limits,
  offline download allowed up to 3,000 tiles / 50 MB; vector tiles (needs a renderer such as MapLibre, a big dependency).
