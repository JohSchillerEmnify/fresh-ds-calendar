# @calendar/server

Hono + `@hono/node-server` backend for the calendar. Implements `spec/API.md` (REST under `/api`), a mock Google
Calendar v3 backend (default) and a real `GoogleProvider` (`@googleapis/calendar` + `google-auth-library`, lazily
imported, only when `PROVIDER=google`). Validation: valibot (lighter than zod).

```
pnpm -F @calendar/server test    # vitest, uses app.request(), runs with --expose-gc
pnpm -F @calendar/server build   # tsc -> dist/
pnpm -F @calendar/server dev     # tsx watch
```

Env: the full list is in `docs/DEPLOYMENT.md`. `ALLOWED_ORIGINS` defaults to `PUBLIC_URL`; CORS is only
sent for listed origins (same-origin needs none).

Layout: `src/app.ts` (buildApp), `context.ts` (wiring), `api/` (route files by topic, test routes, shared `types.ts`),
`auth/` (sign-in, sessions, people), `plugins/` (optional integrations, ADR 0004), `services/` (CalendarService, the task
list codec `taskCodec.ts`, per-person stores, push, backup, widget keys, ...), `providers/` (interface, `mock/`,
`google/`), `lib/` (clock, time, colors, ids, validation, errors), `seed.ts`. Env variables: `src/config.ts`.
One `Clock` (`lib/clock.ts`) is used everywhere; `now()` honours the test clock, `real()` is used for `updated`/etags.

## Demo data

With `PROVIDER=mock`, `SEED` not `false`, `TEST_MODE` off and an empty store, the server seeds about 25 events
(two weeks back to four weeks ahead), 7 task lists (all four default categories, some ticked, some open and dated in the
past so they are carried over), a 6 day streak ending yesterday, a plant with 190 growth points (4 sunflowers).
**Demo reset**: `POST /api/demo/reset` (mock mode only, 404 otherwise) wipes the mock calendar and motivation state and
re-seeds relative to the current app clock. Settings are kept. A "Reset demo data" button in Settings can call it.

## Deviations and additions (relative to spec/API.md and the spec features)

Contract-relevant for web/e2e:
1. The scene is the theme's `scene` attribute (`/api/prefs/theme`), not a setting; `PATCH /api/settings` rejects `scene`.
   The old `Settings.scene` is migrated once per person into the theme (feature theme-scenes). Theme presets (including `mordor` #c43e00) live in the web app; the server only stores `seedColor`.
2. `POST /api/demo/reset` (new, see above).
3. Unknown JSON keys give `400 VALIDATION_ERROR` with message `Unknown field` and `details[].field`. A missing required
   key gives a message such as `Title is required` / `Name is required` / `Start is required`.
4. `GET /api/tasklists/open` without `today` defaults to the app clock's today. `days` may be `0..90`.
5. `POST /api/__test/reset` returns `items` for the whole calendar (all dates). Fixture ids may be any string.
   Fixture creation does not award plant points (motivation is reset after the fixture). Under reset with `seed:true`
   the demo data is created first, then the fixture.
6. `GET /api/calendars` always hits the provider (so an outage shows as 503); the calendar list is otherwise cached 30 s
   inside the server. `/api/health` caches the ping for 10 s (bypassed while an outage is simulated).
7. `X-Motivation-Changed: 1` is sent on any non-GET response during which points were awarded (event create, task list
   create, first tick of an item that day, check-in). A repeated tick of the same item the same day does not send it.
8. Streak: `GET /api/motivation` returns the stored `current` until the next check-in (a gap resets to 1 at the next
   `POST /api/streak/checkin`, not on read). `/api/__test/motivation` `checkIns` recomputes `current` as the run ending
   at the last date and `best` as the longest run.
9. A capped action (daily cap 30 reached) still waters the plant (`lastWatered = today`) and sends the header.
10. Task list `recurrence` is stored as `private.recurrence` and as a Google `RRULE` (daily/weekly/monthly). The mock
    expands instances (id `<masterId>_<YYYYMMDD>`); ticking an instance materialises an exception event. Repeating lists
    are described in `spec/API.md` (series, "this and following").
11. Stale `categoryId`s (deleted category) are kept in Google and reported as `null`; item operations and unrelated
    edits keep working. Only setting a new unknown id is a 400.
12. Event `PATCH` with `If-Match`: the etag is compared in the server first (412 `This event was changed elsewhere...`).
    Etags are opaque quoted strings; clients should send them back verbatim.

Internal (provider layer):
- `CalendarProvider.patchEvent` takes a widened `GoogleEventPatch` (values may be `null` to delete a field or extended
  property). `GoogleEvent` has optional `recurrence` and `recurringEventId`.
- `GoogleProvider` exposes the primary calendar under the id `primary` (the alias Google accepts), other configured ids
  as is. 401/403/429/5xx/network/invalid_grant map to `ProviderUnavailableError`, 404/410 to `NotFoundError`, 412 to
  `PreconditionFailedError`, other 4xx to `ProviderError`. With no stored token every call fails with
  `PROVIDER_UNAVAILABLE` ("open /api/auth/google/start"); missing client id/secret fails fast at startup.
- When PATCHing a Google event between all-day and timed, the other of `date`/`dateTime` is sent as `null`.
- Task lists live in each person's own calendar "Calendar app: tasks" (`services/tasksCalendar.ts`): stored id in
  `prefs.json` (`tasksCalendarId`), else found by name, else created (`insertCalendar`) and hidden in Google's list
  (`setCalendarHidden`). `listCalendars` includes hidden entries (`showHidden`); hidden calendars and the tasks
  calendar are not event calendars. The app has no switch for showing it in Google; its colour is
  `GET/PATCH /api/calendar-colors/tasks-calendar` (Google's list colour, like any calendar's).
  TEST_MODE: `GET/POST /api/__test/remote/calendars` (raw calendar list), `GET /api/__test/tasks-calendar` (its id).
- Task list writes larger than 30 000 chars of extended properties are rejected with `Task list is too large`.
- The mock persists to `DATA_DIR/mock-google.json` with a 200 ms debounced atomic flush (also flushed on SIGTERM).
  Settings and motivation are tiny, stored per person (ADR 0035) and written synchronously and atomically.

## Footprint

Google libraries are never loaded in mock mode; the idle size limit is in `spec/features/app/performance.feature`. `test/leak.test.ts` runs 5 000 in-process requests under `--expose-gc` and asserts < 10 MB heap growth.
