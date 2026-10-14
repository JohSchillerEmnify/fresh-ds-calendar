# Architecture

Binding inputs: `../BRIEF.md` (incl. its owner updates), `API.md`, `features/`.

This document specifies behaviour and boundaries. Library and tool names appear only where the BRIEF fixes them or as
examples ("e.g."); the "Decision" section of `docs/RESEARCH.md` overrides any stack choice named here or in the BRIEF.
The contracts (REST API, `CalendarProvider`, task list encoding, `data-testid`s, env vars) do not change with the stack.

## 1. Overview

```
 phone / desktop browser (PWA)                       home server 192.168.1.38
┌─────────────────────────────┐   HTTP(S)   ┌──────────────┐   ┌──────────────────────────────────────────┐
│ web/  Vue 3 + Pinia + Router│ ──────────▶ │ Traefik      │──▶│ calendar container (Node 22, Fastify)    │
│  - views: month/week/day    │   /api/*    │ cal.mordor.  │   │  ├─ static: web/dist (SPA fallback)      │
│  - stores: clock, items,    │             │ local (now)  │   │  ├─ /api routes  (API.md)                │
│    sync, ui                 │             │ cal.<sub>.   │   │  ├─ services: EventService,              │
│  - service worker (shell)   │             │ <domain>     │   │  │   TaskListService, TaskListCodec      │
└─────────────────────────────┘             │ (HTTPS, later)│  │  └─ CalendarProvider                     │
                                            └──────────────┘   │       ├─ MockGoogleProvider → DATA_DIR    │
                                                               │       └─ GoogleProvider → Google API v3   │
                                                               └──────────────────────────────────────────┘
```

Single container: the server serves the built web app and `/api`. No database; Google Calendar (or its mock) is the
only store. The web app keeps an in-memory cache per visible range (plus `localStorage` snapshot of the last range for
instant start; optional).

### Monorepo layout

```
calendar/
  BRIEF.md  README.md  Dockerfile  .dockerignore
  spec/      features/*.feature, STEPS.md, ACCEPTANCE.md, ARCHITECTURE.md, API.md, ASSUMPTIONS.md, scripts/
  server/    src/{app.ts, index.ts, config.ts, api/, services/, providers/{CalendarProvider.ts, mock/, google/}, test/}
  web/       src/{main.ts, router.ts, stores/, composables/, views/, components/, pwa/}, public/icons/
  e2e/       playwright.config.ts, steps/*.ts (playwright-bdd), fixtures
```

## 2. Server components

| Component | Responsibility |
|---|---|
| `config.ts` | Reads env (§8), validates with a schema, exposes typed config. |
| `app.ts` | `buildApp(config, provider?)` → Fastify instance (used by `index.ts` and by Vitest `inject`). Registers routes, error handler (maps domain errors to API.md error format), static + SPA fallback, test routes iff `TEST_MODE`. |
| `Clock` | `now()`; test override (frozen). Injected everywhere instead of `Date.now()`. |
| `EventService` | Validation, mapping `CalendarEvent` ⇄ `GoogleEvent`, If-Match handling. |
| `TaskListService` | Task list CRUD + item operations as read-modify-write with retry on provider 412. |
| `TaskListCodec` | Pure functions: `TaskList` ⇄ `GoogleEvent` (extended properties, chunking, description mirror). 100 % unit-tested. |
| `MotivationService` | Check-in streak and plant state in `DATA_DIR/motivation.json`; awarding rules per API.md; pure rule functions unit-tested with fixed dates. |
| `SummaryService` | Per-day counts for `/api/summary` (one provider list call per ≤ 100-day chunk). |
| `SettingsStore` | Settings and categories in `DATA_DIR/settings.json` (atomic write, versioned, defaults on first run). Independent of the provider. |
| `colors.ts` | Google palette, nearest-color (CIE76 ΔE), hex validation. Shared with `web/`. |
| `CalendarProvider` | Abstraction over Google Calendar API v3 (below). |
| `MockGoogleProvider` | In-memory store + JSON file persistence in `DATA_DIR/mock-google.json` (atomic write: temp file + rename). Seeds demo data when empty unless `SEED=false`. Emulates ids, etag, `updated`, `sequence`, `status: cancelled`, `extendedProperties`, `syncToken`, 412 on stale `ifMatch`. Has test hooks: `reset`, `setOutage`. |
| `GoogleProvider` | Google Calendar API v3 over HTTPS (official client library or plain `fetch`, per RESEARCH.md) with OAuth2 refresh-token auth. Unit-tested with mocked HTTP (injected `fetch` or an HTTP interceptor). Caches reads and backs off on rate limits (§4 "Google access: caching and rate limits"). Maps Google HTTP errors: rate limit (429, 403 `rateLimitExceeded`) → `RateLimitedError`, 401/403 auth → `ProviderUnavailableError`, 404/410 → `NotFoundError`, 412 → `PreconditionFailedError`, 5xx/network → `ProviderUnavailableError`, other → `ProviderError`. |

### CalendarProvider interface

```ts
// server/src/providers/CalendarProvider.ts
export interface GoogleEventDateTime { date?: string; dateTime?: string; timeZone?: string }
export interface GoogleEvent {
  id: string; calendarId: string; etag: string; status: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string; description?: string; location?: string; colorId?: string;
  start: GoogleEventDateTime; end: GoogleEventDateTime;
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
  created: string; updated: string; iCalUID?: string; sequence?: number;
}
export type GoogleEventInput = Omit<GoogleEvent, 'id' | 'calendarId' | 'etag' | 'created' | 'updated' | 'status'>
  & { status?: GoogleEvent['status'] };

export interface ProviderCalendar {
  id: string; summary: string; backgroundColor: string; primary: boolean;
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
}

export interface ListEventsParams {
  calendarId: string;
  timeMin: string;            // RFC 3339, inclusive (event end > timeMin)
  timeMax: string;            // RFC 3339, exclusive (event start < timeMax)
  privateExtendedProperty?: string[];   // 'kind=tasklist'
  showDeleted?: boolean;
}
export interface ListEventsResult { items: GoogleEvent[]; nextSyncToken?: string }

export interface WriteOptions { ifMatch?: string }

export interface CalendarProvider {
  readonly name: 'mock' | 'google';
  ping(): Promise<void>;                                            // throws when unavailable
  listCalendars(): Promise<ProviderCalendar[]>;
  listEvents(p: ListEventsParams): Promise<ListEventsResult>;      // expands nothing: singleEvents=true semantics
  getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
  insertEvent(calendarId: string, ev: GoogleEventInput): Promise<GoogleEvent>;
  patchEvent(calendarId: string, eventId: string, patch: Partial<GoogleEventInput>, o?: WriteOptions): Promise<GoogleEvent>;
  deleteEvent(calendarId: string, eventId: string, o?: WriteOptions): Promise<void>;
  moveEvent(calendarId: string, eventId: string, destinationCalendarId: string): Promise<GoogleEvent>;
  /** Incremental sync (optional optimisation; the web app does not depend on it). */
  listChanges?(calendarId: string, syncToken: string): Promise<ListEventsResult>;
}

export class ProviderUnavailableError extends Error {}
export class ProviderError extends Error {}
export class NotFoundError extends Error {}
export class PreconditionFailedError extends Error {}
```

The services know only this interface. The provider is chosen once at startup:
`PROVIDER=mock` → `MockGoogleProvider`, `PROVIDER=google` → `GoogleProvider` (startup fails fast with a clear message
if Google env vars are missing). Recurring events: `listEvents` uses `singleEvents=true`; the app displays recurring
instances but editing a recurring instance edits only that instance (Google default for instance ids). Creating
recurring events is out of scope.

## 3. Task lists in Google Calendar

One task list = one Google event in the person's **tasks calendar** (owner, 2026-10-13: keep the main calendar clean;
option A of two — B, server storage with Drive backup, may follow in the VPS track and would replace this):

- The tasks calendar is a secondary calendar "Calendar app: tasks" in the person's own Google account. Its id is kept
  per person in `DATA_DIR/users/<sub>/prefs.json` (`tasksCalendarId`). When it is first needed (first read or create of
  task lists) the server looks it up (stored id, else the calendar list by that summary), else creates it
  (`calendars.insert`) and switches it off in Google's list (`calendarList.patch` `hidden: true`). One in-flight
  creation per person (a promise per `sub`), so parallel requests never make two.
- Task lists are read and written only there. The calendar never appears as an event calendar or filter chip
  (`GET /api/calendars` leaves it out), and events in it that are not task lists are ignored.
- Setting "Show tasks calendar in Google" (Calendar section, per person `tasksCalendarVisible` in prefs, default
  off) sets the calendar list entry `hidden` accordingly; it changes nothing in the app.
- Mock mode does the same against the mock account. No migration: there were no real Google accounts yet (owner).

| Task list | Google event |
|---|---|
| `title` | `summary` |
| `date`, `time = null` | all-day: `start.date = date`, `end.date = date + 1` |
| `date`, `time = HH:mm` | timed: `start.dateTime = date T time`, `end.dateTime = start + (estimateMinutes ?? 30) min`, `timeZone = TZ` |
| `estimateMinutes` | `extendedProperties.private.estimate` (decimal string; absent = none) |
| `recurrence` (@optional) | Google `recurrence: ["RRULE:FREQ=DAILY\|WEEKLY\|MONTHLY"]`; per-occurrence ticks are stored by patching the instance (Google exception) |
| marker | `extendedProperties.private.kind = "tasklist"` |
| format version | `extendedProperties.private.tlv = "1"` |
| `items` | `extendedProperties.private.items` = JSON `[{"id","t","d"}]` (`t` title, `d` 0/1), chunked: |
| | if the JSON is ≤ 1024 chars it is stored in `items`; otherwise it is split into 1000-char slices stored in `items`, `items_1`, `items_2`, … and `itemsChunks = "<n>"`. Readers concatenate `items` + `items_1..n-1`. Writers delete stale higher chunks (patch them to `null`/empty). |
| human mirror | `description` = one line per item, `☐ title` or `☑ title`, joined with `\n`, nothing else |
| `completedOn` | `extendedProperties.private.completedOn` = `YYYY-MM-DD`, written by `TaskListService` on an update that leaves no open item where one was open before (date from the app clock, so the test clock applies; a list created complete gets none) and removed on the write that leaves an item open again (untick, add). Absent = not complete, or completed outside the app (Google app) or before this property existed. |
| `canvas` (@optional) | `extendedProperties.private.cx` and `.cy`: integer strings `0..10000`, the note's place on the Canvas (ARCHITECTURE "Canvas"); both absent = no place yet |
| undated | a list without a date: all-day on the anchor date **2099-12-31** with `extendedProperties.private.undated = "1"` (below) |
| `categoryId` | `extendedProperties.private.categoryId` (absent = no category) |
| `tags` | `extendedProperties.private.tags` = JSON array of strings (absent or `[]` = none; ≤ 1024 chars by limits) |
| color in Google | `colorId` = nearest Google color to the category color; no category → `colorId` removed (calendar color) |

- Limits: 200 items, 200 chars per title; Google allows max 300 extended properties / 32 kB total, which these limits
  respect (200 × ~215 chars ≈ 43 kB worst case → the server rejects writes whose encoded size exceeds 30 kB with
  `400 VALIDATION_ERROR "Task list is too large"`).
- **Authority**: `extendedProperties` is authoritative. If `kind = tasklist` but no `items` property exists (created
  by hand in Google, or stripped), items are parsed from the description (`☐`/`☑`/`[ ]`/`[x]` prefixes, other
  non-empty lines = not done) and get stable ids derived from line index + title hash; the first app write then
  stores proper `items`. Edits made to the description in the Google app are overwritten on the next app write
  (documented limitation).
- Task lists are excluded from the plain event endpoints and vice versa (404).
- The app shows the category color from settings (exact hex), while Google shows the nearest `colorId`. When a
  category's color changes, Google `colorId`s of existing task lists are updated lazily on their next write (no mass
  rewrite; assumption A-44).

## 4. Sync strategy

Server: a pass-through to the provider for every request. `MockGoogleProvider` has no cache; `GoogleProvider` keeps a
short per-person read cache and a rate-limit cooldown (see "Google access: caching and rate limits"), so a remote change
can take up to 25 s to show. The REST contract does not change, apart from the `stale` marker.

Web (`stores/sync.ts`, `stores/items.ts`):

1. The router decides the visible range (month grid incl. adjacent days, week, day). `items` store fetches
   `GET /api/items?from&to` for it, with ±1 period prefetch optional.
2. Re-fetch triggers: route change; interval timer every `pollIntervalMs` (from `/api/config`, default 30 000; `0` =
   off); `visibilitychange` → visible and `window` `focus` (debounced 500 ms, also re-fetches `/api/config`);
   `online` event; the banner "Retry" button; after every successful mutation (only the affected range).
3. Polling pauses while `document.hidden`.
4. Merge: the response replaces the range in the store keyed by id. Items with a pending mutation keep their optimistic
   state until the mutation settles (so a poll never undoes a tick in flight). UI state (expanded task list, open
   dialog) lives in the `ui` store and survives refreshes; if the expanded list disappears remotely, it collapses.
5. Mutations are optimistic for task list item operations (tick, add, rename, delete, reorder): apply locally, call API,
   on success replace with the returned `TaskList`, on failure roll back and show the banner. Event and task list
   dialog saves are **not** optimistic: the dialog shows a saving state, closes on success, stays open with an inline
   error on failure.
6. Errors: any failed fetch/mutation with network error, 502 or 503 (not `RATE_LIMITED` while data is shown, see
   "Google access: caching and rate limits") sets `sync.error` → `sync-error-banner`
   ("Can't reach Google Calendar. Showing the last known data." + "Retry"). The banner is a non-modal strip below
   the top bar; everything stays interactive. The next successful fetch clears it.
   `sync-status` exposes `data-state="idle|syncing|error"` and `data-last-sync="<ISO>"` (time of last successful sync).
   After a failed sync, focus and visibility triggers and the queued follow-up sync do nothing for the poll
   interval (or the server's `Retry-After`, when longer); only the poll timer, the `online` event and the banner's Retry button start a sync.
7. No offline write queue (assumption A-12).

### Google access: caching and rate limits (owner incident 2026-10-14)

Why: after a deploy restart one person produced about 100 `rateLimitExceeded` answers in a minute (75 `events.list`,
20 `calendarList.list`, 32 `GET /api/items` answered 503) and saw "Can't reach Google Calendar". One `GET /api/items`
fans out to one `events.list` per calendar plus one for the tasks calendar, all at once, after a `calendarList.list`
that was neither cached (the `/api/calendars` route bypassed the service cache) nor shared between parallel requests,
and a failed read left nothing behind, so the next request repeated all of it. Google's per-person limit then turned
every request into a 503.

`server/src/providers/google/RateGuard.ts`, one instance per `GoogleProvider` (= per person):

- **Read cache.** `events.list` (key: calendar, range, `showDeleted`, property filter) and `calendarList.list`, fresh for
  25 s. Concurrent identical calls share one in-flight request (single-flight). Callers get copies. Every write
  (`insert`/`patch`/`delete`/`move` of events, `calendars.insert`, `calendarList.patch`) makes all entries not fresh at
  once, and a read that was already in flight during the write is not stored as fresh. `getEvent` and `listChanges` are
  never cached (read-modify-write needs the live etag). Entries stay usable as stale data for 30 min, at most 300 per person.
- **Cooldown.** A 429, or a 403 with reason `rateLimitExceeded` / `userRateLimitExceeded`, starts a cooldown of 5 s,
  doubling on every consecutive rate-limit answer up to 2 min, or Google's `Retry-After` (at most 10 min) when sent. A
  successful call after the cooldown resets the backoff. While it runs **no Google call is made** (not even a write):
  reads fall back to the cached entry (stale up to 30 min), everything else throws `RateLimitedError`
  (a `ProviderUnavailableError`), which the API answers as `503 RATE_LIMITED` + `Retry-After` (not logged as
  `api_unavailable`). Calls that fail at the same moment as the one that started the cooldown neither log nor extend it.
- **Stale marker.** `CalendarService.stale()` is true while the cooldown runs; `GET /api/items` then carries
  `stale: true` and every `GET` the header `X-Stale: 1` (API.md "Stale data").
- **Diagnostics.** `rate_limited` lines: `state: start` (`subHash`, `op`, `cooldownSec`, `step`, `retryAfter`) and
  `state: end` (the first successful call after the cooldown), one each per cooldown, not per request. `google_error`
  lines are still written per failed Google call.

Alternatives weighed: a global (not per person) limiter (rejected: Google's limit is per person, one person's burst must
not slow the others); serving stale data for every provider failure (rejected: outages must stay visible, the banner exists
for them; only the rate limit is a known transient); a longer TTL (rejected: a remote change would show later than the 30 s
poll people expect). Web: `ApiError.isRateLimited`; a rate-limited failure shows no banner while any range is loaded
(`sync.rateLimited`, `data-rate-limited` on `sync-status`); background `prefetch` of a range that failed is not repeated
for 30 s.

## 5. Web app

- **Router**: `/year/:yyyy` (4 digits) added. `/` → the default view (settings, default month) for today, e.g. `/month/2026-10`; `/month/:ym`,
  `/week/:date` (normalised to Monday via `replace`), `/day/:date`, `/settings`; invalid or unknown →
  `/month/<today>` (replace). Calendar routes keep the filter query (`categories`, `tags`) when navigating. History mode (server SPA fallback).
- **Focus date** (store): used by "switch view" and dialog defaults. On every route change: keep the focus date if it
  is inside the new period, else today if inside, else the first day of the period. Switching view navigates to the
  period of that view containing the focus date. Day view: focus = its date.
- **Period titles** (`en-GB`): month `October 2026`; week `12 – 18 Oct 2026`, `28 Sep – 4 Oct 2026`,
  `28 Dec 2026 – 3 Jan 2027` (en dash with spaces); day `Wednesday, 14 October 2026`.
- **Month grid**: Monday first, from the Monday on/before the 1st to the Sunday on/after the last day (5 or 6 rows;
  4 only for Feb starting Monday in a non-leap year).
- **Ordering in a day**: all-day events, then untimed task lists, then timed items by start time (events and timed
  task lists interleaved), ties by title.
- **Zoom** (owner, 2026-10-13): the time grid of the day and week views zooms — two-finger pinch on touch, Ctrl+wheel
  / trackpad pinch on desktop — between 24 px and 160 px per hour, around the pinch/pointer position (the time under
  the fingers stays put). The hour height is remembered per device (`localStorage`, not synced: phones and desktops
  want different values). A pinch never starts a swipe or a drag; only `transform`/the `--hour-height` variable
  change, blocks re-lay out after the gesture settles.
- **Blocks to scale** (owner, 2026-10-13, replaces the earlier 44 px task list minimum): task lists are as tall as their
  duration like events, with the same small minimum (title only when short; content fades out); zoom in for room.
- **Time grid** (week/day): 24 rows, `--hour-height` 48 px (desktop) / 44 px (phone) by default (zoomable, see above), initial scroll to 07:00
  (or one hour before the current time if today is visible and later than 08:00). Overlap layout: Google-like column
  packing — events in a connected overlap cluster are split into equal columns; touching (end == start) is not overlap.
  Timed task lists are 30 min blocks in the grid.
- **Event blocks** fill their room in this order (owner): title (as many lines as fit), time, location
  (`event-chip-location`), then description lines; each row only when there is room for it.
- **Use the space given** (owner principle, 2026-10-12): cells, cards, lists and rows show as much as their measured
  space allows; no hard-coded item or line counts anywhere. What does not fit fades out at the bottom (no `+N`).
- **Month overflow** (owner 2026-10-12): a cell shows as many entries as fit and fades the rest out with a gradient
  mask at the bottom; no `+N`. Task list cards do the same with their items (no `+k more`).
- **Defaults for new event**: date = focus date; if that is today, the next full hour after now (capped at 23:00),
  else 09:00; duration 1 h; calendar primary. Changing the start keeps the duration.
- **Clock**: `useClock()` (see API.md `/api/config`).
- **i18n** (owner, 2026-10-13): translated through a token system, `web/src/i18n/`.
  - **Library**: vue-i18n 11 in Composition API mode (`legacy: false`), behind our own typed `t()`; UI code imports
    `t` from `@/i18n`, never from vue-i18n. Templates and scripts call `t('settings.language.label')`; with
    values `t('settings.tasklists.moveUp', { name })`, with a count `t(key, { count }, count)` for `a | b` plurals.
  - **Languages**: `en` (default and last fallback), `de`, and two fun languages, `de-x-mainfr` ("Fränggisch", light
    Mainfränkisch, readable) and `de-x-coldmirror` ("Coldmirror" slang). The fun ones may be partial and fall back to
    `de`, then `en`. The ids are internal; `<html lang>` gets a valid BCP 47 tag (`de-x-coldmir` for Coldmirror, since
    private-use subtags have at most eight characters) and `Intl` always gets `en-GB` or `de-DE`.
  - **Catalogues**: `web/src/i18n/locales/{en,de,de-x-mainfr,de-x-coldmirror}.ts`, keyed, nested, named by meaning
    (`tasks.empty`, `settings.language.label`), never by text. `en.ts` is the source of truth: `type Messages` is its
    shape, `MessageKey` the union of its dotted paths, so a missing or misspelt key is a type error. `de.ts` is typed
    `Messages` (complete: a new `en` key without a German one fails the type check, `pnpm i18n:check` and a unit
    test); the fun languages are `PartialMessages`, and `pnpm i18n:check` reports their gaps as info. `en` is bundled;
    the others are lazy chunks, loaded when the language is applied (`de` first for the fun ones). Each catalogue is a
    default-exported object literal (`satisfies` the schema, which lives in `i18n/schema.ts`).
  - **Runtime compiling** (owner, 2026-10-13): vue-i18n compiles the message strings in the browser. Precompiling
    (`@intlify/unplugin-vue-i18n`, runtime-only) was tried and made the first load 1.7 kB bigger, and removing the
    compiler by patching vue-i18n broke the app, so neither is used. Numbers and reasons: A-91.
  - **Choice**: the person pref `language` (`auto` | `en` | `de` | `de-x-mainfr` | `de-x-coldmirror`, default `auto`,
    in `Prefs`, `GET/PATCH /api/prefs`, validated by a whitelist). `auto` follows the device: the first entry of
    `navigator.languages` being `de` or `de-*` gives `de`, anything else `en`. Settings → Appearance has the select
    "Language" (`settings-language`) with the options Automatic (translated), English, Deutsch, Fränggisch, Coldmirror
    (each in its own name). Changing it applies at once, without a reload (`applyLanguage`, run from the shell when
    `prefs.language` changes, also when it arrives from another device). The last pref is cached in `localStorage`
    (`language`) so the first paint of the next visit already uses it; the server value wins once loaded.
  - **Formats**: 24 h and Monday as the first day stay in every language. Dates follow the language: English keeps its
    en-GB forms (`lib/dates.ts`, date-fns), all other languages use `Intl` with `de-DE` ("Dienstag, 13. Oktober 2026",
    weekday headers "Mo".."So", month names). `weekdayLabels()` / `monthNames()` replace the former constants.
    Every displayed date goes through `formatDate(d, kind)` in `lib/dates.ts` (date-fns pattern for English, as A-85
    decided, `Intl` otherwise); no view calls date-fns `format` or `toLocaleDateString` for display. Hour labels stay
    `HH:00`, the same in both locales.
  - **Theme validator messages**: `@calendar/shared` keeps `validateTheme` / `validatePicture` / `sanitizePicture`
    returning the English `errors` (the AI repair prompt stays English, the server API is unchanged) and adds
    `validateThemeIssues` / `validatePictureIssues` / `sanitizePictureIssues` returning `{ code, params, message }`
    per problem. The UI shows `issueText(issue)` (`theme/issueText.ts`, keys `theme.import.issue.<code>`; an unknown
    code falls back to the English message) and feeds the English `message`s to the repair prompt. Alternative
    weighed: changing `errors` to objects (rejected: breaks the server and its tests for no gain).
  - **Server messages** stay English; user-facing validation errors also carry `error.key` (API.md "Error format"),
    equal to a catalogue key. `ApiError.userMessage` translates a known key and otherwise shows the server's English.
  - **Rules for new code**: all new UI text goes through `t()`; no hard-coded strings in templates or scripts, new
    keys go into `en.ts` and `de.ts` together (the fun languages when there is a good joke). A unit test
    (`i18n-raw-text`) rejects hard-coded text and static `label`/`aria-label`/`title`/`placeholder` attributes in
    the templates of the components listed in it; a component is added to the list when its area is migrated. No
    eslint dependency for this (owner: only if lightweight).
  - **Migrated in this slice**: the former `en.ts` keys, the Settings page and the view switcher labels (navigation
    bar and rail). **Moving the remaining strings: per area** — calendar views, task lists/tray, Tasks view, dialogs,
    theme menu, motivation, labs — one area per slice, after the open feature branches are merged (many are in flight
    and would conflict); each slice moves its strings and adds its components to the raw-text test.
  - **Alternatives weighed**: own typed `t()` wrapper over vue-i18n's `DefineLocaleMessage` typing (chosen: key
    errors are real compile errors and the surface stays small); `<i18n>` blocks / JSON catalogues (rejected: TypeScript
    catalogues give the schema type for free); a Settings-only language (rejected: owner wants a device default).

### Mobile-first UX (primary target 375–430 px portrait)

Breakpoint: `< 768px` = phone layout; ≥ 768px = desktop layout. Design and implement phone first.

- **Top app bar** (compact): period title, Today button, prev/next buttons (secondary to swiping), sync status, install
  button when available.
- **View switcher** (`view-switcher`, `data-position` = `bottom` | `top` | `rail`): Year | Month | Week | Day | Tasks (plus
  the Labs views) as tabs. Where it sits is a setting (see "View switcher position"). Default: phone = **bottom bar**
  (`bottom-bar`, fixed, thumb zone); desktop and tablet = **rail** at the left (also `bottom-bar`, a legacy testid).
- **FAB** `create-button`: floating "+" bottom-right, above the bottom bar, opens the one "new" dialog.
- **Touch targets** ≥ 44 × 44 px for all buttons, checkboxes (hit area), chips that open things.
- **Swipe**: horizontal swipe on `calendar-swipe-area` (touch events; ≥ 60 px horizontal, |dx| > 1.5·|dy|, < 600 ms)
  changes period: left = next, right = previous. Vertical movement scrolls normally (`touch-action: pan-y`).
  Owner, 2026-10-13: the swipe is a live carousel. Once the gesture is horizontal, the current period follows the
  finger and the neighbouring period (next when pulling left, previous when pulling right) slides in beside it,
  already rendered. On release past a third of the width or with a quick flick (> 0.5 px/ms) it settles onto the
  neighbour with a short spring and the route changes; otherwise both spring back. The neighbour is mounted only
  when a horizontal swipe starts (no permanent pre-rendering), as a light copy of the same view component (no
  entry animations, no drag/resize handlers, `aria-hidden`), and it uses already cached items, fetching its range in
  the background if needed. Only `transform` is animated; Reduced/Off motion: no follow, the period changes at once
  on a completed swipe as before. Desktop (mouse) is unchanged.
- **Month view on phone**: cells show the day number and compact chips (colored, title only, truncated) as many as fit,
  the rest fading out at the bottom. Tapping anywhere in a cell opens `/day/<date>` (the day agenda). Desktop: day number → day view, chip → opens
  the event / expands the task list.
- **Month view rows, like Google Calendar (owner, 2026-10-14, screenshot of Google Calendar's month view)**: a week row
  has **one shared set of entry rows** ("slots", one chip height each). Multi-day bars are packed into the lowest free
  slots of the days they cover (`laneCount`/lanes as before), and **a bar occupies its slot only on the days it spans**.
  Each day's own entries (all-day, timed, task lists, in the existing order) then fill **that day's** free slots from the
  top, gaps under or between bars included, then the rows below. A day no bar touches starts its entries right under the
  day number; bars never push down the cells of days they don't cover. The day's line budget (`entries`, fade-out of the
  rest) counts only the slots that day actually uses. Bars look like chips (same height, font, padding and radius as a
  chip in that cell; owner: "it's visible that they are multi-day because they span multiple days, we don't need an extra
  distinction"): no ◂ ▸ arrows; a bar cut at a week edge only has square ends there. Applies to the month view on phone and
  desktop; the week view's all-day row and the zoom month are unchanged (assumption: the screenshot and request are
  about the month view). **Why**: a reserved lane band per week wasted most of every cell in a busy month; packing per day
  is what the owner's reference does and uses the cells' space efficiently.
- **Week view on phone**: 7 narrow columns, all fit (no horizontal scroll); chips show truncated title; tap opens.
- **Dialogs**: phone = bottom sheet (full width, anchored to the bottom, rounded top, max-height 90dvh, internal scroll,
  drag handle; padding-bottom includes safe-area inset); desktop = centered modal ≤ 520 px. Escape and the Cancel
  button close; backdrop tap closes only when the form is pristine.
- **Expanded task list**: phone = bottom sheet; desktop = popover anchored to the card (day view: same popover).
- **Safe areas**: `viewport-fit=cover`; top bar `padding-top: env(safe-area-inset-top)`, bottom bar and sheets
  `padding-bottom: env(safe-area-inset-bottom)`, left/right insets on the root. `bottom-bar` carries
  `data-safe-area="true"`.
- **No horizontal page scroll** at 320–430 px: long titles truncate with ellipsis, `min-width: 0` on grid children,
  `overflow-x: hidden` only as last resort on the calendar body (not on `html`).
- Font sizes ≥ 16 px for inputs (prevents iOS zoom). Native `<input type="date|time">` for pickers.

### Material 3 (Expressive) design

The UI follows current Android design language (Material 3, Expressive variant) and must still feel natural on iOS.
Components are built in-house on CSS custom properties (no heavy component framework unless RESEARCH.md decides
otherwise; bundle budget §5a applies).

- **Color roles as tokens**: `--md-sys-color-<role>` on `:root` for at least `primary`, `on-primary`,
  `primary-container`, `on-primary-container`, `secondary`, `secondary-container`, `on-secondary-container`,
  `tertiary`, `tertiary-container`, `surface`, `surface-dim`, `surface-bright`, `surface-container-lowest` …
  `surface-container-highest`, `on-surface`, `on-surface-variant`, `outline`, `outline-variant`, `error`, `on-error`,
  `error-container`, `inverse-surface`, `inverse-on-surface`, `scrim`.
- **Dynamic color**: the whole scheme is generated **at runtime** from the user's seed color (settings) with the M3
  algorithm (HCT color space, tonal palettes, "tonal spot" scheme variant; Expressive variant allowed if the result
  stays readable). Only the needed parts of the algorithm are shipped (≤ 12 kB compressed; e.g. a tree-shaken subset
  of the reference color utilities or an own port). The generated roles are written as `--md-sys-color-*` on `:root`
  in one style update. The default scheme (seed `#1a73e8`, light and dark) is also inlined as static CSS in
  `index.html`, so the first paint is never unstyled. The last applied scheme is cached in `localStorage` and applied
  before the app mounts, to avoid a color flash on reload.
- **Item colors** (owner, 2026-10-12: solid like Google Calendar): events and task lists are filled with their colour
  as given, in both themes; the text is white or black, whichever has the higher contrast (≥ 4.5:1). Task lists keep
  their checkbox mark and progress; they are no longer told apart by a dashed edge and tint.
- **Theme mode** (settings): `system` follows `prefers-color-scheme` live (media query listener); `light`/`dark`
  force it. `<html data-theme="light|dark">`; `<meta name="theme-color">` is updated to the current `surface` color;
  manifest `theme_color` stays `#1a73e8`.
- **Type scale**: M3 roles as tokens `--md-sys-typescale-{display,headline,title,body,label}-{large,medium,small}-*`
  (size/line-height/weight). Font stack: `Roboto Flex, Roboto, system-ui, -apple-system, "Segoe UI", sans-serif`;
  no web font download required (system font on iOS = SF, which keeps it "fine on iOS"). Inputs ≥ 16 px.
- **Shape and elevation**: shape tokens (`--md-sys-shape-corner-{extra-small,small,medium,large,extra-large,full}`);
  M3 Expressive uses larger, rounder corners for the FAB (large), sheets (extra-large top) and chips (small/full).
  Elevation via tonal surface containers first, shadows only for FAB and menus.
- **Components**:
  - *Top app bar* (small/center-aligned on phones): period title (title-large), Today, prev/next icon buttons,
    sync status, install button. Uses `surface`, switches to `surface-container` on scroll.
  - *Navigation bar* (phones, bottom, 80 px + safe area): Year / Month / Week / Day destinations with icons, active indicator
    pill (`secondary-container`). *Navigation rail* on desktop ≥ 768 px is allowed (left), same testids.
  - *FAB*: large/regular FAB with "+", `primary-container`; opens a small menu (Event / Task list) — FAB menu style.
  - *Bottom sheets* (phones) and *dialogs* (desktop) with drag handle, `surface-container-low`, scrim.
  - *Chips*: events and task lists render as filled, tonal chips/cards; task list cards use `surface-container-high`
    with a check icon and the `x/y` count as a label-small badge.
  - *Checkboxes*, *text fields* (filled or outlined), *icon buttons*, *menus*, *snackbar-like* sync error banner
    (non-modal, with "Retry" text button).
  - *State layers*: hover 8 %, focus 10 %, pressed 10 % overlay of the content color on every interactive element;
    pressed state exposes `data-pressed="true"`; ripple animation optional and disabled under `prefers-reduced-motion`.
- **Motion**: M3 easing/duration tokens; Expressive spring-like transitions for sheets and view changes, ≤ 300 ms,
  `prefers-reduced-motion` honoured.
- **Icons**: inline SVG subset (Material Symbols outlined), tree-shaken; no icon font download.
- **iOS feel**: system font, respect safe areas, momentum scrolling, no Android-only gestures required, back via the
  in-app navigation (no reliance on a hardware back button).
- **Accessibility**: contrast ≥ 4.5:1 for text in both themes, visible focus ring, accessible names.

### Settings screen, categories and filters

- **Settings** (`/settings`, `settings-button` in the top app bar; full-screen page on phones, centered page on
  desktop) with M3 list sections:
  Sections (owner, 2026-10-13: deduplicated, proper sections; each a card with a heading, on desktop with a section
  list on the left; every setting exists exactly once):
  1. *Appearance*: one row "Theme" showing the chosen theme (the calendar's theme for Header + colours, "<theme> · <calendar theme> header" for Header only, the theme name for Off;
     owner 2026-10-13), opening the theme menu (`settings-theme`). Theme mode
     (System / Light / Dark, `settings-theme-mode`), seed colour (`settings-seed-preset`, `settings-seed-custom`) and
     the Scene choice live only in the theme menu, no longer on the settings page.
  2. *Calendar*: default view, default event colour, Approaching card + track + window, show tasks calendar in Google.
  3. *Task lists*: categories (list, add, sort; tap opens the category dialog).
  4. *Focus & motivation*: transition warning, calm mode, streak flame, plant, sunflowers, best streak, support cat.
  5. *Motion & sound*: animations, ignore the device setting, sounds.
  6. *Bedtime*: bedtime mode (see "Bedtime mode").
  7. *Labs*: experimental views.
  8. *Account & data*: sign out, demo data.
  Settings are loaded at startup together with `/api/config`, re-fetched on focus, and saved with `PATCH` (optimistic,
  rolled back with the error banner on failure).
- **Tags shelved** (owner, 2026-10-13: purpose and flow unclear): no tag field in the forms, no tag chips in the
  expanded view or cards, no tag filter. Stored tags (`extendedProperties.private.tags`) are kept untouched and still
  round-trip, so nothing is lost if tags return. The rest of this section describes them for later.
- **Task list form**: adds `category` (select: categories + "No category"; default "No category") and `tags`
  (comma-separated text field; shown as input chips).
- **Collapsed task list card**: background/accent from the category color, category emoji before the title, done
  count badge. Tags are shown in the expanded view as small assist chips.
- **Filter bar** (`filter-bar`): toggled by `filter-button` in the top app bar (badge with the count of active
  filters); always shown while a filter is active. One horizontally scrollable row of M3 filter chips: each category
  (color dot + icon + name), "No category", then every tag used in the loaded items (alphabetical), and "Clear".
  The row scrolls inside itself (`overflow-x: auto`), never the page. Filter state = URL query (API.md).
- **Event form**: adds `color` (Calendar color + the 11 Google colors, shown as swatches with names), default from
  settings.

### 5b. ADHD-focused features (see `docs/ADHD-RESEARCH.md`)

**Navigation bar on phones:** four destinations (Year, Month, Week, Day). The **open tasks tray** sits as a slim bar
directly above the navigation bar, and the FAB floats above the tray. On desktop the tray is a right-hand side panel.
The top app bar contains: the period title (button, opens the month picker), Today, prev/next, the streak flame,
the plant, filter, settings and sync status. Compact icons collapse into an overflow menu below 360 px.

- **Clock service** (`useClock`): one app-wide minute ticker (aligned to the minute, `setTimeout` chain) that drives the
  now marker, the Now card and transition warnings. It pauses while hidden and resyncs on visibility. In test mode the
  timer helper counts active timers in `window.__appTimers`.
- **Proportional timeline**: block height = duration × hour height. Minimum rendered height 24 px for items shorter
  than that; their top still matches their start. No equal-height agenda list anywhere; the phone "agenda" is the
  proportional day view.
- **Now marker** (`now-marker`, `data-time`): a primary-colour line with a dot across today's column in the day and
  week views. It updates every minute. Today's day view scrolls so now sits in the upper third (other days: 07:00).
- **Approaching card** (formerly "Now card"; owner 2026-10-13; testid `now-card` kept): above every calendar view (day, week, month, year) whatever period is shown — it is
  about now, not about the shown period (owner, 2026-10-13: hiding it on other days/weeks "diminishes the
  usefulness"). Always compact (owner, 2026-10-13: "always collapsed instead of always open"): what used to be the
  collapsed form is the only form — a slim card with the running event line and the track; no toggle, expanding is
  shelved. Setting "Approaching card" on/off
  (`settings-approaching-card`, pref `approachingCard`, default on) in the Calendar section switches it off entirely. Today's entries are always loaded for it (the calendar store keeps today in its fetched range in
  addition to the shown period).
  It is one instance above the calendar views, not part of each view: switching between day, week, month and year
  keeps it in place without leaving or entering again (owner, 2026-10-13: "keep it there persistently"); it only
  animates when it first appears.
  - Lines (`now-card-line`), compact: current event `"<title> · <d> left"` with a shrinking linear progress bar
    (`now-progress`, M3 linear progress, `aria-valuenow` = elapsed %); next timed event today
    `"Next: <title> in <d>"`, else `"Nothing else today"`. No next-task line (owner, 2026-10-13: the card shows only time things).
  - Duration format: `< 60 min` → `35 min`; whole hours → `2 h`; otherwise `1 h 20 min`. Values round down to whole
    minutes.
  - The current event is the one with start ≤ now < end; with several, the one ending first.
- **Transition warning** (`transition-warning`): a non-modal M3 snackbar `"<title> starts in <N> min"` shown once per
  event when now reaches start − N (N from settings, default 10), dismissible, auto-hides at event start. System
  notifications are a later option (they need HTTPS, permission and, on iOS, an installed PWA; not in scope).
- **Task list view** (`features/tasklists/TaskListView.vue`, root `tasklist-view` with `data-tasklist-id`,
  `data-title`): the one component that shows a task list with everything that can be done to it. Head (progress ring,
  title that renames on tap, done count `x/y` that bumps on change, "From <day>", the collapse chevron), tags,
  "All done! 🎉" (no "Next task" hint: owner 2026-10-13, it repeated the first open item), item rows (reward
  checkbox, title that edits on tap with the animated strike-through, up/down/delete), the add field (only while
  adding, above the footer) and one footer row (Add item, Edit, Delete with confirmation; no "Move to today" — owner 2026-10-13: re-date by dragging in the calendar).
  **Collapsible** (owner 2026-10-13): the chevron `tasklist-collapse` (`aria-expanded`) hides everything below the head;
  the root carries `data-collapsed="true|false"`. The state is per list and per device (`localStorage` key
  `cal.tasklistCollapsed`, a map id → true, every access in try/catch; `features/tasklists/collapse.ts`). The expanded
  list's sheet (`closable`) has no chevron: it is opened to see the list. Motion: Off and Reduced switch without a
  height animation; Full fades the body (opacity, 160 ms). It owns the tick logic once for every host: optimistic
  `ops.patchItem`, row flash, `useCelebrate` on the tick that completes the list, `lists.markFinished` for that list.
  Hosts only frame it: the **expanded list** (`ExpandedTaskList.vue`) wraps it in `AdaptiveSheet` (placement, Escape,
  focus, `tasklist-close`, which the view renders only when its host listens to `close`); the **tray** renders one
  view per open list. Owner decision (2026-10-12): no tray variant; the tray shows the popup view as it is.
- **Open tasks tray** (`task-tray`, `task-tray-count` text `"3 open"` / `"No open tasks"`, rows `task-tray-item`
  with `data-title`): fed by `GET /api/tasklists/open` (`items` + `finishedToday`), refreshed with every sync. Visible
  in all views and on all pages except Settings. Each open list's row is a task list view (above), so items, ticking,
  rewards and editing are the expanded list's own (`tasklist-item`, `tasklist-item-checkbox`, ... inside the row);
  the tray list scrolls instead of hiding items. Lists from `finishedToday` follow the open ones, collapsed to their
  struck-through title (`task-tray-title`, row `data-finished="true"`); `task-tray-unfold` shows their task list view
  in place (UI-only state). A list ticked complete in the tray keeps its view open for 2 s (celebration and
  "All done! 🎉" visible) — or until the support cat has finished its visit if it came (owner, 2026-10-13: the cat
  must not lose its card); the tray itself stays open meanwhile — then moves to the finished rows with a move animation (the store moves it from open to
  finished locally, the next refresh confirms it). The count counts open lists only. On phones the tray's expanded
  state lives in the `ui` store (`trayExpanded`), the opened tray is as tall as the expanded list's bottom sheet
  (desktop: the side panel is 380 px wide, like the expanded list's panel, and the FAB sits left of it via
  `--tray-w`), and
  the FAB slides out of view while it is open.
- **Carry-over**: open lists dated in the last 30 days before today render on today, with `tasklist-card-overdue`
  text `"From Sat 10 Oct"` (tertiary container colour, no error colour, no "overdue/missed" wording); mini cards
  show it as a `↶` badge with `aria-label`/`title` "From Sat 10 Oct". There is no "Move to today" button (owner 2026-10-13):
  the carry-forward already shows them on today; dragging in the calendar re-dates. Completed lists stay on their own date.
- **Duration estimate**: task list form field (minutes), card badge `tasklist-card-estimate` `"~45 min"` /
  `"~1 h 30 min"`.
- **Calm mode** (`html[data-calm="true"]`): collapsed cards show title and count only (no item preview, no tags),
  item colours at reduced chroma, animation level capped at Reduced, month cells show at most 2 entries.
- **Year view** (`year-view`, `year-month` with `data-month`, `year-day` with `data-date`, `data-density`,
  `data-today`): 12 mini months (3 × 4 on phones, 4 × 3 on desktop), density as dot size or opacity (M3 primary
  tones). Tapping a month opens it. Data from `/api/summary`.
- **Month picker** (`month-picker`, header `month-picker-title`, `month-picker-prev`/`-next`, days `picker-day` with
  `data-date`, `aria-selected`, `data-has-items`): opens from `period-title` as an expanding M3 surface under the top
  app bar with a spring height animation. Swipe or arrows change the month (lazy summary fetch per month). Picking a
  day sets the focus date and navigates the current view; tapping the title, the scrim or Escape closes it.

### 5c. Motion, reward and drag and drop

- **Motion system**: one small in-house module built on the Web Animations API with spring easing pre-computed into
  `linear()` timing functions. It animates only `transform` and `opacity` (compositor-friendly). No animation library.
  `html[data-motion="full|reduced|off"]` = min(setting, system preference: reduce → reduced).
  - Reduced: fades ≤ 150 ms, no particles, no bounce.
  - Off: no animations (`animation`/`transition` disabled, effects not created).
- **Reward effects** (`reward-effect`, `data-kind`): created on demand in a single overlay layer, `pointer-events:
  none`, removed on `animationend` or after a hard timeout of 1 200 ms (whichever comes first). At most 3 concurrent;
  older ones are removed. Particles are ≤ 16 absolutely positioned elements (or one canvas) per effect.
  - `tick`: checkbox spring scale 0.8 → 1.1 → 1, check path drawn (stroke-dashoffset), title strike-through grows
    left to right, 6–10 sparkles burst from the checkbox. ~600 ms.
  - `list-complete`: ~16 confetti particles, card bounce (scale 1 → 1.04 → 1 spring), progress ring
    (`tasklist-progress-ring`) fills to 100 %, message `tasklist-complete-message` "All done! 🎉". ≤ 900 ms.
  - `drop`: small settle wobble plus 4–6 sparkles at the drop point. `streak`: flame flicker plus number roll-up,
    ≤ 1 000 ms. `bloom`: a new sunflower grows in. `water`: droplet falls onto the plant. `grow`: plant scales up with a leaf unfurl. `perk-up`: droop →
    upright spring.
  - Sounds (setting, default off): tiny pre-decoded WebAudio blips, never on load.
- **Micro-interactions**: FAB press (spring scale), FAB menu (staggered), sheets and dialogs (spring slide or scale),
  view switch (shared-axis slide ≤ 250 ms), checkbox state layer. Never block input: effects run after the state change
  is applied, and clicks during an effect are handled normally.
- **Drag and drop** (pointer events, no library):
  - Pick-up: touch → long press 350 ms with < 8 px movement, then `navigator.vibrate(10)` if available (Android).
    iOS Safari has no Vibration API, so iOS gets only the visual lift. Mouse → press and move > 4 px, or press and
    hold 350 ms without moving (same gesture as touch, so release-without-moving works with a mouse too).
  - While dragging: `data-dragging="true"`, the card lifts (scale 1.05, elevation shadow) and wiggles briefly. A ghost
    follows the pointer with spring lag; tilt is proportional to horizontal velocity (max 6°). A drop indicator snaps
    to 15-minute slots (time grid) or days (month and all-day). Page swipe and touch scroll are suppressed during a drag;
    mouse-wheel scrolling keeps working and the time grid auto-scrolls near its edges (owner, 2026-10-13). Any scroll
    of the grid while dragging recomputes the drop indicator from pointer and current scroll, and the card's transform
    makes up for the scroll, so the card stays under the pointer and on the indicator, and lands where it shows.
  - Drop: optimistic move, settle spring + `drop` effect, then `PATCH` (with `If-Match`). On failure the card springs
    back to its origin and the sync error banner shows. Escape cancels a drag (desktop).
  - Duration is preserved. Timed items stay timed and all-day items stay all-day (no conversion by drag; assumption
    A-55). Multi-day events move by their first day.
  - Accessible alternative: the edit dialogs. Chips keep `role="button"`, and keyboard users use the dialog.
- **Resize handles** (timed events and timed task lists in the week and day time grid; never month or all-day):
  - Trigger: a pick-up released without moving (`drag.ts` drop with no target change) sets `ui.resizing =
    { kind, id, date }` instead of doing nothing. One entry at a time.
  - The block shows `resize-handle-top` and `resize-handle-bottom`: small pills centred on the top and bottom edge
    (styled per theme), each with a 44 px touch target. A handle drags at once (no long press); it snaps to 15 minutes outwards (owner: a dragged end rounds
    up, a dragged start rounds down, 2 minutes leniency) outwards (owner: the dragged end rounds up, a dragged
    start rounds down, with 2 minutes of leniency, so "down by 52 minutes" from 10:00 ends at 11:00)
    on the same slot grid as moves, and the dragged edge never comes closer than 15 minutes to the other one. A task
    list's duration stops at 720 minutes (the server's `estimateMinutes` range); events end at the day's end at most.
  - Save: `items.optimisticItem` like a move. Event: `PATCH /api/events/:id` with `start`/`end` (top handle moves only
    `start`, bottom only `end`) and `If-Match`. Task list: `PATCH /api/tasklists/:id` with `time` and/or
    `estimateMinutes` (top handle: `time` earlier/later and the estimate grows/shrinks so the end stays). On failure
    the block springs back to its old length and the sync error banner shows.
  - Hiding: a pointerdown anywhere outside the block's handles (document capture listener, only while `ui.resizing`
    is set), Escape, a view change, or picking the block up again. A tap on the block still opens it.
  - Swipe: `bindSwipe` is disabled while `ui.resizing` is set (`disabled()` is read at touchstart, and handles are
    already visible then), so dragging a handle on a phone never changes the period.
- **Streak flame** (`streak-flame`, text = current count) and **plant** (`plant-button`, `data-stage`, `data-mood`) in
  the top app bar, shown per the settings `streakFlame` and `plant`. `streak-message` is a small toast ("Checked in, day 4" /
  "Welcome back!") that auto-hides after 4 s and never blocks input. The plant card (`plant-card`, `plant-card-stage`,
  `plant-card-line`) is a small popover or sheet with the larger SVG plant.
  - Plant art: 5 stage SVGs (≤ 3 kB each, inline, M3 tones of the seed colour). Wilting is drawn as a droop transform
    plus reduced saturation by mood. It is never brown or dead.
  - Best streak shows in Settings (`settings-best-streak`).
- **Sunflower field** (`sunflower-field`, `aria-label` "Sunflower field: N flowers", `data-mood`; children `sunflower`).
  It is the front of the Sunflower field *scene* (below) and shows whenever that scene is chosen:
  - Count: `Settings.sunflowers` = `grow` (default) shows `plant.flowers` (one per 40 points, at most 30, with the
    `bloom` effect); `full` shows a fixed full field (30, no growth, no bloom). Phones (< 600 px) show at most 15 of
    either; the label states the mode's count (the full count, not the visible one). The setting is global but
    inactive (shown, options disabled) with the hint "Applies to the Sunflower field scene" (`settings-sunflowers-hint`)
    while the person's scene is another one. Wording and code stay open for a later general flower field with
    several flower styles; nothing is built for that now.
  - Drawn in the background layer of the top app bar, behind the title and buttons. Low contrast: the flowers use
    `--md-sys-color-surface-container-highest` and tertiary tones at ≤ 35 % opacity in both themes. Text contrast
    stays ≥ 4.5:1.
  - One SVG `<symbol>` is reused via `<use>` per flower, with random-but-seeded size and height variation (seed = flower
    index).
  - Sway is a pure CSS keyframe on `transform: rotate()` with per-flower `animation-delay`. It is paused through
    `animation-play-state` when hidden or when the motion level is not Full. No per-frame JS.
  - Moods: droop (rotate down) and fade (lower opacity and saturation) by plant mood. Flowers are never removed. A new
    flower grows in (`bloom` effect).
  - Cost (30 flowers): one CSS animation per flower on the compositor-friendly `rotate` property of its wrapper (no
    per-frame JS, no filters on the flowers), so at most 30 composited layers plus the landscape's few animations
    (3 clouds, 2 bees). All animations run only at motion Full while the page is visible.
- **Sunflower field scene** (`SunflowerScene`, `top-bar-scene[data-scene="sunflowers"]`): a subtle landscape behind
  the field, built like the season scenes (`SunflowerLandscape.vue`, a `SeasonScene` sibling): a sky gradient (`sky`),
  soft rolling hills (`hills`), 2–3 slowly drifting clouds (`cloud`) and a couple of bees (`bee`) that cross now and
  then (one pass every 20–30 s, mostly absent). Light and dark variants from the theme tokens (a pale blue sky into
  warm haze by day, deep blue into a soft glow by night), low contrast so the title keeps ≥ 4.5:1. Drift and bees run
  only at Full; Reduced and Off show a still picture. The once-per-session butterfly stays.
- **Butterfly** (`reward-effect[data-kind="butterfly"]`): once per session (`sessionStorage` flag), on app open,
  only if `flowers ≥ 1` and the motion level is Full. A small SVG butterfly flies in, lands on a random visible
  sunflower, flaps (CSS keyframes on two wing paths), flies away and is removed after ≤ 4 500 ms. It has
  `pointer-events: none` and sits beneath the buttons' hit areas (z-order below the top app bar actions). It is the
  only effect allowed to exceed the 1 200 ms effect timeout.

### 5a. Resource efficiency and leak prevention (hard requirements)

Budgets (verified by `@perf` scenarios and build checks, ACCEPTANCE AC-55 … AC-62):

| Budget | Limit |
|---|---|
| Initial JS (compressed as Chromium negotiates it, i.e. Brotli on localhost/HTTPS; first load, all scripts) | ≤ 150 kB |
| Initial CSS (compressed) | ≤ 30 kB |
| Lighthouse mobile performance on localhost (production build), median of 3 runs | ≥ 70 |
| Month view with data rendered after navigation start (LAN / localhost) | ≤ 2000 ms |
| Frontend heap growth after 50× view cycles + 50× dialog open/close + 50× task list expand/collapse (after GC) | < 10 % |
| DOM nodes and JS event listeners growth, same workload | < 10 % |
| Detached DOM from closed dialogs/sheets | none retained |
| Server RSS idle (after start + GC) | ≤ 100 MB (owner 2026-10-13: bare node alone idles at ~46 MB on the host) |
| Server RSS growth over 5 000 reads + 500 item writes (after GC) | < 20 MB |
| Container image size | ≤ 200 MB (target, not a test gate) |

Rules for implementers:

- **Frontend**: every `setInterval`/`setTimeout`, `addEventListener` (window, document, media queries),
  `ResizeObserver`/`IntersectionObserver`/`MutationObserver` and store subscription is registered through a helper
  that removes it on component unmount / store dispose (e.g. a `useEventListener`/`useInterval` composable). Exactly one
  polling timer exists app-wide (owned by the sync store), paused while `document.hidden` and resumed with one immediate
  fetch on `visible`. In-flight requests are aborted (`AbortController`) when the range changes or the component
  unmounts. Item caches keep at most the visible range ± 1 period (LRU of 6 ranges). Dialogs and sheets are removed
  from the DOM when closed (`v-if`-style, not hidden) and release references to the edited item. No global arrays that
  only grow (logs, histories).
- **Server**: no per-request global state; provider responses are not cached (or bounded LRU with TTL if added); the
  mock store writes debounced (≤ 1 write per 200 ms, coalesced) and does not keep history; HTTP keep-alive agent with
  bounded sockets for Google; logger at `info` without request bodies. Start with `--max-old-space-size=96` (tunable)
  in the container; `--expose-gc` only when `TEST_MODE=true`.
- **Battery**: polling pauses when hidden; no animations running while idle; no `requestAnimationFrame` loops.

### UI test contract (`data-testid`)

| testid | Element / attributes |
|---|---|
| `app-shell` | root |
| `top-bar`, `bottom-bar` (`data-safe-area`) | top app bar; navigation bar (phones) / rail (desktop) |
| `settings-button`, `filter-button` | top app bar actions |
| `settings-view`, `settings-back` | settings page |
| `settings-theme-mode` | segmented button; options with `data-value="system\|light\|dark"`, `aria-pressed`, labels System/Light/Dark |
| `settings-seed-preset` | swatches with `data-name`, `data-color`, `aria-pressed`; `settings-seed-custom` (hex text field, Enter/blur applies), `settings-seed-error` |
| `settings-default-view`, `settings-default-event-color` | selects (option labels as in the features) |
| `settings-category` | list rows with `data-category-id`, `data-name`, `data-color`; `settings-category-add` |
| `category-dialog` | `category-name`, `category-color` (hex text field), `category-icon`, `category-error`, `category-save`, `category-cancel`, `category-delete` |
| `view-switch-year`, `year-view`, `year-month`, `year-day` | year view (§5b) |
| `month-picker`, `month-picker-title`, `month-picker-prev`, `month-picker-next`, `picker-day` | month picker (§5b) |
| `now-marker`, `now-card`, `now-card-line`, `now-card-current`, `now-progress` | timeline (§5b) |
| `transition-warning`, `transition-warning-dismiss` | snackbar |
| `task-tray`, `task-tray-toggle`, `task-tray-count`, `task-tray-item`, `task-tray-title` (finished rows), `task-tray-unfold` | open tasks tray; open rows contain a `tasklist-view` |
| `tasklist-card-overdue`, `tasklist-card-estimate`, `tasklist-progress-ring`, `tasklist-complete-message` | task list additions |
| `tasklist-estimate`, `tasklist-repeat` | task list dialog fields |
| `reward-effect` (`data-kind`) | effect overlay elements |
| `streak-flame`, `streak-message`, `plant-button`, `plant-card`, `plant-card-stage`, `plant-card-line`, `settings-best-streak` | motivation |
| `settings-animation-level` (options Full/Reduced/Off), `settings-sounds`, `settings-calm-mode`, `settings-transition-warning` (Off/5 min/10 min/15 min), `settings-streak-flame` (switch), `settings-plant` (switch, default on), `settings-sunflowers` (Grow with points/Full field) | settings additions |
| `filter-bar` | `filter-chip-category` (`data-name`, `data-category-id`, `aria-pressed`), `filter-chip-tag` (`data-name`, `aria-pressed`), `filter-clear` |
| `period-title` | text per §5 |
| `nav-prev`, `nav-next`, `nav-today` | buttons |
| `view-switch-month`, `view-switch-week`, `view-switch-day` | tabs (`aria-selected`) |
| `view-switcher` | container of the tabs (`data-position` = `bottom` \| `top` \| `rail`); `bottom-bar` carries `data-position` too; the top tabs row is `nav-tabs` |
| `create-button`, `new-kind`, `new-kind-event`, `new-kind-tasklist` | FAB and the one "new" dialog (no create menu) |
| `calendar-swipe-area` | swipe target wrapping the active view |
| `month-view`, `week-view` (`data-week-start`), `day-view` (`data-date`) | view roots |
| `month-weekday-header` | 7 elements, text `Mon`..`Sun` |
| `month-cell` | `data-date`, `data-today="true"` on today, `data-outside-month="true"` |
| `month-cell-day-number` | inside a cell (no overflow element: entries fade out) |
| `week-header` | `data-date`, `data-today`, text `Mon 12` |
| `week-allday-cell` | `data-date` (all-day area per day) |
| `week-day-column`, `day-column` | `data-date` (timed area) |
| `day-header` | `data-date`, `data-today` |
| `day-allday-area` | `data-date` |
| `time-grid` | `data-hour-height` (px) |
| `time-slot` | `data-date`, `data-hour` (clickable, creates event) |
| `event-chip` | `data-event-id`, `data-title`, `data-date` (segment day), `data-all-day`, `data-start-time`, `data-end-time` (segment, `24:00` if it continues), `data-color`; child `event-chip-title`, `event-chip-time` |
| `resize-handle-top`, `resize-handle-bottom` | inside the block of the entry being resized (`event-chip` / `tasklist-card`) |
| `tasklist-card` | `data-tasklist-id`, `data-title`, `data-date`, `data-time` (`""` if none), `data-color`, `data-category-id` (`""` if none); children `tasklist-card-icon` (only with a category icon), `tasklist-card-title`, `tasklist-card-items` (text = titles joined `, ` or `No items`) with one `tasklist-card-item` (`data-title`) per item, `tasklist-card-count` (`1/3`), `tasklist-card-time` |
| `tasklist-expanded` | `data-tasklist-id`, `data-title`, `data-presentation="sheet\|popover\|overlay"` (overlay = the card grown in place over the calendar, "Expanded task list card": `data-readonly="true"`, contains one `tasklist-card-grown` (the card rendering, `tasklist-card-title`, `tasklist-card-item` with `data-done`, `tasklist-card-count`, `tasklist-card-time`, the layers `tasklist-grown-real` and `tasklist-grown-ext`), no `tasklist-view`); the sheet and popover contain a `tasklist-view` (also used in the tray) with children `tasklist-expanded-title` (click → `tasklist-expanded-title-input`), `tasklist-expanded-count`, `tasklist-item` (`data-item-id`, `data-title`, `data-done`), `tasklist-item-checkbox`, `tasklist-item-title` (click → `tasklist-item-title-input`, Enter commits, Escape cancels), `tasklist-item-delete`, `tasklist-item-up`, `tasklist-item-down`, `tasklist-add` ("Add item" button in the footer row beside `tasklist-edit` and `tasklist-delete`, click → `tasklist-new-item`, Enter adds, stays open for the next item, closes when left empty), `tasklist-collapse` (chevron in the head, `aria-expanded`; the `tasklist-view` root has `data-collapsed`), `tasklist-edit`, `tasklist-delete`, `tasklist-close`, `tasklist-expanded-tag` (one per tag, `data-name`) |
| `event-dialog` | `data-presentation="sheet\|modal"`; `event-title`, `event-all-day` (checkbox), `event-start-date`, `event-start-time`, `event-end-date`, `event-end-time`, `event-description`, `event-location`, `event-calendar` (select, option labels = calendar names), `event-color` (radio group/select, option labels `Calendar color` + Google color names, order: Calendar color, Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite), `event-error`, `event-save`, `event-cancel`, `event-delete` |
| `tasklist-dialog` | `data-presentation`; `tasklist-title`, `tasklist-date`, `tasklist-time`, `tasklist-category` (select: category names + `No category`), `tasklist-tags` (comma-separated text), `tasklist-items` (textarea, create only), `tasklist-error`, `tasklist-save`, `tasklist-cancel` |
| `view-switch-tasks`, `tasks-view` | Tasks view destination and root (`data-group-by`, `data-sort-by`) |
| `tasks-group-by` | segmented button, options `data-value="time\|category\|none"`, labels Time/Category/None, `aria-pressed` |
| `tasks-sort-by` | select, labels Date/Name/Category/Last changed/Progress |
| `tasks-collapse-all` | one toggle after the sort controls: collapses every list shown in the Open tab, or expands them all when all are collapsed (`aria-pressed="true"` = all collapsed) |
| `tasks-sort-dir` | toggle button next to it, `aria-pressed="true"` when reversed, `data-dir="default\|reversed"` |
| `tasks-group`, `tasks-group-title` | one group (`data-group`: `overdue\|today\|week\|later\|nodate`, a category id or `none`) and its heading text |
| `tasks-item` | one list: `data-tasklist-id`, `data-title`, `data-date` (`""` when undated); contains a `tasklist-view`, `tasks-today`, `tasks-tomorrow` |
| `tasklist-no-date` | "No date" toggle in the task list dialog (`aria-pressed`) |
| `tasks-filter-bar` | the Tasks view's one filter row (all three tabs): `tasks-filter-category` (chip, `data-id`, `aria-pressed`), `tasks-filter-when` (chip, `data-value`) with the menu options `tasks-filter-when-option` (`data-value`), `tasks-filter-clear` (only while a filter is on) |
| `tasks-tab-canvas` | the Canvas tab (`aria-pressed`); the tab's content is `tasks-canvas` |
| `tasks-canvas`, `canvas-viewport` | Canvas root and its viewport; `canvas-viewport` has `data-zoom`, `data-pan-x`, `data-pan-y` |
| `canvas-note` | one sticky note (picked up by a long press anywhere on it): `data-tasklist-id`, `data-title`, `data-date` (`""` when undated), `data-x`, `data-y` (top-left corner in canvas units, rounded), `data-placed` (`"true"` once it has a place), `data-area` (name of the area it lies in, `""` = none), `data-dimmed` (`"true"` when the Tasks filter does not match); contains a `tasklist-view`, `canvas-note-grip` (the top strip, where a mouse can grab it, with `canvas-note-date` when dated) |
| `canvas-unsorted` | the "Unsorted" label above the stack of notes without a place |
| `canvas-area` | one area: `data-area-id`, `data-name`, `data-color`, `data-x`, `data-y`, `data-w`, `data-h`; `data-selected` while its handles show; contains `canvas-area-header` (tap opens the editor) and, while selected, four `canvas-area-handle` (`data-corner`) |
| `canvas-area-add` | creates an area in the middle of the view and opens its editor |
| `canvas-area-editor` | the editor panel: `canvas-area-name-input`, `canvas-area-color` (one per swatch, `data-color`, `aria-pressed`), `canvas-area-delete`, `canvas-area-editor-close` |
| `confirm-dialog`, `confirm-ok`, `confirm-cancel` | delete confirmation |
| `sync-status` | `data-state`, `data-last-sync` |
| `sync-error-banner`, `sync-retry` | error strip |
| `install-app-button` | shown only after `beforeinstallprompt` and when not standalone |
| `ios-install-hint`, `ios-install-hint-dismiss` | iOS Safari hint |

## 6. PWA

- Service worker generated at build time (e.g. vite-plugin-pwa/Workbox per BRIEF, or a hand-written one ≤ 5 kB if
  RESEARCH.md decides so); auto-update with skip-waiting + clients-claim.
- Precache the app shell (HTML, JS, CSS, icons). `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api\//]`.
  **No runtime caching for `/api/*`** (NetworkOnly) — the app's own store/`localStorage` handles last-known data.
- Manifest `/manifest.webmanifest`: `name` "Calendar", `short_name` "Calendar", `description`, `start_url` "/",
  `scope` "/", `display` "standalone", `orientation` "portrait", `theme_color` "#1a73e8", `background_color` "#ffffff",
  icons `/icons/icon-192.png` (192×192), `/icons/icon-512.png` (512×512), `/icons/icon-maskable-512.png`
  (512×512, `purpose: "maskable"`).
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
  `theme-color`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" sizes="180x180">`,
  `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=default`,
  `apple-mobile-web-app-title=Calendar`, `mobile-web-app-capable=yes`.
- Registration only if `'serviceWorker' in navigator && window.isSecureContext`; otherwise skip silently. The app must
  work fully without a service worker.
- **Install UI** (`web/src/pwa/install.ts`): listen for `beforeinstallprompt`, `preventDefault()`, keep the event, show
  `install-app-button`; click → `event.prompt()`, hide afterwards. Hide when `appinstalled` fires or when running
  standalone (`matchMedia('(display-mode: standalone)').matches || navigator.standalone`).
  iOS Safari (UA has `iPhone|iPad|iPod`, `Safari`, and not `CriOS|FxiOS|EdgiOS`) and not standalone → show
  `ios-install-hint` "Tap Share, then Add to Home Screen" with dismiss; dismissal stored in `localStorage`
  (`cal.iosHintDismissed`).

### Secure-context constraint

Service workers and Chrome's install prompt require HTTPS (localhost is exempt). `http://cal.mordor.local` is **not** a
secure context: there the app runs without service worker and offline shell; Android Chrome only offers "Add to Home
screen" as a browser shortcut; iOS "Add to Home Screen" works (standalone window via the meta tags) but without
offline support. Full installability therefore needs HTTPS — an owner action (§9).

## 7. Testing

- `server/`: Vitest. Unit: `TaskListCodec` (chunking, mirror, description fallback), validation, `MockGoogleProvider`
  semantics (etag, 412, cancelled, persistence round-trip), `GoogleProvider` with mocked HTTP. Integration: every
  endpoint via `fastify.inject` incl. error codes and test endpoints (and their 404 when `TEST_MODE` is off).
- `web/`: Vitest + @vue/test-utils + jsdom: date utilities (grids, titles, overlap packing, ordering), stores (sync
  merge, optimistic rollback), key components.
- `e2e/`: Playwright 1.48.2 + playwright-bdd, `features: '../spec/features/**/*.feature'`, steps per `STEPS.md`.
  Runs inside `mcr.microsoft.com/playwright:v1.48.2-noble` against a production build of the server started with
  `TEST_MODE=true PROVIDER=mock SEED=false DATA_DIR=<tmp> POLL_INTERVAL_MS=30000` on `http://localhost:<port>`
  (secure context → service worker testable). `workers: 1` (shared backend state, 1 GB RAM).
  Projects: **`mobile` (default, first)**: Chromium, viewport 375×812, `isMobile`, `hasTouch`, Android Chrome UA,
  `grepInvert: /@desktop/`; **`desktop`**: Chromium 1280×800, `grepInvert: /@mobile|@perf/`.
  `@perf` scenarios need Chromium (DevTools protocol for GC/heap/DOM counters, Lighthouse for the audit) and a
  server started with `--expose-gc` (test mode only). Context:
  `timezoneId: 'Europe/Berlin'`, `locale: 'en-GB'`. `@smoke` scenarios can run against the deployment with
  `E2E_BASE_URL` and `--grep @smoke`.
- `spec/scripts/check-steps.py` must pass (every step has exactly one expression in STEPS.md).

### Sign-in and per-person Google access

- **Auth switch**: on when `PROVIDER=google` (the real VPS instance), off with `PROVIDER=mock` (sauron, previews):
  owner decision, previews stay one tap away on the LAN. In `TEST_MODE` a test endpoint turns it on with an allow-list
  (`POST /api/__test/auth { allowedEmails }`), so the e2e suite tests sign-in against the mock provider.
- **One OAuth round trip** signs in and connects the calendar: scopes `openid email` + calendar + `drive.appdata` (backups, ARCHITECTURE "Backups"). The callback reads the
  verified email from the `id_token`; only addresses in `ALLOWED_EMAILS` get a session, others are sent to the private
  page and their tokens are discarded.
- **Sessions**: random 256-bit id in cookie `cal_session` (`HttpOnly`, `Secure` when `PUBLIC_URL` is https,
  `SameSite=Lax`, `Path=/`). Server side in `DATA_DIR/sessions.json` (`id → { sub, email, name, expiresAt }`), 90 days,
  `expiresAt` pushed forward on use (at most once an hour, to limit writes). Sign-out deletes the entry.
- **Per-person Google access**: the refresh token lives in `DATA_DIR/users/<google sub>/google-token.json` (0600). The
  provider is resolved per request from the session's person (one OAuth client per person, cached); the old single
  `DATA_DIR/google-token.json` is used for the first person who signs in only if Google returns no refresh token.
  `/api/health` no longer pings Google once access is per person (there is no person to probe with). In mock mode with auth on, each person
  has their own mock calendar data. Settings, categories, streak and plant stay shared in this slice (per-person data
  is the next slice).
- **Client**: a `/signin` route (public) with the "Sign in with Google" button and the private notice
  (`signin-page`, `signin-google`, `signin-private`); a router guard calls `/api/auth/me` once and sends 401 to
  `/signin` and remembers the page asked for (sessionStorage), which `/` returns to after signing in. A 401
  `GOOGLE_REAUTH` from any call shows the banner `reauth-banner` with a button back to
  `/api/auth/google/start`. Settings get `settings-signout`.
  `CALENDAR_PERMISSION_MISSING` (403) or `/?calendar=missing` shows `calendar-access-banner` (button
  `calendar-access-grant` back to `/api/auth/google/start`, hint names the checkbox) and Settings -> Account & data
  shows `settings-calendar-access` while it is missing. The stored scope never replaces Google's own answer: tokens
  without a recorded scope are judged by Google's 403. Cached per-person providers (they hold the OAuth client with the
  old access token) are dropped when the callback stores a new token and at sign-out (`ctx.forgetPerson`).

### All calendars and hiding them

- `listCalendars` returns every calendar in the person's Google calendar list (own and shared), not only
  `GOOGLE_CALENDAR_IDS`; events of all of them are listed. Each keeps its Google colour.
- Hidden calendars are kept per person in `DATA_DIR/users/<sub>/prefs.json` (`{ hiddenCalendars: string[] }`); with
  auth off a single person `local` is used. `GET /api/calendars` adds `hidden: boolean`; `PATCH /api/calendars/:id
  { hidden }` stores it.
- The client filters instantly (hidden calendars' entries are not drawn) and saves in the background; the filter bar
  gets one chip per calendar (`filter-chip-calendar`, `data-name`, `data-calendar-id`, `aria-pressed` = shown).

### Reduced motion override (owner, 2026-10-12)

Windows ("Animation effects" off), macOS and phones report `prefers-reduced-motion: reduce`; the app then caps the
animation level at Reduced (no particles). Settings show a hint while the device asks for less motion and a switch
`ignoreSystemMotion` (per person, default off) that lets the app's own level apply.
### Back closes overlays (owner, 2026-10-12)

In the Android app the system back reaches this through the WebView history ("Android app and widget", System back).

Every overlay (expanded task list, dialogs and sheets, the expanded phone tray, filter bar, month picker, create menu)
pushes a history entry when it opens (`history.pushState` with an overlay marker, no route change) and closes on
`popstate`; closing it by other means goes back over its entry. So the system back gesture/button closes the topmost
overlay first and only then leaves the view. This covers Android's back gesture/button and iOS Safari's edge swipe (both go back in
history). Whether an installed iOS home-screen app offers a back swipe at all is to be checked on a device (owner). One small overlay-stack helper (`web/src/lib/overlayHistory.ts`) used by
all overlays; no per-component history code.
### Delete with undo (owner, 2026-10-13)

- Events, task lists and task list items are deleted with one tap, no confirmation dialog (owner: undo is enough).
  Category deletion keeps its confirmation.
- The entry disappears at once (optimistic) and the shared `Snackbar` shows "Deleted: <title>" (item: the item
  title; untitled list: "List") with "Undo" for 6 s (`undo-snackbar`, `undo-action`). The DELETE request is sent only
  when the snackbar times out (owner: "hide, delete later"): undo then needs no request, keeps the Google id and its
  details. One pending delete at a time: a new delete sends the previous one at once. `pagehide`/`visibilitychange →
  hidden` sends pending deletes immediately with `fetch(…, { keepalive: true })`. In-app navigation does not.
- A small `pendingDeletes` store owns the timers; the items store hides pending ids (same filter as the deleted-id set
  of the stale-poll fix) and a failed delete brings the entry back with the sync error banner.
- Item delete = `DELETE /api/tasklists/:id/items/:itemId` after the timeout; undo restores the item at its index.

### Snackbars and toasts follow the theme (owner, 2026-10-13)

Every snackbar-like surface — the undo and update snackbars, the transition warning, the sync error banner and the
check-in toast (`streak-message`) — uses the one `Snackbar` look built from the active theme's tokens
(`surface-container-highest` / `on-surface`, action in `primary`, the theme's corner radius and glow; owner
2026-10-13: not M3's inverse colours, which turn white on a dark theme), never fixed colours, so a theme or automatic season change restyles them too.

### Labs (experiments, owner 2026-10-12)

- Settings get a Labs section: `labs` (experimental views on/off); `approachBar` (on/off, default on since
  2026-10-13, now in the Calendar section next to the window, no longer Labs), stored per person in
  `prefs.json` (`GET/PATCH /api/prefs`, same store as themes and hidden calendars). Testids `settings-labs`,
  `settings-approach-bar`. `labsOwnThemes` (default off) shows the own-theme part of the theme menu (see "Theme engine
  and AI themes").
- Routes always exist: `/clock/:date`, `/timeline`, `/strip/:date`. With `labs` on, the view switcher adds them with a
  flask mark (`view-switch-clock|timeline|strip`, `data-experimental="true"`); off, they are not offered. A hidden
  view stays reachable by URL; switching off the view in use only drops its tab, the person stays on the page.
- **Which Labs views (owner 2026-10-14).** With `labs` on, the Labs section lists one switch per Labs view
  (`settings-labs-view-<id>`). The views are one registry, `LABS_VIEWS` in `web/src/features/labs/labs.ts` (id, label
  key, icon, route, `defaultOn`): a new view appears as a switch and a tab by adding one entry. Defaults: Clock on,
  Timeline on, Strip off (kept, not removed). The per-person pref `labsViews` (`Record<id, boolean>`) stores only
  explicit choices; an id without a choice follows the registry's `defaultOn`, an id the registry does not know is on.
  Why a record of choices and not a list of disabled ids: Strip is off by default, so a plain disabled list would make
  the server know the registry's defaults; with explicit choices the registry stays the one source of defaults and a
  new view still defaults to on (assumption: that is why the owner preferred disabled ids).
- Routes always exist: `/clock/:date`, `/timeline`, `/strip/:date`, `/zoom/:date`, `/horizontal/:date`. With `labs` on, the view switcher adds them with a
  flask mark (`view-switch-clock|timeline|strip|zoom`, `data-experimental="true"`); off, they are not offered.
- Each experiment is its own component folder under `web/src/features/labs/<name>/` and reads the existing items
  store (no new server API). Tracer bullets: correct placement and navigation first, polish later.
- Clock: SVG 24-hour circle as large as the view allows (owner, 2026-10-13), events as arcs labelled with their
  titles, timed task lists as arcs too (estimate, else 30 min; thinner or dashed, labelled "title done/total"),
  hand at the app clock (`clock` store), progress ring.
  **Clock v3 (owner, 2026-10-13: "flesh out the clock view so that it becomes much more usable")**: the clock is a full
  calendar view, not just a picture.
  - *Open*: a tap on an arc or its label opens the entry (`openItem`: event dialog, expanded task list; timed task lists
    too). Each arc has a 26-unit invisible stroke over it (`clock-arc-hit`, `role="button"`, focusable, `aria-label`
    "title, start to end"), so thin arcs are easy to hit; the drawn arc ignores the pointer.
  - *Move*: a long press (350 ms, touch/pen/mouse held still; a mouse also picks up after 4 px of movement) picks the arc up
    (lifted: thicker, shadow, haptic tick per 15-minute step) and it turns round the dial with the pointer: the pointer's
    turn is accumulated with `wrapDelta` (so crossing midnight is a small step, not a jump of 24 h), the start snaps to
    15 minutes and the arc stays on the day (`turnedStart`). The middle shows where it would land (`clock-drag-time`).
    Release saves with the time grid's `applyMove` (optimistic, spring back + snackbar on failure). Esc cancels. Touch
    scrolling is blocked only while an arc is held; a touch that moves before the long press cancels it (swipe to the next
    day still works).
  - *Resize*: a long press released in place selects the arc (`data-selected`): a handle (`clock-handle`, `data-edge`
    `start|end`, `role="slider"`) sits on each end; dragging one changes the start or the end via `resizeEdges` /
    `finishResize` (same limits as the time grid: ≥ 15 min, task lists ≤ 720 min). A tap on the plate or Esc clears it.
  - *Create*: a tap on the empty plate (outside the middle, radius ≥ 56) opens the "new" dialog at that time
    (`tappedTime`, nearest quarter hour). With an arc selected the tap only clears the selection.
  - *Keyboard*: on a focused arc Enter/Space opens, Alt+←/→ moves by 15 min, Alt+Shift+←/→ changes the end; on a handle
    Alt+←/→ moves that edge.
  - *Middle*: today the time and under it the Approaching card's text (`nowCardModel`: "Dentist · 40 min left" or
    "Next: Gym in 2 h") in `clock-now-line`; a *focus wedge* (`clock-wedge`, `focusWedge`) shades the sector from the
    hand to the end of the running event, else to the start of the next one, in that event's colour: the remaining time as
    an area, like a Time Timer (ADHD-RESEARCH 1.1, 1.2, 1.12, R31). The hand is drawn under labels and text, which have a
    halo.
  - *Lists next to the dial*: untimed task lists (`clock-untimed`) and all-day events (`clock-allday`) are chips beside the
    dial: below and above it on an upright screen, left and right of it on a wide one (container query on the view,
    aspect ≥ 5:4). Before, they were text rows in the middle, which collided with the labels and the hand.
  - *Labels* (`placeLabels`): longest arcs first, each label starts inside the innermost lane on its arc's angle and moves
    inwards row by row, trying ±20/40 minutes round, until its estimated box (0.56 em per character) is free of the earlier
    labels and of the middle; labels near the top or bottom are centred, the others point inwards. A label that fits
    nowhere is left out (its arc still opens and names itself in the tooltip and `aria-label`).
  - Swipe navigation is told about a held arc through `claimGesture()` (motion), like the time grid's drag.
- Approach bar (owner v3, 2026-10-13: "the next-event element becomes the timeline", then absolute and configurable):
  no bar of its own; with `approachBar` on, the now card's "Next:" line is replaced by a track (`approach-bar`) inside
  the now card, and no "Next:" text shows anywhere while it is on. The track is an absolute time axis: left end
  `approach-now`, right end now + `approachWindowHours` (3 | 6 | 12, Labs setting `settings-approach-window`, per
  person in prefs, default 3; any whole number 1–24: one choice 3 h / 6 h / 12 h / Custom…, the hours field `settings-approach-window-custom`
  only shows for Custom… or a custom value (owner: no duplicate controls),
  owner 2026-10-13). Time labels (`approach-tick`, HH:MM) at the smallest step of 15 min / 30 min / 1 h /
  2 h / 3 h whose labels do not collide at the current width (dynamic scaling). All timed entries of today (open task lists carried over to today count with their time, owner 2026-10-13)
  that start within the window (owner, 2026-10-13: all, not only the next three) (events and task lists with a time, by start); entries already running stay on the
  track (owner, 2026-10-13): their block starts at "now" and shows only the time left, so they slide out to the left
  as time passes and leave when they end as chips
  at their start position; when none is within the window, the next timed entry of today sits at the right end
  (`data-at-end="true"`, label "in 5 h" on the card colour so the track line does not strike it through). Each entry is a block as long as its duration on the track's scale (owner, 2026-10-13: entries take up only the
  time they take); the title sits inside when it fits, else right after the block (`data-title-outside="true"`) on the card colour, so the track line has a gap there and the title never looks struck through (owner), so
  a short entry on a phone or in a 6/12 h window shows a short block followed by its title. Blocks use the entry's
  colour like `ItemView` chips (reuse its colour/skin and open handling) but show only the title: no time, estimate,
  done count or item preview (owner, 2026-10-13: a narrow block must not leak card internals); tap opens the entry. A block is at least
  4 px wide. Overlapping chips take a second row and the card grows; beyond two rows they stay in two rows,
  shortened and overlapping with a fade, so the card never grows further (owner: "don't take too much space").
  Nothing ahead today → the usual "Nothing else today" line. The current-event and next-task lines are unchanged.
- Owner feedback (v2): every experiment shows time to scale (an item's length is proportional to its duration, never
  equal sizes) and uses the whole available space; all-day entries get their own band above the timed area.
- Zoom month (owner, 2026-10-14: "a canvas calendar, like the month view, but you can zoom in and out"; route `/zoom/:date`,
  `web/src/features/labs/zoom/`): the month grid on a world of `viewport x zoom` px. Zoom is continuous, 1 (the whole month
  fits) to 7 (one day as wide as the viewport), remembered per session in `sessionStorage` `cal.zoomMonth` (not a pref).
  - *Detail follows the cell size, not a mode* (`zoom.ts`, pure): the cell size is computed from the viewport and zoom (never
    measured per cell), and `detailAt(w, h)` turns its geometric mean `s` into weights that fade with smoothstep: dots out
    85..120, title chips in 80..115, start times in 153..157, task lists growing from a chip to the full card (`TaskListCard`,
    height by need, `allotHeights`) 154..158, mini day timeline (`ZoomTimeline`: untimed band with every task item as a
    full card over a time grid, blocks as `ItemView` `block`) 152.8..167.9 (`TIMELINE_REF`, the owner's 115 x 245 px cell; 2026-10-14), which replaces the chips by crossfade in every cell at once. The grid covers only the whole hours the day's timed items span (`timeSpan`), blocks sit at their real top and duration height, overlaps use `packColumns` (lanes/cascade as the day view). (The per-day `realTimeFits` gate of the first version is gone, see the next bullet.) Why a scoped class must not be `.tl`: it lands on the task list card's root `.tl` and made every card fill its cell behind later rows (owner: "lists shown behind everything"). Layers are
  - **One switch for every cell (owner, 2026-10-14, two screenshots: "a weird mixture", some cells real times, some chips)**:
    the per-day `realTimeFits` decision is dropped. Whether the cells show the time grid or the chips depends **only on the
    zoom level**, the same for every visible cell, so the month never mixes the two. The switch comes earlier than
    before: at the latest when about 3.5 day columns fit across a phone screen (the owner's second screenshot, a cell of
    roughly 115 x 245 CSS px), on desktop at the same cell size. Items too short for the minimum block height get the
    minimum height (25 px) and, when that overlaps a neighbour, their own lane through `packColumns`, exactly as in the
    day view; they never keep a day on chips. **Shared hours per week row** (assumption, not owner-confirmed): all cells
    of a week row use the same whole-hour span (earliest start to latest end of the row's timed items, at least 4 h), so
    side-by-side days are comparable and one early event only stretches its own week. Untimed items stay in the band
    above. **Why**: a per-day fit made neighbouring cells use different layouts at the same zoom; a single zoom
    threshold is predictable and is what the owner asked for.
    mounted only while their weight is above 0.01. Cells further than half a viewport from the visible part draw only their number.
  - *Gestures* (`zoomGestures.ts`): pinch, Ctrl/Cmd+wheel and trackpad pinch (Ctrl+wheel) zoom about the gesture point
    (`panAfterZoom`); drag and wheel pan; the zoom buttons (`zoom-in`/`zoom-out`, in the header, step x1.25 about the
    middle) are the accessible path. During a gesture ONLY a CSS transform changes (set directly on the DOM, no Vue
    render); the grid is laid out once when the gesture ends (all fingers up, or 140 ms after the last wheel event).
    The viewport is measured with `box: 'border-box'` and its size does not depend on its content, as in the month view's
    measuring-loop fix (no feedback loop). Pan is clamped so the world covers the viewport.
  - *Interactions as in the month view*: a tap on a day (number or empty space) opens the day view; on a phone a tap on an entry
    opens the day, on desktop it opens the entry (event dialog, expandable task list card). No new editing; mouse drags on
    entries stay with the calendar's drag and drop (`data-zoom-nopan`), a finger drags the surface.
  - *No bottom control*: the zoom buttons sit in the view header, so the "+" FAB cannot cover them (no overlap scenario).
  - Why not discrete levels (rejected): owner asked for "stufenlos"; why a transform and not native scroll: pinch anchoring and
    smooth live zoom need one transform; why `sessionStorage`: owner, "per session, not on the server".
- Horizontal view (owner, 2026-10-14: "time runs horizontally"; route `/horizontal/:date`, Labs registry
  entry `horizontal`, `web/src/features/labs/htime/`): the week is seven day rows with the hours as columns and lanes. There is
  no day mode (owner, 2026-10-14: a few days zoomed in replace it; an old `?mode=day` link is rewritten to the plain week).
  The route has `meta.noSwipe`, which `App.vue`'s `swipeDisabled` honours: before, the shell's instant swipe (Labs views have
  no live carousel) took a sideways pan for "next period" and changed the week. Previous/next week are the header buttons. Cards get wider instead of taller, so a task list has room for its items. It is the zoom month's world again: laid out
  once per committed zoom, moved by one CSS transform while a gesture runs, with the sticky hour axis (top) and day labels (left)
  following the same transform on one axis each; viewport measured with `box: 'border-box'`, no measuring loop.
  - *Two zooms* (`htime.ts`, pure): time `x` (1 = 24 h fit the width, up to 24; pixels per hour = `vw * x / 24`) and days `y`
    (1 = the seven rows fit the height, up to 3 = about two and a half days fill it). The gesture controller (`zoomGestures.ts`) now keeps
    a zoom per axis and takes a `ZoomModel` (limits, world size, which axes the wheel zooms): the zoom month's model zooms both
    alike. Pinch zooms both axes by the finger distance ratio; Ctrl/Cmd+wheel zooms time, Shift+Ctrl/Cmd+wheel or Alt+wheel the
    day height; `htime-time-in/out` and `htime-day-in/out` in the header; drag and wheel pan (Shift+wheel pans sideways).
    Remembered per session in `sessionStorage` `cal.zoomHTime` (`{x, y}`).
  - *Layout*: x from the start minute, width = duration (at least 28 px); all-day and untimed entries are full-width bars above
    the lanes; overlapping entries share lanes, the vertical sub-rows of the room under the bars (`packColumns(..., stack=false)`:
    no cascading, so a cluster never overlaps itself); a row grows when its bars and lanes need more than the base height. All
    of it is computed from viewport and zoom (`layoutRows`), never measured.
  - *Entries* are `ItemView` (events as `block`, bars as `allday`/`chip`/`card`). Tapping an event opens it as in the week view; a
    tap on a day label opens that day's Day view. A task list tap uses the week view's expansion unchanged: `ExpandedCard`
    overlays a copy of the card at the card's left, top and width (its real duration), growing down (up when the screen ends)
    over the rows below, read-only; a second tap opens the list sheet. Any pan or zoom ends the expansion.
  - *No bottom control*: all buttons sit in the header, so the "+" FAB cannot cover them (no overlap scenario).
  - Why a second set of rows rather than a rotated month: the owner's goal is room beside the card for task items, and the
    lane transposition needs real durations on x; why `packColumns` with `stack=false`: its cascade would offset blocks
    by their start gap, but lanes must never overlap.
- Timeline (owner: vertical everywhere, a horizontal axis cannot show titles at scale): time runs down through all
  days with a date divider and an all-day band per day that takes its own room, items as long as they last with
  horizontal readable titles, overlaps side by side (wider on desktop), `timeline-now` as a line, zoom on desktop.
- Strip: CSS scroll-snap columns, one per day, sharing ONE time scale (owner: aligned, like the week view): one hour
  gutter, one vertical scroll for all columns, all-day bands equally tall across columns; heights proportional to
  duration; extended in both directions as the user scrolls (virtualised).

### Bedtime mode (owner, 2026-10-13)

- **Setting**: a Settings section "Bedtime" (`settings-section` `data-section="bedtime"`) with the per-person pref
  `bedtime` (server-whitelisted in `PATCH /api/prefs`, see API.md): `enabled` (default off), `mode` (`fixed` |
  `dynamic`), fixed `bedtime` / `wake` (default 23:00 / 07:00), "Different on weekends" (`weekendDifferent`) with its
  own `weekendBedtime` / `weekendWake` (default 00:00 / 09:00), dynamic `sleepMinutes` (default 480) and `leadMinutes`
  (default 60), and `reminderMinutes` (default 30, 0 = no reminder). Testids `settings-bedtime-on`,
  `settings-bedtime-mode` (segmented: `-fixed`, `-dynamic`), `settings-bedtime-time`, `settings-bedtime-wake`,
  `settings-bedtime-weekend` (+ `-time`, `-wake`), `settings-bedtime-sleep`, `settings-bedtime-lead`,
  `settings-bedtime-reminder`. Fields that do not apply to the chosen mode are hidden.
- **The rule** (one pure module, `web/src/features/bedtime/bedtime.ts`; no view re-implements it):
  `bedtimeWindows(range, prefs, items)` returns the night windows that touch `range` (`{ from, to }`, dates, `to`
  exclusive). A night is named by its **wake-up day** W and spans `[W@wake - d, W@wake]` with `d = (wake - bedtime)
  mod 24 h` (so `00:00` to `09:00` and `23:00` to `07:00` both work). The fixed pair of W is the main pair, or the
  weekend pair when W is a Saturday or Sunday (the nights of Friday and Saturday).
  - `fixed`: that pair.
  - `dynamic`: wake-up = (first timed item of W) - `leadMinutes`, bedtime = wake-up - `sleepMinutes`. **Never later
    than fixed**: when that bedtime is not earlier than the fixed bedtime, or W has no timed item, the whole fixed pair
    is used. First item = the first segment on W that has a time and starts there (`first`, so no continuation of a
    multi-day event), events and timed task lists, never all-day events or untimed / carried-over lists, hidden
    calendars left out. `items` is anything with `get(date) -> Segment[]` (the items store's `byDate`).
  - A window carries `wakeDate`, absolute `start` / `end` (minutes of wall-clock time since 1970-01-01, the same
    wall-clock model as the segments), the `HH:MM` texts and its mode. `clipToDay(window, date)` gives the
    `[startMin, endMin]` piece on one date (`1440` at the day's end), so a night over midnight is two pieces.
- **Overlay**: one small component per view type, all fed by `useBedtimeWindows(range)` (store glue: prefs, items,
  hidden calendars, and in dynamic mode a background `items.prefetch` of the day after the range so the next
  morning's first item is known):
  - `BedtimeColumn.vue` for every vertical day column (a registered grid layer for the Day and Week time grid, and a
    direct insert in the Timeline day body and the Strip column);
  - `BedtimeDial.vue` for the Clock (sector on the dial plate behind the arcs);
  - `BedtimeTrack.vue` for the Approaching track.
  Look: a dark translucent band (`color-mix` of the scrim token, so it works in light and dark themes), `pointer-events:
  none` and below the event blocks (z-index 0, blocks start at 1), so events stay visible and interactive. A thin line
  with a moon icon marks the bedtime edge and one with a sun icon the wake-up edge, only where the night really starts
  or ends (the next day's piece of a night starts at 00:00 without an icon). Testids `bedtime-band` (grid, Timeline,
  Strip, Clock) and `bedtime-track-band` (track); `bedtime-moon`, `bedtime-sun`. No animation anywhere (owner: reduced
  motion), so there is nothing to switch off.
- **Reminder** (`bedtimeReminder.ts`): driven by the shared clock tick like the transition warnings (no timer of its
  own). When bedtime is on, `reminderMinutes` > 0 and now is within `reminderMinutes` before the start of tonight's
  night, a snackbar `bedtime-reminder` says "Bedtime in N minutes" (N = minutes left). Once per night: the shown night is
  remembered per device (`localStorage` `cal.bedtimeReminded` = the night's wake-up date, plus in memory). The clock tick
  pauses while the app is hidden and the reminder is not raised while `document.hidden`; it shows when the app is visible
  again if bedtime has not started. It uses the app clock only (test clock friendly).
  The reminder goes out through a list of sinks (`reminderSinks`, the snackbar is the first one).
  **Android notification** (owner, 2026-10-13): a sink fires only while the app is open, so inside the Android app the
  *next* reminder (`upcomingReminder`: the first night whose bedtime minus the lead is after now) is also scheduled ahead
  through the native plugin `Reminders.schedule({ id: 'bedtime', at, title, body })` and cancelled when bedtime mode or
  the reminder is off; see "Android app and widget". Re-sent only when time, text or language change, so after tonight's
  reminder time the next night is scheduled. In dynamic mode the next night uses the items loaded at that time (the next
  open of the app corrects it). Web Push (for the PWA) still needs HTTPS and is not built.
- **Why** (alternatives weighed): one nested `bedtime` pref object instead of ten flat prefs (one validation, one
  Settings group, one place to extend with push); naming the night by its wake-up day instead of its evening because the
  dynamic rule and the weekend rule both start from the morning; the whole fixed pair when dynamic would be later
  (instead of mixing a dynamic wake-up with a fixed bedtime) so the two times never contradict; a pure function plus
  small overlay components (owner) instead of per-view logic, so a rule change is made once.

### New version notice (owner, 2026-10-12)

The server reports its build version (`APP_VERSION`, else the git sha at build time) in `GET /api/config` as
`version`; the web app knows its own at build time (`<html data-app-version>`). On every sync and when the app comes
back to the foreground it compares them; when they differ it shows a persistent snackbar "New version available" with
"Reload" (`update-available`, `update-reload`). Reload also activates a waiting service worker so the new assets load. A preview build (version `…-preview+<sha>`) skips the snackbar and reloads by itself, so the owner always sees the newest preview (owner, 2026-10-13); production keeps the snackbar.
It never reloads by itself and never interrupts an open dialog.

### Version numbers (owner, 2026-10-13)

- Semantic versions, counted automatically on every deploy from master: since the last tag `vX.Y.Z`, a commit
  subject starting `feat` raises the minor version, otherwise (fix, test, chore, spec, …) the patch version; a
  `BREAKING` marker raises the major version — but while the major is 0 (until the public VPS instance with Google
  sign-in goes live, then 1.0.0 by hand) it raises the minor instead. The first tag is `v0.1.0`. `scripts/version.sh`
  computes it; `deploy.sh` tags master locally (no remote) and builds with `APP_VERSION=X.Y.Z+<sha>`; previews build
  with `<last tag>-preview+<sha>`. Alternative weighed: a hand-kept version in package.json — rejected (owner: automatic).
- The update notice keeps comparing the full build version, so every deploy is noticed.
- Settings → Account & data shows "Version X.Y.Z" with the sha in small print (`settings-version`). A switch "Show
  version in the corner" (`settings-version-corner`, a person pref `versionInCorner` in `Prefs`, default off) shows a small label
  `app-version` ("0.4.2") in the bottom-left corner of the main UI (bottom right in left-handed mode on the phone; above the safe area, below dialogs, never covering
  the bottom bar or the FAB).

### Release notes (owner, 2026-10-14)

Owner decisions: release notes **in the app, automatic**; the text is **one or two plain user-facing English sentences
written per merge to main** (not commit subjects, which are often technical); **English only** (the entries; the UI
labels around them go through i18n like every other string).

- **Source of truth: `CHANGELOG.md`.** Every merge to main adds its lines under a `## YYYY-MM-DD` heading at the top
  (the merge date, newest first; one `- ` bullet per user-visible change, written for the person using the app; test,
  tooling and spec-only merges add nothing). The old iteration history stays below, under `## Older history`, and is
  ignored by the parser. Part of the merge step of the development loop, in the merge commit itself (no extra commit,
  so the version bump is unchanged).
- **Server**: `GET /api/release-notes` → `{ notes: [{ id, date, text }] }`, newest first, at most 50, parsed once at
  start from `CHANGELOG.md` (copied into the runtime image; missing or unparsable file → empty list, never an error).
  `id` is a short stable hash of date + text. TEST_MODE: `POST /api/__test/release-notes { notes }` replaces the list.
  Why server-side rather than bundled into the web build: the e2e can inject notes, and an old client learns of new
  notes without a rebuild of itself.
- **Settings → Account & data → "What's new"** (`settings-whats-new`, next to `settings-version`) opens a sheet
  `whats-new` listing the notes grouped by date (`whats-new-day` with `data-date`, `whats-new-item`). Empty list: "No
  release notes yet".
- **After an update**: the app remembers per device (localStorage `cal.notesSeen` = the newest note id seen). When the
  app starts with a build version different from the last one this device ran (`cal.lastVersion`), it fetches the notes;
  if there are notes newer than `cal.notesSeen`, a snackbar `whats-new-note` says "New: <newest text>" (cut to one line;
  "+N more" when there are several) with the action "What's new" (`whats-new-open`, opens the sheet) and a dismiss
  (`whats-new-dismiss`). Opening or dismissing marks all shown notes as seen. A device that has never run the app
  (no `cal.lastVersion`) marks everything as seen and shows nothing. It never interrupts an open dialog (waits until it
  closes), follows the shared snackbar rules (one at a time, after the update snackbar) and, on the phone, the "+"
  button slides away while it shows (covers no control). Per device, not a person pref: the question is "what changed
  since this device last ran", and a sync round trip for it adds nothing.

### View switcher position (owner, 2026-10-14; see A-253)

- A setting (Settings → Calendar, two rows: "On phones" `settings-nav-phone`, "On desktop and tablets"
  `settings-nav-desktop`, segmented buttons Bottom | Top | Side rail) decides where the view switcher sits. Person prefs
  `navPhone` (default `bottom`) and `navDesktop` (default `rail`) in `Prefs`; the server accepts only `bottom`, `top`,
  `rail` (anything else is a 400). There is no quick toggle in the UI. Per device type, with the same split as
  `useViewport`: `isPhone` (< 768 px) uses `navPhone`; everything else (desktop and touch tablet, >= 768 px) uses
  `navDesktop`.
- Resolution is a pure function (`resolveNavPosition(phone, prefs)` and `railSide(phone, leftHanded)` in
  `web/src/lib/navPosition.ts`); `useNavPosition()` wraps it with `isPhone` and `useLeftHand()`. The shell renders
  exactly one switcher: `NavigationBar` (`bottom`), `NavigationTabs` (`top`) or `NavigationRail` (`rail`); all three
  share the tab markup (`role=tab`, same `view-switch-*` testids, same pill/ripple animation) and publish
  `data-position` on the `view-switcher` container. The shell also publishes `html[data-nav-pos]` so CSS (FAB, tray,
  snackbar) follows without repeated logic.
- `bottom`: the bottom navigation bar (full width at the bottom of the shell). Phone: as always. Desktop and tablet: the
  same bar below the whole row (the tray side panel stays above it); the "+" lifts by the bar height.
- `top`: a tabs row (`nav-tabs`, text tabs with an active indicator, horizontally scrollable if it overflows) directly
  under the top app bar, above hints, banners and the calendar. The bottom bar does not exist.
- `rail`: a slim vertical rail. Desktop and tablet: left, 80 px, as before (also in left-handed mode: it already is under
  the left thumb). Phone: 64 px wide, on the **thumb side** = right, or left in left-handed mode (`railSide`), it spans
  the body (below the top bar, down to the bottom edge, safe-area padded on its outer side); the shell body is a row
  `[rail?][column][rail?]`. The "+" sits on the same side, clear of the rail (`--rail-w` plus the safe inset), so it never
  covers a rail control.
- Phone without a bottom bar (`top`, `rail`): `--navbar-h` is 0 (Snackbar, version label and the tray's max height follow);
  the **open tasks tray moves to the bottom edge** (it is the last child of the column, so it is the bottom element; it
  pads its bottom by the safe inset itself); the "+" floats **above the tray bar** (`bottom = max(--tray-h, safe-bottom) +
  12px`, `--tray-h` is the tray's measured height) and slides away while the tray is expanded, as before. On views
  without the tray (Tasks, Labs) the body pads the safe inset.
- Left-handed mode in every combination: "+" and tray toggle at the left on the phone (also with `top` and `rail`);
  `rail` on the phone moves to the left; on a touch tablet the "+" is right of the rail with `rail`, and at the left
  edge (24 px) with `top` / `bottom`.
- Reasoning: one resolved position attribute + one rail component (instead of per-view conditionals) keeps the existing
  testids and the Swipe/animation code untouched; a global `--navbar-h: 0` on a phone without a bar reuses all existing
  offsets instead of per-component special cases. Alternatives weighed: moving the tray with a new component (rejected:
  it is already the last flex child); a quick toggle in the top bar (excluded by the owner).

### Left-handed mode (owner, 2026-10-13)

- A switch "Left-handed mode" (`settings-left-handed`, Settings → Calendar; person pref `leftHanded` in `Prefs`,
  default off) mirrors the **phone layout** (< 768 px) and the **touch tablet layout** (a coarse pointer, up to 1366 px,
  e.g. an iPad; owner 2026-10-14) so the main controls sit under the left thumb. The desktop layout (a mouse) never
  changes. The pref follows the person to every device.
- Mechanism: the settings store sets `html[data-hand="left"]` from the pref (like `data-calm`; prefs load after mount).
  `useViewport` publishes ONE shared condition as `html[data-touch]`: `(max-width: 767.98px), (pointer: coarse) and
  (max-width: 1366px)` (detected by pointer and width, never by user agent; the phone clause keeps a narrow desktop
  window mirrored as before). Components carry their own `html[data-hand='left'][data-touch]` overrides (no repeated
  media queries); where phone and tablet differ they add the layout breakpoint (768 px) they already use. Positions
  computed in JS (the cats) read `useLeftHand()` (pref and `isTouchLayout`).
  Alternatives weighed: `dir="rtl"` (rejected: it would also flip text, the time gutter, swipe and grid order);
  a second set of components (rejected: duplication).
- Mirrored: the "+" button (and its menu, and the side it slides away to), the open tasks tray (chevron, FAB clearance,
  fold toggle of finished lists), snackbar buttons, the action bars of the confirm, event, category and task list
  dialogs (primary action bottom left), the version label (bottom right, clear of the mirrored "+"), the top bar (the
  settings group on the left, the title to its right; the Previous/Today/Next group on the right, the leading widgets
  on the left; the arrows keep their meaning: left = previous), the rows of the settings and the theme menu (switch,
  segmented button or trailing control at the left start, label after it), the support cat (walks in from the left,
  drawn mirrored; `data-from="left"`) and the drag helper cat (its default side, the hop away and the ask mark).
- Touch tablet (>= 768 px, owner 2026-10-14; see A-250): the navigation rail stays at the left (already under the left
  thumb); the "+" sits at the bottom left, right of the rail (a 380 px tray on the left would push it past the middle of an
  820 px screen); the tray side panel stays at the right edge (a persistent panel, no thumb toggle); the top bar is mirrored in one row
  (settings group, widgets, Previous/Today/Next, title); snackbar and dialog action bars, the version label (bottom
  right), settings rows and the cats mirror as on the phone. The tray's chevron does not exist on a tablet.
- Not mirrored: the time gutter and grid, month/week/year order, swipe directions, the approaching card track, resize
  handles, the now marker, text alignment.

### Themes

- **Terms** (owner 2026-10-13). **Scene** = the top app bar background (Season, a single season scene, Sunflower field, Mordor or None),
  chosen in the theme menu. **Plant** = the motivation widget in the top bar (the small growing plant); it is
  independent of the scene and is switched in Settings → Motivation. "Garden style" is no longer a term: it is
  removed from the spec, the UI, the code and the API. If more plant kinds come later they would be a "plant style";
  nothing is built for that now.
- A theme is a preset of: seed colour (existing scheme generation), mode (only Neon, Mordor and New Year's Eve force dark — New Year's Eve since 2026-10-13, owner: fireworks need the night; the season
  presets and Default leave the person's System/Light/Dark setting alone, owner 2026-10-13), `glow` (off|soft|neon),
  `entries` (solid|tinted|outline), `corners` (square|round|pill) and `scene` (none|mordor|spring|summer|fall|winter;
  halloween). Presets live in `web/src/theme/presets.ts`: Default, Neon, Spring, Summer, Fall, Halloween,
  Winter, Mordor and Automatic (resolves to the season by date; Halloween for all of October, owner 2026-10-13: spring from 1 March, summer from 1 June, fall from
  1 September, winter from 1 December).
- Applied as attributes on `<html>`: `data-theme-name` (the resolved preset, e.g. "Halloween" for Automatic in October),
  `entries` (solid|tinted|outline), `corners` (square|round|pill) and `scene` (none|sunflowers|mordor|spring|summer|fall|winter;
  Halloween comes with its own slice). Presets live in `web/src/theme/presets.ts`: Default, Neon, Spring, Summer, Fall,
  Winter and Mordor (the calendar's theme for a day is in "Holiday themes and Seasons & holidays" below).
- **One scene choice** (owner 2026-10-13): the top bar background is the theme's `scene` attribute and nothing else.
  The theme menu's Scene card has the scene options, in this order: Spring, Easter, Summer, Summer holidays, Fall,
  Halloween, Christmas, New Year's Eve, New Year, Winter, Sunflower field (`sunflowers`), Mordor, None (owner
  2026-10-13: every scene can be picked on its own). An explicit pick is stored as that scene, sets "Seasons &
  holidays" to Off and shows only its own option as pressed. The former `season` sentinel and "Season" option are
  gone, replaced by that setting. Default and Neon start with
  `none`; every scene, the Sunflower field included, shows whenever it is chosen (API.md "Scenes"). Alternatives
  weighed: keeping the old `Settings.scene` and hiding the theme one (rejected: two stored values and a precedence
  rule nobody could see) and moving everything into settings (rejected: presets need to carry a scene).
  Migration (once per person, when the server first serves the theme after the change, marker `sceneUnified` in the
  stored theme): the scene that was visible wins. If the preset or override scene was not `none`, it already is the
  value and stays; if it was `none`, the old top bar setting (`sunflowers`, `mordor` or `none`) becomes the override.
  The old `scene` key stays in `settings.json` (read-only, unused) so other people can still migrate.
- **Fine-tuning sits on top of the chosen theme, the seed colour included** (owner bug, 2026-10-13). Cause found: the
  theme's own seed always won over the person's `seedColor` setting (`theme.seed ?? settings.seedColor`), while the
  swatches only wrote the setting, so on Neon, Halloween or any preset with a seed the colour pick changed nothing.
  Now the seed colour is one more override of the theme pref (`overrides.seed`, `#rrggbb`, next to `glow`, `entries`,
  `corners`, `scene`): colour in use = override, else the theme's seed, else the person's base setting `seedColor`
  (which stays as the base for themes without a seed, and is not written by the menu any more). Choosing a theme (also
  the one already chosen) clears all overrides, so the card resets it to its own look; "Save as my theme" then
  captures the preset plus the overrides. Alternatives weighed: (a) making the person's setting win over every
  preset (rejected: presets could not bring their colour, and a pick could never be reset); (b) a migration of the
  stored setting into the overrides (not needed: until now a preset's seed won over the setting, so nothing visible
  changes; for themes without a seed the setting stays the base). **Theme mode stays a setting** (`themeMode`): the
  owner decided that season presets keep the person's System/Light/Dark and only Neon and Mordor are dark by design,
  so a mode pick must survive choosing another theme, which an override (cleared on choose) would break.
- The settings page's Theme row shows the preset name; for Automatic it shows "Automatic · <the calendar's preset of
  today>", e.g. "Automatic · Fall", "Automatic · Halloween", "Automatic · Christmas"; with "Scene only" or "Colours only"
  (below) it reads "Automatic (scene) · Christmas" or "Automatic (colours) · Christmas".
- Applied as attributes on `<html>`: `data-theme-name` (the resolved preset, e.g. "Fall" for Automatic in October),
- The settings page's Theme row shows the calendar's theme alone for Header + colours (e.g. "Halloween"), "<theme> ·
  <calendar theme> header" for Header only (e.g. "Neon · Halloween header") and the chosen theme's name for Off.
- Applied as attributes on `<html>`: `data-theme-name` (the resolved theme: with Header + colours the calendar's theme, e.g. "Halloween" in October, else the chosen preset),
  `data-glow`, `data-entries`, `data-corners`, `data-scene`, plus CSS custom properties (`--glow-*`, `--radius-*`).
  Components style from these only (no per-component theme logic). Reduced/Off animation levels keep static glows
  but stop animated ones.
- Stored per person in `DATA_DIR/users/<sub>/prefs.json` (`theme: { preset, overrides, seasonal }`, same store as hidden
  calendars); `GET/PATCH /api/prefs/theme`. Cached in `localStorage` and applied before mount to avoid a flash.
- Theme menu (`/settings/theme`, entry `settings-theme`): below the live preview, four sections in this order
  (`theme-section`, `data-section`): **Seasons & holidays** (`calendar`, the segmented button `theme-seasonal` and a line
  `theme-seasonal-today` saying what applies today), **Presets** (`presets`, the gallery), **Scene** (`scene`, its own card with the
  scene choices) and **Fine-tuning** (`fine-tuning`: theme mode, seed colour, glow, entries, corners). There is no
  separate Mordor row or button (`settings-theme-mordor` is removed): the Mordor preset (seed #c43e00, dark mode,
  Mordor scene) does the same, and Mordor stays a scene choice. Gallery `theme-card` (`data-name`, `aria-pressed`), each
  card renders a real mini week (event chip + task list card) under that preset's attributes in a scoped container;
  fine-tuning `theme-option` (`data-setting`, `data-value`, `aria-pressed`), each option renders a sample event chip
  in that style; the live preview (`theme-live-preview`, next section). Picking applies at once and saves in the
  background.

### Theme menu live preview (owner, 2026-10-13)

The old "Preview" card scrolled away, which made the menu unusable. It is replaced by `ThemeLivePreview.vue`
(`web/src/components/settings/`), a sticky mini calendar, so a person always sees what a choice does.

- **Real components, sample data.** It renders `TopAppBar` with `TopBarScene` (the effective scene: seasons, holidays,
  the drawn scene and an own SVG all show) with the app's `IconButton`s, a three-day week slice whose events are drawn by
  `ItemView` (so by the registered `EventItem`, as a time-grid block), a task list drawn with `RewardCheckbox` rows (some
  ticked), the `Fab` ("+") and the app icons. Nothing is a look-alike, so glow, entries style, tint, corner radius,
  checkbox shape/fill/glyph, icon set, density and scene all follow without per-feature code. The data is a static
  module (`themeLivePreviewSample.ts`): fixed far-future dates (never "today", so no dimming or ring), fixed colours, no
  API call, no store write; nothing touches the person's real calendar.
- **Live.** The preview sits under the same `<html>` theme attributes and custom properties as the app, and those
  come from the theme store's `resolved`, which includes the slider path `theme.preview(...)` while a slider is
  dragged. Nothing new is wired.
- **Scaling.** The content is laid out at a fixed design width (420 px) and scaled with `transform: scale(k)`,
  `k = container width / 420` (measured with `useElementSize`, capped at 1); the wrapper's height is the natural
  height times `k`, capped at `34vh` on the phone. `pointer-events: none` and `inert` on the scaled content, and
  `providePreview(true)` so the event renderer skips its drag handlers. Aria: the content is `aria-hidden`; the
  region is labelled by the toggle.
- **Placement.** Phone: first child of the menu content, `position: sticky` right under the menu header (header is
  `safe-top + 64 px` tall). Desktop (>= 900 px): the menu content is a two-column grid, settings left, the preview
  sticky on the right (A-110).
- **Collapse.** The toggle (`theme-live-preview-toggle`) folds it to the top bar scene strip. The state (`data-collapsed`)
  is kept per device in `localStorage` (`cal.themePreviewCollapsed`, every access in try/catch; unavailable storage
  means expanded and no memory).
- **Motion.** Scaled scene animations run only at the Full animation level; Reduced and Off pause every animation
  and transition inside the preview (a static pose).
- **Strings.** All new text goes through `t()` (`themePreview.*`, English and German; the fun languages fall back).

### Fine-tuning sliders, density and icon choices (owner, 2026-10-13)

The Fine-tuning card gets live controls on top of the step choices. Every control changes the Preview block and the whole
app at once and is a **theme override** (reset by choosing a preset, captured by "Save as my theme").

| Field (override and `calendar-theme/2`) | Control (testid) | Values | Applied as |
|---|---|---|---|
| `glowStrength` | slider `theme-slider-glow` | integer 0..150 (Off 0, Soft 40, Neon 100) | `--glow-r/-s/-a` interpolated between the anchors; `--glow-anim` is `neon-pulse` from 100 up |
| `radius` | slider `theme-slider-radius` | integer 0..28 px (Square 2, Round 6, Pill 28 = pill) | `--r-chip` = value (28 = 999 px); `--r-block` interpolated 0/2/6/28 px to 0/2/8/16 px |
| `tint` | slider `theme-slider-tint` | integer 5..60 % (default 24) | `--e-fill` while entries are Tinted |
| `density` | segmented `theme-density` | `compact` / `comfortable` / `airy` | `--dz` 0.9 / 1 / 1.12: scales the font size of the type scale and the task list row height |
| `checkbox` | segmented `theme-checkbox-shape` | `round` / `square` / `rounded` (default) | `<html data-checkbox>`, read by the task item checkbox and the preview; the task list card's tiny box takes the shape only |
| `checkFill` | segmented `theme-check-fill` | `filled` (default) / `outline` | `<html data-checkfill>` |
| `icons` | segmented `theme-icon-set` (a sample icon per option) | `outlined` (default, today's look) / `rounded` / `sharp` | `<html data-icons>` and the reactive `iconSet`; every app icon is an `AppIcon` that draws the chosen variant |
| `check` | segmented `theme-check-glyph` | `tick` (default) / `bold` / `cross` / `dot` | `<html data-check>`; one SVG glyph per value, the others hidden by CSS |

- **Steps and sliders are one value.** The step buttons stay as quick picks: choosing a step stores the step and its value
  (`glow: soft` + `glowStrength: 40`; `corners` + `radius`), and the slider shows it. Moving a slider stores only the number;
  the step then shows as pressed only while the effective value equals the step's value, so between steps **no step is
  pressed** (alternative weighed: marking the nearest step with a "custom" state; rejected: a pressed step must always
  mean exactly that value). The step attribute (`data-glow`, `data-corners`) stays the preset's or the person's last pick
  and is what the gallery samples use; the custom value is applied as inline custom properties on `<html>` by
  `applyAttrs` (`web/src/theme/fine.ts` maps value to properties, pure), cached with the attributes for the first paint.
- **On top of Seasons & holidays.** The fine-tuning fields are overrides like `seed`, so they stay in every mode (Off, Header only, Header + colours); choosing a preset clears them (and steps `all` down to `header`, see below). While `all` is on, the calendar's glow, entries and corners replace the chosen theme's own, and the theme's own `glowStrength`/`radius` numbers go with them; the person's overrides still win.
- **Tint** applies to the Tinted entries style only; Solid is fully filled and Outline has no fill by definition, so the
  slider is disabled with a hint unless entries are Tinted (the value is kept).
- **Density** scales font sizes, not line heights, so fixed-height chips and the month cell line budgets are unaffected;
  the time grid's hour height (`useHourHeight`, the zoom feature) is independent and untouched. Task list rows grow with
  `--dz` but never below the 44 px touch target. Steps rather than a slider: three named looks are enough and give testable values.
- **Document and validation.** The same fields are optional in `shared/theme.schema.json` (so own and imported themes carry
  them) and the validator checks type and range (integer `minimum`/`maximum` support was added); the server accepts them in
  `PATCH /api/prefs/theme` overrides with the same ranges; the web drops invalid stored values (`sanitizeFine`). The AI
  prompt embeds the shared schema, so it picks the fields up without a prompt change.
- **Accessibility.** Sliders are native `input[type=range]` (keyboard: arrows, Home/End, PageUp/PageDown) with a visible
  label and value text (`aria-valuetext` carries the unit). Reduced motion: slider and checkbox transitions are off at the
  Reduced and Off animation levels (`html[data-motion]`), the neon pulse already runs only at Full.
- **Whole-app icon set** (owner confirmed option (a), 2026-10-13). Icons stay compile-time inline SVG from
  `@iconify-json/material-symbols` through `unplugin-icons`; `web/src/components/icons.ts` imports the three variants of
  each of the 24 icons in use (`<name>`, `<name>-rounded`, `<name>-sharp`; where the set has no sharp or rounded drawing the
  alias is the same shape) and exports one component per icon (`IconAdd`, ...) that renders the variant of the current set.
  The set lives in a module-level reactive value (`web/src/theme/iconSet.ts`), written by `applyAttrs` together with
  `<html data-icons>`, so leaf components need no store. Alternative weighed: reading `data-icons` from the DOM (rejected: not
  reactive, so every icon would need a MutationObserver or a re-render hook). The default `outlined` is the base name, i.e.
  today's look; the first value is read from the cached attributes so there is no flash. Cost: the two extra variants are
  bundled (bundle delta in the slice report), not lazily loaded, so a switch is instant and offline-safe.

### Holiday themes and "Seasons & holidays" (owner, 2026-10-13)

- **Calendar mapping** (pure functions in `web/src/theme/holidays.ts`, unit-tested; `presets.ts` builds on them).
  `automaticPreset(date)` (the calendar's theme for a date) priority: New Year's Eve (31 Dec), New Year (1 Jan only), Christmas (1st Advent Sunday to
  30 Dec; the 1st Advent is the 4th Sunday before 25 Dec), Easter (Easter Sunday −7 to +6 days; Easter by the anonymous
  Gregorian Meeus/Jones/Butcher algorithm), Halloween (all of October), then the season. Summer holidays is never
  picked, it is hand-picked only. Alternatives weighed
  for the Easter algorithm: a lookup table of years (rejected: runs out) and Date libraries (rejected: nothing to add).
  Christmas state for a date: Advent (1st Advent .. 23 Dec) = tree lights off and 1 + whole weeks since the 1st Advent
  candles lit (max 4); every other date, which includes 24-30 Dec and a hand-picked Christmas scene in April = lights on,
  4 candles. One scene whose state depends on the date was chosen over separate Advent and Christmas scenes (owner).
- **Presets and scenes**: Easter, Summer holidays, Christmas, New Year's Eve, New Year, each a preset (seed colour, glow,
  entries, corners, scene; all keep the person's mode) and a scene (`easter`, `summerholidays`, `christmas`,
  `newyearseve`, `newyear`) in the registry of `scenes.ts`, built like Halloween: a backdrop in `SeasonScene` (gradient
  and drifting particles, also used by the sample cards) and a living layer in `SceneLife` with `data-part`s. Easter:
  spring meadow with first flowers, painted eggs and a hare. Summer holidays: sun, sea with waves, sand and a beach
  umbrella. Christmas: a timeline across the full bar (owner feedback): four big `advent-candle`s (`data-lit`) at about
  7 / 25 / 50 / 70 % and the tree (`xmas-tree`, `data-lights` on/off) at about 87 % as its end point; unlit candles stay
  visible but dark, lit ones get a flame with a soft glow; low opacity keeps the bar's title and buttons legible; the
  date comes from the app clock. New Year's Eve: night sky, stars, skyline and
  fireworks. New Year: sunrise over a hill with falling confetti. Preset order in the gallery follows the Scene card.
  Motion: CSS transforms and opacity only; fireworks, candle flicker, tree twinkle, waves and confetti run only at Full
  (`html[data-motion='full']`), at Reduced and Off everything stands still; paused while the page is hidden is inherited
  from the animation level handling like the other scenes.
- **Seasons & holidays** (owner decision after a journey walk-through; replaces the preset Automatic and two earlier
  controls that never reached master). One setting for all seasons and holidays, `seasonal: 'off' | 'header' |
  'all'` in the theme pref, shown as the segmented button `theme-seasonal` (Off · Header only · Header + colours) at the
  top of the theme menu with a line `theme-seasonal-today`: "Today: <calendar theme> header & colours", "Today:
  <calendar theme> header" or "Today: nothing changes automatically". `all`: colours and style (seed, mode rule, glow,
  entries, corners, an imported theme's role colours) come from the calendar's theme for today (`automaticPreset`) and
  the scene from `seasonScene`; New Year's Eve is therefore dark whenever its colours apply, as base or through this.
  `header`: colours from the chosen preset, scene from the calendar. `off`: the chosen preset and the person's scene
  pick (or the preset's own scene). Fine-tuning overrides always sit on top; an explicit scene override wins over the
  calendar's scene. New people start with `all` on base Default. **An explicit pick wins and steps the setting down**:
  choosing a preset turns `all` into `header` (the header stays seasonal, the colours are the person's; `header` and
  `off` stay) and resets the overrides; picking a scene stores it and sets `off`; setting `header` or `all` again drops
  the scene override so the calendar shows. The `season` scene sentinel is gone: the header mode resolves the calendar's
  scene directly, so nothing needs a sentinel. Migration on read (server, marker `seasonalMigrated` in the stored theme;
  the web cache applies the same rule): a stored preset Automatic becomes Default with `all`; a stored scene override
  `season` becomes `header` with the override removed; everything else becomes `off`, so nobody's look changes.
  Alternatives weighed: a switch pair (rejected by the owner: four combinations, two of them confusing), keeping
  Automatic as a preset (rejected: it hid the idea in one card), and a separate setting per season/holiday (rejected:
  one rule for all, as asked).

### Season scenes and the support cat (owner, 2026-10-13)

- Halloween (owner, 2026-10-13): pumpkin-orange seed, follows the person's light/dark setting (light = dusk,
  dark = night). Scene: a moon behind thin clouds, bare gnarled trees, jack-o'-lanterns on the ground whose candle
  light flickers softly, the cat sitting next to a pumpkin and blinking, bats instead of butterflies (same visiting
  rhythm and hook), and now and then (every 8–12 min, about 8 s) a small friendly ghost floating past. Parts
  `moon`, `bare-tree`, `jack-o-lantern`, `bat`, `ghost`, `cat`. Same rules: theme tokens, animation levels.

- Every scene works in light and dark (its colours come from the theme tokens, not fixed hex), so a season theme never
  needs a mode. Scenes are SVG compositions in the existing `TopBarScene`/`SeasonScene` family under
  `web/src/features/motivation/`, built from small reusable parts with `data-part`: spring = sprouting trees (buds
  that leaf out over the day), lily of the valley and first flowers in the grass; summer = the existing sunflowers
  (`SunflowerScene`) plus a small sun; fall and winter keep their scenes. Every scene gets butterflies (reusing
  `Butterfly.vue`) — but only now and then (owner, 2026-10-13: always-on butterflies distract): one butterfly at a
  time visits roughly every 3–5 min, flutters through for about 10 s, sometimes rests briefly on a flower, then
  leaves; the first visit comes 20–60 s after the scene appears. Reduced: the visit only rests in place, no flight.
  Off: none. Test hook `window.__butterflyNow` starts a visit at once — and a small cat that sits, stretches or naps in the scene (one shared `SceneCat` part). Motion
  follows the animation level (Off: still picture).
- The support cat (`SupportCat`, testid `support-cat`) is a one-off overlay effect on finishing a task list, rolled
  with probability 0.1 per finished list (test hook forces the next roll). Sequence ≈ 3 s: walks in next to the list
  card, swipes its paw across the list's title and a hand-drawn line strikes the title through (owner, 2026-10-13: the
  cat "checks off the list"), looks at the viewer, grins, fades out. The struck-through title stays while the list is
  complete (it is the done state of a list, with or without the cat; unticking an item removes it). It
  never captures pointer events and is skipped at animation level Off. Setting "Support cat" (`settings-support-cat`:
  Off / Sometimes / Every time, values `off|sometimes|always`, default `sometimes`) in the Focus & motivation part of
  the settings, per person in prefs (`supportCat`), independent of the theme so a theme change never resets it
  (owner, 2026-10-13; replaces the earlier theme-menu switch). "Every time" skips the roll. The scene cat and the
  support cat share one cat drawing (`CatFigure`), posed differently.
- Drag helper (owner, 2026-10-13): when the person picks up an event or task list, the cat may come to "help" — same
  setting as the support cat (Off / Sometimes ≈ every 5th drag / Every time). It follows the dragged card: moving
  later/down → it pushes from above, earlier/up → it pulls from below, to another day → it pushes from the side;
  when the pointer rests > 0.5 s it sits beside the card (on the left, away from the dragging thumb; on the right in left-handed mode — owner 2026-10-13) with a paw on it and looks at the person questioningly; on
  drop or cancel it hops away (≤ 1.5 s). It reads the drag state from `motion/drag.ts` (no second drag logic),
  never takes pointer events and must not slow the drag (transform-only, one rAF loop shared with the drag).
- Cat look (owner, 2026-10-13, two reference pictures; the second one wins where they differ): a black cat in a
  flat paper-cut style with a subtle paper/fur texture, no outlines, no cartoon mouth or cheeks: tall narrow body
  that flows into a small head without a neck, seen from the front; two sharp triangle ears with pink insides; big
  round eyes as yellow rings around black pupils, set close together; a tiny grey triangle nose; long thin light
  whiskers reaching far out; two front legs showing at the bottom; the tail rising straight up behind the body with
  a hook at the tip (sitting/napping poses may curl it). Our own drawing in that style, not a copy. On dark themes a
  soft rim light keeps the black body readable. Expressive through eyes, ears, tail and head only: pupils look
  around, slow blinks, ear twitches, tail-tip flicks, head tilt; "grin" = happy squinted eye arcs.

### Undated task lists (owner, 2026-10-13)

A task list may have no date. It is stored in the same place as every other list, the person's tasks calendar, as an
**all-day event on the fixed anchor date `2099-12-31`** with `extendedProperties.private.undated = "1"`. The API shows
`date: null` and `time: null` for it.

- **Reading**: undated lists are fetched with Google's filter `privateExtendedProperty=undated=1` on `events.list`
  (no time range; the filter is `ListEventsParams.privateExtendedProperty`, which both providers support, and
  `timeMin`/`timeMax` are optional now). Date-range reads (`/api/items`, `/api/summary`, `/api/tasklists/open`) never
  return them, even when the range reaches the anchor date: events with `undated = "1"` are dropped. So an undated
  list never shows in Year, Month, Week, Day or the Labs views, in the month picker counts or in the open tasks tray.
- **Dating** = moving the event: `PATCH /api/tasklists/:id { date: "YYYY-MM-DD" }` rewrites `start`/`end` and removes
  `undated`. **Undating** = `PATCH { date: null }`: the event moves to the anchor date, `undated = "1"` is set and the
  time is dropped.
- **Completion**: a write that ticks the last open item of an undated list dates it to the app-clock day (all-day) and
  sets `completedOn` to the same day, so it shows in the calendar where it was finished (assumption A-75). The setting
  `undatedDone` (see "Archive") switches this.
- **Why this way** (owner decision). Alternatives weighed: (a) a separate store (server file or a second calendar)
  for undated lists; (b) a flag with a real but ordinary date. Chosen: one store, so the same sync, backup, etag and
  conflict handling cover undated lists too, and "giving a date" is just moving the event instead of moving data
  between stores. The price: people who show the tasks calendar in Google (setting "Show tasks calendar in Google")
  see these events in the year 2099.
- An undated list cannot repeat and has no time (`400` otherwise).

### Tasks view (owner, 2026-10-13, slice 1 of the task management feature)

- **Route and navigation**: `/tasks` (`meta.tasks`), a destination after Day in the phone navigation bar and the
  desktop rail: Year, Month, Week, Day, Tasks (`view-switch-tasks`; Labs views follow when on). It is not a calendar
  view: no period, no swipe, no open tasks tray (it is the tray's bigger sibling). The top bar shows "Tasks", sync
  status, filter button and settings button (A-78). The create button ("+") opens the task list dialog without a date.
- **Content**: all open lists (A-94), dated and undated, from `GET /api/tasklists/all-open?today=` (API.md). Each list is
  a `tasks-item` containing the tray's own item component, the **task list view**, so ticking, adding, reordering and
  deleting items work as in the tray; the one difference is that tapping the title opens the task list dialog
  instead of renaming in place. Each `tasks-item` also has the quick actions `tasks-today` and `tasks-tomorrow`.
  The lists live in the items store (kept in the cache while the Tasks view lists them), so item operations are the
  existing optimistic ones.
- **Grouping** (`tasks-group-by`: Time, Category, None; default Time) and **sorting** (`tasks-sort-by`: Date, Name,
  Category, Last changed, Progress; default Date) are person prefs `tasksGroupBy` (`time|category|none`) and
  `tasksSortBy` (`date|name|category|changed|progress`) and `tasksSortDir` (`default|reversed`, A-80), whitelisted by `PATCH /api/prefs` (invalid value: 400) and
  returned by `GET /api/prefs`. Grouping and sorting are pure functions in `features/tasklists/tasksView.ts`
  (details and directions: A-72). Why prefs and not the URL: the choice should follow the person to other devices
  (owner), like `versionInCorner`.
- **Filters**: the category chips of the calendar filter the lists (A-77).
- **Dating**: the task list dialog has a "No date" toggle (`tasklist-no-date`, A-73); the quick actions set today
  or tomorrow (A-74).

### Archive (owner, 2026-10-13, slice 2 of the task management feature)

- **Archived = complete.** A list with at least one item and every item ticked is archived automatically; unticking an
  item (or adding an open one) makes it open again, and the existing server logic clears `completedOn`. No archive
  button, no stored "archived" flag. Dated finished lists stay in the calendar on their day: the Archive is only a view.
- **Tabs**: the Tasks view has two tabs `tasks-tab-open` (the existing view) and `tasks-tab-archive`. The Archive lists
  finished lists in `tasks-archive-item` cards (the tray's `TaskListView`, so un-ticking works as everywhere), **newest
  first by `completedOn`**; lists without `completedOn` (finished outside the app, e.g. edited in Google) come at the end,
  ordered by their event date (newest first), then title (A-103). Pure functions in `features/tasklists/archive.ts`.
- **Search** (`tasks-archive-search`): case-insensitive substring match on the list title and on every item title.
- **Use as template** (`tasks-archive-duplicate`): `POST /api/tasklists` with the same title, category and tags, no date,
  every item open (new ids), no recurrence or estimate. The copy appears in Open; the original stays archived.
- **Setting** `undatedDone` ("Finished list without a date", Settings → Task lists, person pref): `calendar` (default) =
  today's behaviour (A-75: the list is dated to the finish day); `archive` = the list stays undated, gets `completedOn`,
  shows in no calendar view and no tray, only in the Archive. The server reads the pref on every completing write
  (`CalendarService.modify`), so a changed setting applies to the next finish.
- **Fetching finished lists across time** (owner: pick an efficient way). Options weighed: (a) a bounded date range only
  (as `all-open`, +-365 days): cheap and needs no data change, but old lists vanish and undated "archive only" lists sit
  on 2099-12-31 outside any range; (b) a private marker `done=1` written with every write that leaves the list finished
  and read with Google's `privateExtendedProperty=done=1` (no time range): finds finished lists of any age and the
  undated ones with one query, and Google filters server side so the response only holds archived lists. Chosen: **(b)
  plus the (a) range as lazy backfill**: lists finished before this feature have no marker, so the archive also reads the
  +-365-day range and keeps the complete lists (deduplicated by id); every later write of such a list adds the marker.
  Older unmarked lists are not found until they are edited once (acceptable: pre-release, no migration job, A-103).
  The marker is derived from the items on every write (`encodePrivate`), so it can never disagree with them.

### Canvas (owner, 2026-10-13, slice 3 of the task management feature)

The Tasks view gets a third tab, **Canvas** (`tasks-tab-canvas`; tabs: Open · Canvas · Archive). It shows ALL open task
lists, dated and undated, as **sticky notes** you place freely on a large board, with named **areas** to sort them by.
Owner decisions are final; the numbers and names below are mine (A-120 .. A-131).

- **Board and units.** One canvas unit = one CSS pixel at zoom 1. The board is `4000 x 3000` units (`WORLD_W`,
  `WORLD_H`), origin top left. A note is `240` units wide (`NOTE_W`) and as tall as its items. Pure geometry (clamping,
  stack layout, zoom around a point, area lookup) lives in `web/src/features/tasklists/canvas.ts` with unit tests.
- **Notes** (`canvas-note`): a card in the category colour with a grip strip on top (the date, when the list has one),
  the title, the done count and the items with the same `RewardCheckbox` rows as everywhere. A note is the tray's
  `TaskListView` in a `compact` mode (no move/delete buttons, add field or footer), so ticking, the
  celebration and the support cat are the existing code and the existing optimistic item ops. Tapping the title
  opens the task list dialog (`titleOpensDialog`). A tick that finishes the list plays the usual finish feedback, then
  the note leaves the canvas (the list is in the Archive, ARCHITECTURE "Archive"): the Tasks view store keeps a list that
  was finished here until the view is opened again (as in Open), and the canvas hides it after the feedback
  (`1400 ms` plus the cat's visit, A-125).
- **Place on the event** (owner). The place of a note is stored on its Google event, in `extendedProperties.private`:
  `cx` and `cy`, the note's top-left corner in canvas units as **integer strings** (`"100"`, `"260"`). Both are present
  or both absent (absent = no place yet: the note is in the Unsorted stack). Limits: integers `0 .. 10000`
  (`CANVAS_MAX`); the server rejects anything else with `400 VALIDATION_ERROR` (field `canvas`), and a reader ignores a
  pair that is not two integers in range. The API shows `canvas: { x, y } | null` on a `TaskList` and takes
  `canvas?: { x, y } | null` in `PATCH /api/tasklists/:id` (null clears the place: the list goes back to Unsorted).
  `encodePrivate` writes `cx` / `cy` (null removes them), so every other write of the list keeps the place. The web app
  clamps a dropped note to the board (`0 .. WORLD - NOTE_W`, `0 .. WORLD_H - 24`) before it saves.
  *Why two integer properties and not one JSON value*: like `estimate`, they are tiny (about 12 bytes against the 32 kB
  budget), readable in Google's raw event, and `privateExtendedProperty=cx=100` stays queryable. *Why the server limit
  (10000) is larger than the board*: the board can grow later without a data migration. *Why integers*: a position needs
  no sub-unit precision and strings of digits cannot carry stray text.
- **Moving** (owner feedback 2026-10-13: the first version was unusable on a phone). On a touch screen a **long press
  anywhere on a note** (350 ms, the calendar's delay; title, items, padding, all of it) lifts it with a haptic tick and the
  finger then drags; a short tap keeps its meaning (a checkbox ticks, the title opens the dialog), and a touch that moves
  before the long press does **nothing** on a note (no accidental moves, no pan). The click that ends a drag is swallowed.
  With a mouse a plain drag after a 4 px slop moves a note (not from a button, box or field). Escape cancels. During the
  drag the note follows through `transform` only (no layout work); on release the place is saved with
  `PATCH /api/tasklists/:id { canvas }` **without** `If-Match` (a move never conflicts with item edits: the server
  re-reads and retries) and shown at once; on a failure the note springs back (the old place) with a snackbar.
  The existing drag controller (`motion/drag.ts`) is built around slot grids and ghost cards; the canvas reuses its
  *conventions* (long-press delay, slop, haptic) with a small pointer-event module of its own (`useCanvasPointer.ts`),
  because a free 2-D board with pan and pinch needs none of the slot hit-testing.
- **Unsorted stack.** Open lists without a place sit at the top left, offset diagonally on top of each other: the
  n-th note (ordered by title, then id) at `(24 + 14 n, 24 + 14 n)` for n up to 10, further notes share the last offset.
  The label "Unsorted" (`canvas-unsorted`) sits above the stack while it is not empty. A note leaves the stack by being
  moved; a list created later arrives in the stack (`data-placed="false"`).
- **Zoom and pan.** The board is drawn in a viewport (`canvas-viewport`) as one layer with
  `transform: translate(px, py) scale(z)`; `data-zoom`, `data-pan-x` and `data-pan-y` expose the view. Pan: dragging
  the empty background (one finger or the mouse; areas are transparent to the pointer except their header and resize
  handle), and the plain mouse wheel / trackpad scroll. Zoom: pinch and Ctrl+wheel (the same gesture rate as the time
  grid, `wheelZoomFactor`), about the pointer or pinch centre, within `0.3 .. 2`. The pan is clamped so that at least
  `120` px of the board stay in view. The view `{ x, y, zoom }` is remembered **per device** in `localStorage`
  (`cal.canvasView`, written 250 ms after the last change and on `pagehide`, every access in try/catch; unusable values give the default zoom 1, pan 0, 0); it is never sent to
  the server.
- **Areas** (`canvas-area`). A labelled rectangle (name, colour, position, size) that collects notes. It is created with
  `canvas-area-add` (centred in the view, `320 x 240`, named "Area", colour from a palette). **Moving**: a touch long press
  anywhere on it (header or body, where no note sits on top) lifts it like a note; a touch that moves earlier pans the
  canvas (the body is background); with a mouse the header drags it and the body pans. **Resizing, the calendar's
  pattern** (`features/calendar/ResizeHandles.vue`: release a picked-up entry without moving and handles appear): after a
  long press released without moving (or a click on the header, or a move), the area is *selected* and shows four round
  handles on its corners (`canvas-area-handle`, `data-corner` nw, ne, sw, se), each a **44 px** touch target. A handle
  drags at once, no long press; the opposite corner stays, minimum `160 x 120`, maximum `4000`, kept on the board. A pointer
  going down anywhere but on a handle, or Escape, hides them. (The calendar's component is vertical, tied to time segments
  and `ui.resizing`, so it is not reused as a component, only its interaction and sizes.) A tap on the header also opens
  the editor panel (`canvas-area-editor`: name field `canvas-area-name-input`, Enter or blur saves and closes; colour swatches
  `canvas-area-color`, `data-color`; `canvas-area-delete`; `canvas-area-editor-close`). Deleting an area deletes only the
  rectangle: **membership is stored nowhere**; a note belongs to the topmost area that contains the note's *anchor* (the
  middle of its top edge: `x + 120`, `y + 24`); `data-area` on the note holds that area's name (`""` = none). Why by
  position only (owner): notes keep their meaning when areas are deleted, resized or restored, and there is nothing to
  keep in sync. The anchor, not the whole note, because a note's height varies with its items.
- **Where areas live (owner: per person on the server, not in Google).** `DATA_DIR/users/<sub>/canvas.json`, one JSON
  document `{ "version": 1, "areas": [ { id, name, color, x, y, w, h } ] }` per person, read and written whole by
  `GET /api/canvas` and `PUT /api/canvas` (API.md "Canvas"), written atomically like `prefs.json`. A later slice backs
  this document up to Google Drive, which is why it is one self-contained, serialisable file and not part of `prefs.json`
  and not many files. *Alternatives weighed*: (a) areas as Google events (rejected: owner, and rectangles are not
  events); (b) a `canvas` field in `prefs.json` (rejected: prefs are small switches that `PATCH` merges, the canvas
  document is a growing document with its own limits and backup); (c) one endpoint per area (rejected: more routes and
  a half-saved board after a failed second call; a whole-document `PUT` is atomic). The price of (c)'s alternative: two
  devices editing areas at the same moment overwrite each other (last write wins, A-127); the web app writes after each
  finished edit (create, rename, recolour, drop, resize, delete), serialised in order, and reads the document when the
  canvas opens and on every sync while nothing is unsaved.
- **Motion and smoothness.** Everything that follows a pointer or the zoom is `transform`; no gesture reads layout
  (`getBoundingClientRect` once at pointer-down). The lift of a dragged note (shadow, a slight scale) and the springing
  back are CSS transitions under `html:not([data-motion='off'])`, so Off and Reduced motion show the plain state change.
  No `requestAnimationFrame` loop runs while idle; all listeners are bound through `lib/timers` helpers and removed on
  unmount (ARCHITECTURE 5a). Left-handed mode needs nothing special (owner).
- **i18n.** All text through `t()`, keys in the per-area module `web/src/i18n/locales/<lang>/canvas.ts` (`canvas.*`),
  for `en`, `de`, `de-x-mainfr` and `de-x-coldmirror` (the Fresh Dumbledore voice; crude humour only about Harry Potter
  characters). The new components are added to the raw-text test.
- **Not in this slice**: the Google Drive backup of the document (a later slice), area membership as data, snapping and
  alignment, multi-select, per-note sizes, a minimap.

### Task categories switch (owner, 2026-10-14)

Users find task categories confusing, so a per-person setting "Task list categories" (`settings-task-categories`, Tasks section
of the Settings, pref `taskCategories` in `prefs.json`, default **on** = unchanged behaviour) switches them off.

- **Hidden while off:** the category picker in the task list dialog; the category chips of the Tasks filter sheet and the
  calendar `filter-bar`; the "Category" options of Group by and Sort by; the category icon and colour on every task list
  (cards, Tasks view, Canvas notes, tray, expanded list: a list shows the colour of its calendar, `TaskList.calendarColor`);
  the category list and "Add category" in the Settings.
- **Fall-backs, never stored:** a stored grouping/sorting by category is shown as the default (time / date); category chips of
  the stored Tasks filter and `?categories=` in the calendar URL are ignored (so no list vanishes); the stored values stay
  and apply again when the switch goes on. Pure rules and the binding are `features/tasklists/categories.ts`.
- **Data is kept:** stored `categoryId`s are never deleted; saving a list in the dialog while off omits `categoryId`, so the
  stored one stays. A new list made while off has no category.
- **Events** have no categories (only task lists carry `categoryId`; the calendar `filter-bar` chips filter task lists only), so
  there is no separate event category store to leave alone: nothing about events changes.
- **Why client-side, not the server:** the switch must apply instantly on every screen without refetching items; the server's
  `color` stays category-based and `calendarColor` is added so the client can show the uncategorised colour. Alternative
  weighed: the server drops categories from responses while off (one place, but needs a refetch on toggle and loses the
  stored id in copies). Not covered: Labs views (approach bar, clock, timeline) still draw the category colour (experimental).

### Tasks filter (owner, 2026-10-13)

One filter for the whole Tasks view, shown in `tasks-filter-bar` under the tabs of **Open, Canvas and Archive** alike. It
replaces the calendar's URL-based chips in this view (A-77): the top bar's filter button and the global `filter-bar` are
not offered on `/tasks` (the calendar views keep them).

- **Fields.** Categories: any number of chips (`tasks-filter-category`, `data-id` = the category id or `none`), combined
  with **or**; "No category" is the `none` chip. **When**: exactly one of `all` (default), `nodate`, `dated`, `overdue`,
  `today`, `tomorrow`, `week`; **and** with the categories. Definitions on the app clock's today: `nodate` = no date;
  `dated` = any date; `overdue` = date before today; `today`; `tomorrow` = today + 1; `week` = from today through the
  coming Sunday (the same Sunday as the time groups, `weekEnd`, but including today). No category chip on and When `all`
  = no filter.
- **Where it applies.** Open: non-matching lists are hidden. Archive: hidden too, and **and** with the search. Canvas:
  non-matching notes are **dimmed, not hidden** (opacity 0.25, no pointer events: not tickable, not draggable, `data-dimmed`),
  so the hand-made layout does not vanish; areas are never dimmed. This replaces A-122 (the canvas used to ignore the chips).
- **Pure function.** `matchesTasksFilter(list, filter, today)` and `filterActive(filter)` in
  `features/tasklists/tasksFilter.ts`, unit-tested with fixed dates.
- **Stored per person** (owner): the pref `tasksFilter: { categories: string[], when: TasksWhen }` in `prefs.json`, in
  `GET/PATCH /api/prefs` (API.md "Prefs: Tasks view"), whitelisted: `when` from the list above, `categories` at most 50
  unique strings of 1-64 characters; anything else is `400`. Why a pref and not the URL (the old chips): the choice follows
  the person to other devices, like grouping and sorting. An id of a deleted category matches nothing and can be removed
  with "Clear filters".
- **UI** (owner layout, 2026-10-13: four rows of controls looked messy). Under the tabs `[ Open | Canvas | Archive ]` sits ONE
  toolbar row of compact buttons, the same on all three tabs, then the active-filter chips:
  `[Filter (n)] [Group · Sort] [unfold]`, and below it, only while a filter is on, one removable chip per active filter.
  - **Filter button** (`tasks-filter-open`, count badge `tasks-filter-count` while any filter is on) opens a bottom sheet
    (`tasks-filter-sheet`, an `AdaptiveSheet`) with the category chips (`tasks-filter-category`, multi-select, plus "No category"),
    When as a group of chips (`tasks-filter-when`, `data-value`; options `tasks-filter-when-option`), `tasks-filter-clear` while a
    filter is on, and Done (`tasks-sheet-done`). Choices save at once and stay open (multi-select), Done closes.
  - **Group/Sort button** (`tasks-sort-open`) shows the state as its label, "Category · Date", with " ↕" while the order is reversed;
    it opens `tasks-sort-sheet` with Group by (`tasks-group-by`), Sort by (`tasks-sort-by`) and the direction (`tasks-sort-dir`).
  - **Collapse/expand all** (`tasks-collapse-all`, from the compact task list cards) is an icon button with an `aria-label`
    ("Collapse all" / "Expand all"), `aria-pressed` while all are collapsed.
  - **Active-filter chips** (`tasks-filter-active`, `data-key` = `category:<id>` or `when`): tapping one removes that filter.
  - **Disabled where it does not apply** (A-144): grouping/sorting and collapse-all only exist in Open, so on Canvas and Archive
    the Group/Sort and collapse buttons are disabled (the Canvas has no groups; the Archive's order is fixed, newest finished first);
    the filter applies on all three.
  - The phone's create button slides away (`ui.panelOpen`, one set of names so several panels can be open) while either sheet or
    the Canvas's area editor is open, so it never covers a sheet's buttons.
  Texts: `tasks.filter.*`, `tasks.view.sortTitle`. Why sheets and not inline controls: four stacked rows (tabs, filter chips,
  group/sort/direction, collapse) left little room for the lists on a phone; the sheets cost one tap and keep every control.

### Untitled task lists (owner, 2026-10-12)

A task list may have an empty title when it has at least one item (else "Add a title or an item"). The app shows
such a list as "List" everywhere (card, tray, expanded list): `displayTitle(list)` in one place, the stored title stays
empty. In Google the event summary is the items joined with ", " (so Google's own apps show something useful) and
`extendedProperties.private.untitled = "1"` keeps the app title empty.

### Expanded task list card (owner, 2026-10-14, reworked the same day)

A task list card is only as tall as its time block, so a long list was cut off and the owner had to change the list's
time to see it. A tap on the card now makes **the card itself grow in the same view**: same left, top and width (its
column), same colour, border, font and title as the collapsed card, only taller, "as if it were longer, but it is not
actually longer". Owner decisions (final):

- **Views**: the card in the Day, Week and desktop Month view (`TaskListCard`, every variant). On the phone's month view a
  tap still opens the day (`cardClick`).
- **Growing in place**: the grown card is the collapsed card's own rendering (`TaskListCard` with the prop `grown`) at the
  collapsed card's left, top and width, with the height its content needs (never less than the collapsed card): header
  row, every item one per line (ticked ones struck, with their filled marker), the time foot; the title wraps instead of
  being cut. It lies over the following events, slots or cells (raised z-index, subtle shadow); the calendar underneath
  does not move or reflow, and the collapsed card keeps its size and look (a short time block stays the one-row inline
  card). Placement stays in the visible scroll area: down from the card's top, else up from its bottom, else the roomier
  side with scrolling inside (`placeExpanded` in `features/tasklists/expand.ts`; horizontal position and width are the
  card's).
- **The real duration stays recognisable**: the grown card is drawn by two layers behind the same content. The part over
  the list's real time block (`tasklist-grown-real`, the collapsed card's height) looks exactly like the normal card; the part
  that only extends it (`tasklist-grown-ext`, below the real end, or above the real start when it grows up) is inset 5 px
  from both sides, a lighter tone of the card colour, with a thin seam at the real end. The item rows run on across both.
- **Read-only everywhere**: in every view, the Day view included, the grown card shows done markers only. It has no
  checkboxes, no edit button, no close button, no resize handles and no drag.
- **A tap anywhere on the grown card opens the normal list sheet** (`ExpandedTaskList`, the same dialog a calendar tap
  opened before this feature): item rows and their markers included, they never toggle an item. Ticking, adding, renaming
  and editing the list happen in the sheet.
- **Flow**: tap 1 on the collapsed card grows it; tap 2 on the grown card opens the sheet. The grown card collapses on a tap
  elsewhere (capture-phase click outside; the tapped control still does its own thing), Escape, the system back
  (`useOverlayHistory`), a change of view or date, a scroll that takes the card out of sight, a dialog or the sheet opening,
  the list being deleted, or another card growing. One at a time; `ui.expandedCard` (`{ id, date }`), never stored.
- **Long press stays as it is**: pick up for drag, release in place shows the resize handles (`useCalendarDrag`).
- **Fix 2026-10-14 (owner: month "wtf", narrow column, scrollbars, lag)**: a time block's grown card spans its whole day column
  (inside the border, over side-by-side neighbours; the collapsed card keeps its slot); the real/extension layers are only for time
  blocks. A month (and zoom month) `card` has no time axis: it grows to its content height at the cell's width, one plain card, no
  layers (`flat`). Only the tapped card grows (the zoom month holds the same list in two layers). No scrollbars and no sideways
  overflow (`overflow-x: hidden`, hidden bar, words wrap). A tap on the grown card's title row collapses it, anywhere else
  opens the sheet. A time block's card is teleported into the time grid's own `.grid` (absolute, content coordinates) so the browser
  scrolls it natively, without lag; other cards stay a fixed body overlay re-placed on scroll.
- **Fix 2026-10-14 (2) (owner: "breaks when you zoom", "duplicate", "grow only if there is not enough space")**:
  - *Zoom bug (root cause)*: the time-grid copy was placed from a pixel snapshot of the collapsed card. A zoom commit lays
    the blocks out again at the new hour height, but nothing re-placed the grown copy, so it stayed at the old top and height
    while the real card moved: two cards on screen. **To Be**: a time block's grown card is placed in **time units**, like
    every other block: its top and the real layer's height come from the list's start and duration × the hour height
    (`--hh`), so it follows the live pinch preview (the grid's transform) and every zoom commit by itself, and stays exactly on
    its collapsed card. Only the parts that depend on the screen (grow direction and max height inside the visible scroll
    area) are measured, and they are re-measured when the hour height changes.
  - *Same rendering as the other cards*: still `TaskListCard` (`grown`) with the two layers (owner: keep them), but laid out
    and scaled the way an inline calendar block is: same padding, the header row never wider than the item rows, the real
    layer exactly the list's time block at the current zoom. Long words hyphenate (`hyphens: auto` with the document
    language) instead of breaking at an arbitrary letter.
  - *Grow only what's needed* (owner's choice): the card goes to the full day-column width only when its own slot cuts the
    title or items; it grows taller only when items are cut. A card that already shows its whole title and every open item
    does not grow at all: a tap opens the list sheet directly (as the second tap would).
  - **Fix 2026-10-14 (3), width only as needed (owner, screenshot: a 15 min "Einkaufen" beside "Abend zu zweit" grew to the
    full screen width with short items)**: the first build read the rule above as "any cut → the full column". To Be: the grown
    card is **only as wide as its content needs** (the widest of its title row and item rows at their natural, unwrapped
    width, plus the card padding), never narrower than its own slot and never wider than the day column (inside its border);
    it keeps the slot's left edge and only widens to the right, unless that would leave the column, then it shifts left
    just enough. Its height is its content height (never less than the real time block). Text wraps only when the content is
    wider than the column. The same holds in the week and the day view.
  - **Why**: the pixel snapshot (re-placed on events) was the source of the duplicate; re-placing on another event (hour
    height watch) would fix this one trigger but stay a separate positioning system that can drift again. Laying the copy out
    in the grid's own time coordinates makes it scale like every other block by construction (owner: "it can't be a
    completely separate component, it should be the same scaling-wise as any other inline calendar event").
  - *Zoom keeps the card (owner: "zooming closes the card")*: the "out of sight" close in `place()` looked at the collapsed
    card only. A zoom around a point below the anchor (a pinch on the grown card's extension) moves the anchor's time up and
    off the top while the grown card, which hangs down from it, is still on screen. **To Be**: the expansion closes only when
    neither the collapsed card nor the grown card intersects the visible scroll area (`anchorVisible` on both rects). A zoom
    that really takes the card's time out of view still closes it; one tap on the card then grows it again (`ui.expandedCard` is
    null after every close path, covered by the `@expand-zoom` scenarios for Escape, tap elsewhere and zoom).

**Components.** `TaskListCard` owns the toggle (`aria-expanded` on the collapsed card, `ui.expandCard` (a set: a tap on a collapsed card always expands), collapse on unmount; a
swipe preview copy never grows). It mounts `ExpandedCard.vue` (lazy chunk), a `position: fixed` wrapper teleported to the
body (so no ancestor's `overflow: hidden`, such as a month cell, clips it) at the collapsed card's box, re-placed on scroll,
resize and content size change. Inside it renders `TaskListCard` again with `grown`: every item shown, nothing cut or faded,
no drag handlers, wrapping title, `height: auto` with `min-height` of the collapsed card; a click emits `open-list`, which
`ExpandedCard` turns into `ui.openDialog('tasklist-expanded')` after moving the focus to the collapsed card (the sheet's
opener). `TaskListView` is untouched by this feature.

**Accessibility.** The collapsed card has `aria-expanded`; the wrapper is a `role="group"` named after the list; the grown
card is a button, focused on open (Enter or Space opens the sheet) and the focus returns to the collapsed card on close
(unless the person already focused something else). **FAB**: while it is open the wrapper registers the panel
`expanded-task-card`, so the phone's "+" slides away and covers no control of it.

**Why (alternatives weighed).** (a) A separate popover panel with its own header (the first version of this feature) was
rejected by the owner: wider, differently styled, and its header squeezed the title. (b) Growing the card's own element
inside its cell would push the layout, and a month cell or the all-day row clips overflow; a teleported fixed copy is the
same card visually, never clips and never reflows, at the price of re-placing on scroll. (c) Reusing `TaskListCard` (a
`grown` mode) instead of a second renderer keeps the one look the owner asked for. (d) Read-only plus the sheet keeps
ticking (rewards, support cat, `markFinished`) in one place, `TaskListView`.

### One "new" dialog (owner, 2026-10-12)

The FAB and a tap on an empty time slot (or all-day cell) open the same dialog with a segmented switch "Event | Task
list" at the top (last choice remembered per device); the event form and the task list form are the existing dialog
bodies, sharing the prefilled date/time so switching keeps them. No create menu.

### Rounded fields and shapes (owner, 2026-10-12)

Text fields, selects and text areas are fully rounded (radius follows the theme's corner setting, ~12 px by default),
softly filled, with no bottom indicator line; focus shows a 2 px primary outline. Buttons, chips, cards and dialogs use
the same corner scale so shapes look consistent.

### Theme engine and AI themes (owner, 2026-10-13)

- **One theme document format**, `calendar-theme/2` (JSON, schema in `shared/theme.schema.json`, used by server and
  web): only simple fields, so an AI cannot easily break it: `{ schema, name, author?, description?, mode: "follow"|
  "light"|"dark", colors?: { seed?: hex, light?: {role: hex}, dark?: {role: hex} }, glow, entries, corners, font?,
  scene? }`. `seed` generates the whole colour scheme; the optional role overrides are few (`primary`, `on-primary`,
  `secondary`, `tertiary`, `background`, `on-background`, `surface`, `on-surface`) and replace single roles of it.
  `font` is a curated list (`system`, `serif`, `rounded`, `mono`). `scene` is `{ builtin: name }` or `{ gradient: [2–3
  hex colours], decor?: stars|sparkles|waves|hills|hearts|clouds|confetti|bubbles, density?: low|medium|high }`
  (density defaults to medium; no decor = the plain gradient). **The document never contains SVG** (owner, after real
  AIs broke raw SVG inside JSON: unescaped quotes, chat UIs turning URLs into markdown links, missing closing tags);
  this replaces the earlier `calendar-theme/1` with an SVG scene (never released). The built-in presets are expressed
  as such documents too, so there is a single apply path (`applyTheme(resolved)` → html attributes + CSS custom
  properties); fine-tuning overrides stay on top of a document as before.
- **The app draws the gradient scene** (`DrawnScene`): a vertical gradient of the given colours with the decor drawn
  by the app (own SVG shapes, not user markup) in a fixed pseudo-random layout per decor; `density` = number of shapes
  (low 8, medium 16, high 28; for `waves` and `hills` the number of layers 1, 2, 3). In dark mode the gradient is
  dimmed. The decor moves subtly (twinkle, drift, sway) only at the Full animation level. Testids: `top-bar-scene`
  `data-scene="custom"` containing `drawn-scene` with `data-decor`.
- **Own top bar picture (SVG), separate from the document** (optional): a light SVG and an optional dark one, pasted
  (`theme-picture-text`, `theme-picture-dark-text`) or uploaded (`theme-picture-file`, `theme-picture-dark-file`,
  `.svg`, ≤ 100 KB). It overrides whatever scene the document has. The server stores it next to the document
  (`POST /api/themes { theme, picture }`). Safety: sanitised on the server and again in the browser with an SVG
  allow-list (DOMPurify SVG profile): no `script`, `foreignObject`, `style`, `use`, animation or event-handler
  attributes, external `href`/`url()` (only `#fragment` refs), no `<image>`; ≤ 100 KB per variant. Rendered only as an
  image (`<img src="data:image/svg+xml;…">`), never inlined, so even a sanitiser gap cannot run code; it carries its own
  colours (missing dark → light). Whatever was removed is reported (`theme-import-sanitized`). Alternative weighed:
  inlining (could use theme tokens) — rejected for safety.
- **Create with AI**: `theme-ai` shows a short generated prompt (`theme-ai-prompt`, read-only, copied with
  `theme-ai-copy`): what the app is, "answer with only the JSON in one code block, no SVG", the full JSON Schema, the
  decor options, the contrast rule (light and dark), one complete example, and a slot for my wishes. No AI is called.
- **Import** is forgiving: paste (`theme-import-text`) or file (`theme-import-file`, `.json`/`.txt`, ≤ 200 KB). Before
  parsing, a Markdown code fence (```` ```json … ``` ````) is stripped, text outside the outermost `{ … }` is dropped
  and Markdown links `[x](y)` are turned back into the URL (`y`). Invalid JSON shows the hint "This is not valid JSON.
  Ask the AI to answer with only the JSON in one code block." (plus the parser's message); a schema problem shows
  readable messages (field + rule, e.g. "glow must be one of off, soft, neon"). With any error, `Copy repair prompt`
  (`theme-repair-copy`, text in `theme-repair-prompt`) copies a prompt with the error list and my text that asks the AI
  to fix its JSON. Valid → preview (gallery card) → save. Copying works over plain http (`copyText`).
- **Stored** per person on the server: `DATA_DIR/users/<sub>/themes/`, `GET/POST/DELETE /api/themes` (max 20 themes;
  the server validates and sanitises again). Imported themes appear in the gallery with export (download the
  document) and delete (undo snackbar).
- **Behind a Labs switch for now** (owner): only the AI part, "Create with AI" and the import (paste, file, own
  picture; testid `theme-own`), shows with the person's pref `labsOwnThemes` (default off, settings switch
  `settings-labs-own-themes`, "Own themes (AI and import)", subtitle says it is experimental). Saved own themes (imported
  or saved from the menu) always show in the gallery with export and delete, and a chosen one always applies, whatever
  the switch says; the switch hides no data.
- **Save as my theme** (not under Labs): `theme-save-own`, the last control of Fine-tuning, turns the look in use
  into an own theme: the chosen preset or theme plus every fine-tuning choice (mode, seed colour, glow, entries,
  corners, font, role colours) and the scene in use (built-in, drawn blocks, or the own picture, which is saved as the
  picture) become a `calendar-theme/2` document, saved with `POST /api/themes`. A small dialog (`theme-save-dialog`)
  asks for a name (`theme-save-name`, default "My theme", at most 40 characters, not empty; a name already in use gets
  a number: "My theme 2"); `theme-save-confirm` saves, and the new theme becomes the chosen one (its fine-tuning is
  now part of it, so the overrides are cleared).

### Backups (owner, 2026-10-13)

All server-side data of one person is backed up to **the hidden app folder of that person's Google Drive** and can be
restored from there. Owner decisions are final; the numbers and names are mine (A-180 .. A-195).

- **Where (owner).** Drive's `appDataFolder` with the scope `https://www.googleapis.com/auth/drive.appdata`. Reasoning:
  the scope is non-sensitive (no Google verification beyond the calendar one), the app sees only its own invisible
  folder and never the person's files, and a backup the person cannot see cannot be deleted or edited by accident.
  Alternatives weighed: the full `drive.file` scope (a visible folder, more access than needed) and a backup on the same
  server (no use when the server is lost). The scope is added to `SCOPES` of the OAuth request, so every new sign-in asks
  for it together with the calendar.
- **Permission and re-consent (owner).** The token file `users/<sub>/google-token.json` also keeps the `scope` string
  Google returned (`{ refresh_token, scope }`). Backups are on only when that string contains the appdata scope. A
  token without a `scope` (everyone signed in before this feature) counts as "missing". Google lets a person untick
  single permissions on the consent screen, so the returned `scope` is the only reliable answer; a token that lacks it
  gets no backup attempt at all. Settings then shows "Allow backups to Google Drive" (`settings-backup-allow`), which
  re-runs the normal consent (`/api/auth/google/start`, remembering `/settings` as the page to return to). The callback
  stores the new token and scope; backups start without a further step.
- **What is backed up.** One JSON document per backup: `{ schema: 1, created, appVersion, sub, files }` where `files`
  maps a path relative to `DATA_DIR` to the file's UTF-8 content. It is everything under `DATA_DIR/users/<sub>/` (prefs,
  theme, own themes and pictures, canvas, any future per-person file, found by walking the folder, so a new store needs
  no change) plus the files of the **registered sources** (below). Never included: `google-token.json` (a secret that
  must not leave the server) and `backup-state.json` (the bookkeeping of the backup itself); temp files are skipped.
  Pictures are inline SVG text, so the document stays small (limit 5 MB, see below). Global stores (`settings.json`
  categories, `motivation.json` streak and plant) belong to no person in this version, so they are **not** in the
  backup (A-187).
- **Registry hook for other stores.** `ctx.backup.registerSource({ prefix, collect(sub), restore?(sub, files) })` adds
  files to every person's bundle. `prefix` is the top-level folder under `DATA_DIR` the source owns (e.g. `shared`);
  `collect` returns `{ 'shared/lists/<id>.json': content }` for the person. Restore writes back only paths under
  `users/<sub>/` or under a registered prefix, so a bundle can never write elsewhere; a source with `restore` receives
  its files instead of having them written verbatim.
  **Shared lists** (coordinator, 2026-10-13): `server/src/services/sharedListsBackup.ts` is the adapter, wired in
  `createContext` with one line: `registerSharedListsBackup(backup, shared, config.dataDir);`. Rules: the **owner's**
  bundle holds the lists they own (`shared/lists/<id>.json`); a **member's** bundle records only the ids of the lists they
  belong to (`shared/memberships/<sub>.json`, `{ listIds }`); a **restore** recreates the lists the restoring person owns
  (by the `owner` field) and does not act on the member record or touch others' lists. The adapter calls
  `SharedListService.reload()` afterwards, because the store caches the lists in memory. Changes by a member trigger only
  that member's backup; the daily backup catches the owner's.
- **Server-wide files (owner: "ALL data").** `settings.json` (categories), `motivation.json` (streak, plant),
  `people.json` and `shared/category-shares.json` belong to no person. They go into **every** person's bundle as
  `server/<path relative to DATA_DIR>` (`services/serverFilesBackup.ts`; another server-wide store adds one
  `backup.registerServerFile({ rel, pristine, reload })` call). On restore they come back **only onto a fresh server**:
  every registered file must be "pristine" (settings still at version 1, no check-ins or plant growth, no category
  shares, no person in `people.json` other than the one restoring). One file in use means none is touched, so a
  per-person restore never overwrites what other people use. Each store re-reads its file (`reload()`) afterwards.
  Reasoning: an exact "no such files" test cannot work, because the server creates `settings.json` with defaults at
  start and records the restoring person in `people.json` at sign-in; "untouched" is the honest meaning of fresh.
  A person with only server-wide changes and no data of their own is still not backed up (A-181). Not backed up:
  `sessions.json`, the mock stores and secrets.
- **Versions (owner).** Each backup is a new Drive file `backup-<sub>-<UTC timestamp>.json`; the last **7** versions
  (`BACKUP_KEEP`) are kept, older ones are deleted after a successful upload (a failed delete is logged, never fatal).
  The server logs the number at start (`backup: keeping the last 7 versions`). A person without data is not backed up
  at all (A-181), so an empty bundle can never push good versions out.
- **When (owner).**
  - *After changes:* every successful non-GET API call of a signed-in person (except `/api/backup*`, `/api/auth/*`,
    `/api/__test/*`) marks that person dirty (one middleware in `app.ts`, so no store has to call anything). The backup
    runs **2 minutes after the last change** (`debounce`) and **at least 5 minutes after the previous backup**
    (`minInterval`): `delay = max(lastChange + 2 min, lastRun + 5 min) - now`. A run whose files are identical to the last
    backup (SHA-256 of the sorted files) is skipped, so calendar writes that change no server data cost nothing.
  - *Daily, regularly (owner):* a server timer checks hourly (first check one minute after start) and runs a **forced**
    backup for every person whose last backup is 24 h or more old, or whose last attempt failed, even when nothing
    changed. People are found by their token file, so a person who never opens the app is still backed up.
  - *Manual:* "Back up now" (forced, no throttle). The timers are in-process only; nothing is persisted but
    `backup-state.json`.
- **Restore (owner).**
  - *At sign-in:* after the callback stored the token, when the person has the permission, the server has **no data**
    for them (no file under `users/<sub>/` besides the two excluded ones) and a backup exists, the newest readable
    version is restored before the session is created, then sign-in goes on. A failure only logs (sign-in never
    fails because of a backup) and sets `restorePending`; the next backup run or daily check retries the restore first.
    If the person has data again by then, the new data simply becomes one more version (the old versions stay).
  - *Manual:* "Restore from backup" asks for confirmation (it overwrites the person's server data), takes a **safety
    backup** of the current data first (if that fails, nothing is restored), picks the newest readable version as it was
    **before** the safety backup, deletes the person's files under `users/<sub>/` (except the two excluded ones) and writes
    the bundle's files. The page then reloads so every store reads the restored data. Pressing it again undoes the
    restore, because the safety backup is then the newest version.
- **Failures (owner).** A backup runs outside the request that triggered it; any error is caught, logged
  (`backup failed for <sub>: …`) and stored in `backup-state.json` (`error`, `errorAt`). Settings shows "Last backup
  failed: <reason> (retrying)"; "retrying" is true to the letter: the person stays dirty, the next change or the next
  hourly check tries again (no extra timer). Normal use is never blocked: a failed Drive call never reaches the request
  that changed data, and `GET /api/backup` itself never calls Drive.
- **Drive client.** `server/src/providers/DriveClient.ts` is the interface `{ list(prefix), create(name, content),
  get(id), delete(id) }` over one person's appDataFolder. `providers/google/GoogleDrive.ts` implements it with `fetch`
  and the person's OAuth client (Drive API v3: `files.list` with `spaces=appDataFolder`, `files.create` with
  `parents: ['appDataFolder']` and `uploadType=multipart`, `files.get?alt=media`, `files.delete`). Multipart upload
  carries up to 5 MB, far more than a bundle of text; a bigger bundle fails with a clear error instead of a resumable
  upload (A-190). `providers/mock/MockDrive.ts` implements the same interface for `TEST_MODE` over
  `DATA_DIR/mock-drive.json` (one folder per sub), with a switch that makes every call fail. One contract test runs
  against the mock; the Google client is covered by a request-shape test with a stubbed `fetch`.
- **Pure helpers** (`server/src/services/backup.ts`): `bundle`, `unbundle` (validates schema, paths and contents),
  `selectExpired` (retention), `backupName`, `debounceDelay`, `contentHash`. The orchestration (`BackupService`:
  timers, state file, serialising runs per person, restore) is in `services/backupService.ts`.
- **API.** `GET /api/backup`, `POST /api/backup`, `POST /api/backup/restore` (API.md "Backups"). Test hooks:
  API.md "Test-only endpoints".
- **Client.** Settings, Account & data: `settings-backup-status` (`data-state` = `off | never | ok | failed`,
  `data-last-backup` = ISO instant), `settings-backup-now`, `settings-backup-restore` with a `ConfirmDialog`, and
  `settings-backup-allow` while the permission is missing. All texts via `t()` in `locales/*/backup.ts`. The block is
  hidden while sign-in is off (`available: false`), because backups need a Google account.
### Shared lists (owner, 2026-10-14)

A person can share a task list, or a whole category, with another person who has their own Google login. The owner
decided every point below.

- **Storage: the server, not Google.** A shared list is one JSON document `DATA_DIR/shared/lists/<id>.json`
  (`version`, `id`, `rev`, `owner` = Google `sub`, `members` = subs, `updated`, and the list: title, items, date/time or
  undated, tags, estimate, `completedOn`, canvas place, the owner's `categoryId` and a `category` snapshot name/colour/icon).
  One file per list: atomic writes (temp file + rename, as every store), no contention between lists, and a later
  Google Drive backup of the server data takes the files as they are. The category rules (who a category is shared
  with) are one document `DATA_DIR/shared/category-shares.json` (`owner sub -> { categoryId -> member sub }`). Known
  people (`sub -> email, name`, written at every sign-in) are `DATA_DIR/people.json`.
- **Why not a shared Google calendar** (alternative weighed): a calendar shared in Google would need the partner to
  accept an invitation, would expose the owner's whole tasks calendar or need a second one per person, and gives no
  per-list ownership, "leave" or per-category rule. The owner chose server storage. The price: a shared list is not
  visible in Google Calendar and is not covered by Google's own backup until the Drive backup slice.
- **Two ways to share, one store.** Per list (the task list dialog: "Share with ...", "Stop sharing") and per
  category (Settings, Categories: "Share with ..."). The per-list way is the building block: *sharing MOVES* the list
  from the owner's tasks calendar into the shared store (the Google event is created in the other direction by
  "Stop sharing", with a new id). The per-category way is a rule on top: toggling it moves every list of the category,
  and a list created in the category is created shared. Both are wanted because a single list is the everyday case
  ("the groceries"), while a category ("Shopping", "Home") is how a couple thinks about what they run together.
- **One API surface.** Shared lists are served by the existing task list endpoints under ids `shared:<id>`
  (A-162): the `CalendarService` of every person merges the lists they own or are a member of into its range reads,
  Tasks view reads and item ops. The web treats shared and own lists alike; only the badge, the share controls and
  "Leave" are new. `SharedListService` owns the store, membership checks and the rules; the owner's `CalendarService`
  does the Google side of moving in and out.
- **Both people edit everywhere** (calendar views on the list's date, tray, Tasks view with Open/Canvas/Archive and
  the filter): ticking, adding, editing, deleting items, renaming, re-dating. A small badge (`tasklist-shared-badge`)
  shows the other person's initial. The canvas place is one place for both (the list's, not per person).
- **Category of a shared list** (owner: the partner's categories differ). The list carries the owner's category
  (`categoryId` plus a snapshot of name, colour and icon). Everyone sees that name, colour and icon, whatever their own
  categories are. A member cannot change the category; the owner's rename, recolour or deletion of the category
  refreshes (or clears) the snapshot.
- **Deleting.** Only the owner deletes a shared list for everyone (`DELETE`, undo as usual). A member sees "Leave"
  (`tasklist-leave`) instead of "Delete": it removes the list for them only (A-165).
- **Concurrency** (owner: the same optimistic approach as Google events). Every list has a version counter `rev`; its
  etag is the counter. A list write with a stale `If-Match` is refused with `412` and the existing conflict UI
  ("This task list was changed elsewhere ..."). Item ops read-modify-write the latest version, so two people ticking
  different items never conflict. The server writes synchronously (one process), which makes each write atomic.
  Polling is unchanged: the partner's changes appear on the next sync. No websockets.
- **Security.** Every shared-list route checks `owner === caller || members.includes(caller)`; anyone else gets `404`.
  Members must be on the allow-list and known (signed in once). Sub values are validated before they reach a path.
- **People picker.** "Share with ..." lists the allowed people other than yourself (`GET /api/people`) by name, else
  email. A person who never signed in has no `sub` yet and is not offered (A-161).
- **i18n.** All new text is in `locales/<lang>/sharing.ts` (`en`, `de`, `de-x-mainfr`, `de-x-coldmirror`).
- **UI test contract.** `tasklist-shared-badge`, `tasklist-share-person`, `tasklist-share`, `tasklist-unshare`,
  `tasklist-leave`, `category-share-person`.
### Android app and widget (owner, 2026-10-13)

An Android app that loads the calendar server the person chooses (the public one or the LAN one), plus a resizable weekly
home-screen widget. Code in `android/`
(Capacitor 8, Java), `capacitor.config.ts` at the repo root, web side in `web/src/native/`. The web app's behaviour in a
browser does not change.

- **The app is a Capacitor shell, not a TWA.** The WebView shows the deployed web app of the chosen server and updates with
  every deploy (no re-install). Alternatives weighed: a Trusted Web Activity (Chrome Custom Tabs; needs HTTPS and a Digital
  Asset Links file, and the LAN deploy has no HTTPS: impossible there); a bundled copy of the web app (would need its own
  build and update path, and the API is on another origin anyway). Cleartext is allowed for one host only, by
  `res/xml/network_security_config.xml` (`cal.mordor.lan`; every other host, `cal.example.org` included, is HTTPS-only).
  The Capacitor `cleartext` option is for live reload only and is not set. An offline page (`android/www/error.html`,
  `errorPath`) shows when the server is unreachable. App name "Calendar", id `lan.mordor.calendar`, icons from the PWA icons.
- **Server choice (owner, 2026-10-14: one app, the server selectable).** Two servers are on offer, in `widget/ServerConfig`
  (the one place that knows them; any other URL is rejected): `https://cal.example.org` ("everywhere (internet)",
  recommended, listed first) and `http://cal.mordor.lan` ("home network only"). The choice is stored in SharedPreferences
  (`calendar_server`, key `baseUrl`). On the first start (nothing stored) the bundled page `android/www/index.html`
  ("Which calendar?", English or German by the phone's language) shows; later starts load the stored server directly.
  - **How the chosen origin is loaded.** Capacitor's `server.url` is static in `capacitor.config.ts`, so it is not set there.
    `MainActivity` builds the runtime config instead (`CapConfig.Builder`, assigned to `BridgeActivity.config` before
    `super.onCreate`): `setServerUrl(<chosen>)` with a choice, no URL without one (then the bridge serves `android/www`).
    A choice or a switch calls `Activity.recreate()`, which builds the bridge again for the new origin.
    Alternatives weighed: (a) `server.url` = the local chooser page plus `allowNavigation` for both hosts, then
    `loadUrl(chosen)`: rejected, because Capacitor injects its JavaScript bridge (`native-bridge.js`, which fills
    `window.Capacitor.Plugins`) with `WebViewCompat.addDocumentStartJavaScript` for the origin of `appUrl` only
    (`Bridge.loadWebView`: `allowedOrigin` = origin of `appUrl`; `allowNavigation` hosts are only added to the
    `addWebMessageListener` allow-list in `setAllowedOriginRules`), so on the other origins `window.Capacitor` would not
    exist and every plugin (widget snapshot, reminders, the Settings row) would silently stop working; (b) `loadUrl` from
    `MainActivity` on a bridge made for the local page: same problem. With the chosen server as `appUrl` the bridge is
    injected there, `window.Capacitor.isNativePlatform()` and all plugins work on **both** origins (verified in
    `@capacitor/android` 8.5.3 source: `Bridge.java`, `MessageHandler.java`; not verified on a device by me). Limit: the
    WebView history is lost on a switch.
  - **The chooser and the offline page have no JavaScript bridge** (their origin, `https://localhost`, is not `appUrl` once
    a server is chosen; at the first start they could, but one mechanism serves both). Their buttons are plain links to
    `https://localhost/__server/<fresh|mordor|choose|retry>`, which the plugin `ServerChoice` intercepts in
    `shouldOverrideLoad` (Capacitor asks every plugin before it opens a URL): choose stores and recreates, `choose`
    clears and recreates, `retry` reloads the stored server. The offline page offers "Try again" and "Choose another
    calendar", so someone who picked the LAN server while away is never stuck.
  - **Switching later.** In the web app, Settings → Account & data shows "Server: cal.example.org" with a **Change** button,
    only inside the app (`window.Capacitor`; the host comes from `ServerChoice.get()`). **Change** calls
    `ServerChoice.choose()`: the choice is cleared and the chooser shows again. Keys `settings.account.server.*` in all four
    locales.
  - **Widget and deep links follow the server.** The widget's API call uses the stored base URL and `CookieManager`'s
    cookie for that host (the jar is per host, so each server keeps its own session). When the choice changes or is cleared,
    `WeekWidgetProvider.onServerChanged` drops the cached week, the snapshot and the fetch state, redraws and fetches
    again; a fetch still running for the old server discards its answer. `/day/<date>` and `/week/<date>` from the widget
    open on the stored server (`MainActivity.openPathFrom`); with no server chosen they are ignored.
  - **Google sign-in (owner bug, 2026-10-14: "invalid state").** Cause: Capacitor opens every navigation to a host other
    than the app's own in the system browser (`Bridge.launchIntent` -> `ACTION_VIEW`; `@capacitor/android` 8.5.3
    `BridgeWebViewClient.shouldOverrideUrlLoading`, which also sees server redirects). So `/api/auth/google/start` ran in the
    WebView (state cookie set there), the redirect to `accounts.google.com` left for Chrome, and the callback landed in
    Chrome without the `cal_oauth_state` cookie -> `Invalid state`; the session cookie would have ended up in Chrome too.
    Letting the WebView open Google is no fix: Google refuses OAuth in embedded WebViews (`disallowed_useragent`).
    Design (the standard native-app pattern): the whole round trip runs in the **system browser**, the session comes back by
    **deep link + one-time code**:
    1. `ServerChoicePlugin.shouldOverrideLoad` catches the WebView's navigation to `<server>/api/auth/google/start` (all
       three web entry points: sign-in page, re-auth banner, grant calendar) and opens `<server>/api/auth/google/start?app=1`
       in a **Custom Tab** (`androidx.browser`, `ACTION_VIEW` only as fallback; `AppSignIn.browserUrl`). No web change, no extra plugin.
    2. The server remembers `app` with the `state`; the callback (state cookie lives in Chrome, so the check holds) creates the
       session, but instead of the cookie it mints a 128-bit, single-use, 60 s code (`auth/appExchange.ts`, in memory) and
       answers an immediate **302 to a Chrome `intent://` URL** (`appIntentUrl`: `scheme` + `package` pinned to the app,
       `S.browser_fallback_url` = `/api/auth/app-open?code=...`, a page with the script launch and the `#open-app` button).
    3. `MainActivity` declares an intent-filter for that scheme/host (`singleTask`, so `onNewIntent`/`onCreate` get it) and
       loads `<server>/api/auth/app-exchange?code=...` in the WebView (`AppSignIn.exchangeUrl` accepts only a well-formed code
       of the chosen server); the server sets the normal session cookie and redirects to `/`. An unknown or used code shows
       a friendly "sign in again" page.
    **App sign-in hang (owner, 2026-10-14: "opens the new page, I have to tap the address bar and press Enter").** Stage
    unknown (the owner could not say). Evidence: Chrome documents that it does not launch an app for a script-started
    navigation without a user gesture (developer.chrome.com/docs/android/intents), which is exactly the old callback page
    (`location.replace` on load): it sat there. A reload of the callback cannot be what helped (state and code are single-use,
    it would answer "Invalid state"), so the owner's reload is likelier at the start page; that stage is not provable
    without a device, hence the `auth_flow` lines (start -> callback -> fallback? -> exchange): the first missing line is
    where it stops. Fix: Custom Tab for the start, and a redirect (not script) to the intent URL, which Chrome follows after
    the user-initiated consent tap; the fallback page keeps a tap-able button (a gesture). Not verified on a device.
    Alternatives weighed: `@capacitor/browser` (Custom Tab; needs a new dependency, JS bridge call from every sign-in entry
    point and a Gradle sync, for the same effect as an `ACTION_VIEW`; Custom Tabs would only add the in-app look); a Custom
    Tab/`AppAuth` client with a native redirect URI (Google's Android OAuth client type would need a second client and token
    handling in the app, while the server holds the refresh tokens by design); `appUrlOpen` from `@capacitor/app` (a second
    dependency; the activity gets the intent natively anyway). Cookie jar sharing between Chrome and the WebView does not
    exist, hence the code. The browser flow (no `app=1`) is unchanged. Known limit: any app can fire the deep link, so a
    foreign code would sign the owner in as someone else (login CSRF); a PKCE-style verifier would close it, not done (the
    code is bound to an allow-listed person and lives 60 s). Not verified on a device (no Android build locally).
- **Widget data: the widget calls the existing API itself, with the app's own session. No new server auth, no key.**
  Android's `CookieManager` is app-wide and shared with the WebView, so the widget's native code (`RefreshWorker`)
  reads the `cal_session` cookie for the chosen server and calls `GET /api/items?from=<Monday>&to=<next Monday>`
  (one request; task lists are in the same response). With `PROVIDER=mock` sign-in is off and no cookie is needed.
  Refresh: a periodic WorkManager job (every 30 min, network required) plus a one-off job when a widget is added, when
  the app finishes a sync (through the plugin, at most every 2 min), on the refresh icon, at midnight/time change.
  Alternatives weighed: a long-lived widget API key (the owner's first choice, then replaced: a second credential to
  issue, store and revoke), and snapshot-only (the widget would show data only as fresh as the last time the app was
  open: a week-old view after a quiet week).
- **The app-written snapshot stays, in a smaller role.** Each time the web app finishes a sync, and when it starts
  (only inside Capacitor: `window.Capacitor`; `web/src/native/widgetBridge.ts` is loaded lazily, so the first-load JS
  budget does not change), it calls the native plugin `WidgetBridge.setSnapshot({ json })`. The plugin stores the JSON
  in SharedPreferences (`calendar_widget`) and asks the widget to redraw. The snapshot (`buildWidgetSnapshot`, a pure
  function, `web/src/native/widgetSnapshot.ts`) holds: `v`, `generatedAt`, `language`, `dark`, the theme colours
  (primary, onPrimary, primaryContainer, onPrimaryContainer, surface, surfaceContainer, onSurface, onSurfaceVariant,
  outlineVariant), `weekStart`, the seven days with their events (`title`, `allDay`, `start`/`end` as `HH:mm`,
  `color`) and today's task lists (`title`, `done`, `total`, `color`). The widget uses it for the **theme and the
  language** (always) and as the **fallback data** when the API call fails. The week is read from the server at most
  every 10 min for the snapshot (an extra request, only in the app).
- **What the widget shows** (default 4x2, resizable): the week view of the app in miniature (owner, 2026-10-13: "more like
  the actual weekly calendar view, same with the lists"). Top to bottom: the week range as the header (tap: opens
  `/week/<Monday>`) and a refresh icon; a weekday + date row (today as a filled pill, like the app's today circle); an
  **all-day band** (multi-day events as bars across their days in lanes, then per day the all-day events and the untimed
  task lists, as many rows as fit with a "+N" row; the band takes at most 40 % of the free height); an **hour grid** with
  hour lines, labels, a tinted today column and a **now line** on today; a footer "Updated HH:MM" / "Stand: HH:MM". Timed
  events are rounded colour blocks placed and sized by start and end (title, the time when tall enough); timed task lists
  are blocks of their estimate (30 min without one) in their category colour with a task checkbox, `done/total` and, when
  tall enough, the names of the open items; blocks that overlap sit side by side or cascade, by a Java port of the web's
  `packColumns` (`WeekLayout.packColumns`, same constants: 15 min start gap, depth 3). Which items go where mirrors the web
  (`itemSegments`, `computeBars`): timed lists and events in the grid, untimed lists and all-day events in the band, events
  of two or more days (timed ones from 24 h) as bars, an undated list nowhere, an open list from the last 30 days carried over
  to today. The hour range is **fitted** to the earliest start and latest end of the week (whole hours, at least 6 h, within
  0 to 24; 08 to 18 for an empty week). Colours, the entry style (solid, tinted, outline) and the corner shape follow the
  snapshot's theme, dark or light; without a snapshot the widget follows the system and the default theme.
  A tap on a day column (header row to the bottom) opens the app at `/day/<date>` (an intent extra the `MainActivity`
  turns into a WebView navigation; only `/day/` and `/week/` paths with a date are accepted). Which data is shown: the last fetch
  whenever it is for the current week, else the snapshot (owner bug 2026-10-14: the snapshot is stamped when written but its
  week may be cached up to 10 min, so "newest stamp" let stale snapshots revert the widget; a snapshot triggers a fetch at
  most every 30 s). The snapshot as data has no timed task lists, so it is only
  the fallback: events in the grid, today's task lists in the band.
- **The week is one bitmap, because RemoteViews cannot do a time grid.** A widget's views are the RemoteViews subset
  (`FrameLayout`, `LinearLayout`, `TextView`, `ImageView`, ...), placed by a layout pass: there is no absolute position, no
  `top`/`height` in minutes, no overlap, so blocks proportional to time, placed side by side and cut at the hour range cannot
  be built from views (a `LinearLayout` per column with spacer weights would need one view per block and per gap, a layout
  per resize, and still no overlap or cascade). `WeekCanvas` therefore draws the whole week with `android.graphics.Canvas`
  into an `ImageView` at the widget's real pixel size (`AppWidgetManager` options: min width/max height in portrait, max
  width/min height in landscape; recomputed in `onAppWidgetOptionsChanged`, on every update and every data change). The
  geometry is in dp and scaled by the density, so the picture is sharp at any size. **Size cap:** RemoteViews carry their
  bitmaps in a Binder transaction and the system rejects a widget update above 1.5 screens of ARGB_8888 pixels
  (`RemoteViews` "too much memory"); `WeekLayout.bitmapScale` lowers the pixels per dp, never the dp size, so the bitmap never
  exceeds one screen of pixels (the density when it fits). The refresh icon is a real `ImageView`, and the header and the seven
  day columns are transparent `View`s over the bitmap that carry the `PendingIntent`s (their paddings mirror the constants in
  `WeekCanvas`). Alternatives weighed: nested `LinearLayout`s with weighted spacers (no overlap, one view per block, hits the
  RemoteViews view-count and memory limits); a `ListView`/`RemoteViewsService` per day (a list, not a time axis); keeping the
  old compact event-list columns (what the owner rejected). Cost: text is not selectable and does not follow the system font
  scale (sizes are fixed dp); the picture is redrawn on every update (cheap, a few ms for a week).
- **Failure states.** API call fails (offline, server down, HTTP error): the last data stays, the footer says when it
  was current. HTTP 401 (session expired): the footer says "Open the app to sign in again" (tap opens the app);
  signing in there makes the next refresh work. No snapshot and no fetched data yet: "Open the app once to load your week".
- **Session lifetime is the trade-off.** The session cookie lives 90 days and is extended on every use (the server
  pushes it forward at most once per hour and re-sends the cookie); the widget stores the `Set-Cookie` of its own
  calls back into the WebView's jar, so a widget that keeps refreshing keeps the session alive. After 90 days without
  any use (app or widget), or after signing out, the widget shows the sign-in hint until the app is opened. The cookie
  is `HttpOnly; SameSite=Lax` and `Secure` only when `PUBLIC_URL` is https, so a native client over plain HTTP is not
  blocked and no server security was loosened. The WebView's cookie jar is only readable by this app.
- **Day widget** (owner, 2026-10-14: "build a day view widget as well"): `DayWidgetProvider` (default 2x3, resizable)
  draws today like the app's day view with the week renderer run for one day (`WeekCanvas.drawDay`: the date as the
  header, no weekday row, one wide column, so blocks show their time and a task list its open items; bars of multi-day
  events crossing today are clipped to it). Same data, theme, language and refresh jobs as the week widget; the whole
  widget opens `/day/<today>`, the icon refreshes. Layouts use only RemoteViews-allowed classes: a plain `View` made
  launchers show "Can't load widget" (fixed 2026-10-14); `WidgetInflateTest` inflates all three widgets like a launcher.
- **Clock widget** (owner, 2026-10-13: the clock "has a lot of potential for a widget"): a second, square widget
  (`ClockWidgetProvider`, `clock_widget_info.xml`, default 2x2, resizable) that draws today as the app's 24-hour clock
  (`ClockCanvas`, one bitmap): day ring with the elapsed part, plate and hour ticks (00/06/12/18 in the outer ring), arcs on
  lanes (`ClockLayout.arcs`, the web's `assignLanes`; lanes too far in are left out), the focus wedge (`ClockLayout.wedge`,
  the web's `focusWedge`), the hand (starting at 36 % of the plate so the middle stays free), the first all-day event above
  the middle, and under it the Approaching card's line (`ClockLayout.nowLine`: "Dentist · 40 min left", "Next: Gym in 2 h",
  same wording and German forms as the web) and the untimed task lists. The digital time is a live `TextClock` over the
  bitmap (ticked by the system every minute, no app work); the bitmap is redrawn by an inexact, non-waking 5-minute alarm
  (`ACTION_TICK`), so it moves while the phone is in use and costs nothing with the screen off, plus on every data change.
  It shares the week widget's data (`WidgetRenderer.pickData`: the newer of fetch and snapshot), theme, language and the
  30-minute WorkManager fetch (kept while either widget exists). A tap opens `/clock/<today>` (the deep-link pattern now
  accepts `clock`). Alternatives weighed: `AnalogClock` in RemoteViews (12-hour hands only, no arcs); a per-minute alarm
  for the whole picture (battery for a 0.25° step of the hand). Pictures for review without a device:
  `ClockCanvasRenderTest` draws it with Robolectric's native graphics into `android/app/build/widget-pictures/`.
- **System back** (owner bug, 2026-10-13): without a handler the Android back gesture finished the activity whatever was
  open. `MainActivity` registers an `OnBackPressedCallback` (works with predictive back, target SDK 36): when the WebView
  `canGoBack()` it calls `goBack()`, which fires `popstate`, so the overlay back-stack ("Back closes overlays") closes
  the topmost overlay, else the router returns to the previous view; with no history left, back leaves the app as
  before. `@capacitor/app` was not added: it would do the same with a JS listener, one more dependency in both bundles.
- **Reminders as notifications** (`notify/`): the plugin `Reminders` stores each pending reminder in SharedPreferences
  (`calendar_reminders`, one per id, a new one replaces it) and sets an `AlarmManager` alarm: exact while idle
  (`USE_EXACT_ALARM`, granted to calendar apps from Android 13; `SCHEDULE_EXACT_ALARM` on 12), else inexact.
  `ReminderReceiver` shows the notification (channel "Reminders", the moon icon; a tap opens the app) unless the app is
  in the foreground, where the snackbar shows the same reminder. It sets the stored alarms again after a reboot or an
  app update; a reminder whose time passed while the phone was off shows at once. The first `schedule` asks for the
  notification permission (Android 13+); declined, the reminder is stored but not shown. The text is translated by the
  web app (the app's language), the channel name by Android (the system language). Alternatives weighed:
  `@capacitor/local-notifications` (a generic plugin with more surface than one reminder needs, and its own permission
  flow); Firebase push (needs a Google project and a server sender, for a reminder the phone can compute itself).
- **Reminders, several per event (owner, 2026-10-14: "remind me 1 h 30, then 30 min, then 15 min before")**. Slice 1 of 2
  (slice 2 = Web Push, see below). Owner decisions, in order:
  - **Google is the source of truth for event reminders** (owner: "careful with events we already have in Google Calendar,
    they may already have reminders set; read them and replicate the functionality to adjust them"). An event's reminder
    list is its Google `reminders`: `useDefault: true` → the calendar's `defaultReminders` (the Google API returns them with
    every `events.list` and on the calendar list entry), else its `overrides`. Only `popup` reminders are shown and edited;
    `email` ones are kept untouched on every write. Google allows at most 5 per event and 5 defaults per calendar, so the
    editors stop at 5. Changing a calendar's default changes every event that uses it, past and future, without touching
    an event (that is how Google stores it; no per-event rewrite).
  - **Editing**: the event dialog gets a "Reminders" row (`event-reminders`): "Calendar default (30 min, 10 min)" or the
    event's own list as chips (`event-reminder` with `data-minutes`, remove `event-reminder-remove`), "Add reminder"
    (`event-reminder-add`, a picker with 5 / 10 / 15 / 30 min, 1 h, 1 h 30, 2 h, 1 day and a custom minutes field), "Use
    calendar default" (`event-reminders-default`) and "No reminders" (empty own list). Saved through the existing
    create/update path as `reminders: { useDefault, minutes[] }` → Google `reminders` (overrides `method: popup`, email
    overrides preserved). A new event starts on "Calendar default".
  - **Settings → Reminders, its own sub-page** (owner: "this should become its own sub-menu"; row `settings-reminders` opens
    `/settings/reminders`, `reminders-settings`): one section per own, writable, visible calendar
    (`reminders-calendar` with `data-calendar-id`) with its Google default list, editable like the event's list (written
    through `calendarList.patch` `defaultReminders`, popup only, email kept); read-only calendars show their default without
    editing. Then a section "Task lists" (below).
  - **Task lists** are Google events in the person's tasks calendar too, so a list's own reminders live in its Google event
    the same way (row `tasklist-reminders` in the task list dialog, same editor). Whether this app reminds about task lists
    at all is a switch on the Reminders page (`reminders-tasklists`, the existing person pref `notify.tasklists`, **default
    off** now, owner). The tasks calendar's default list is edited like any calendar on the same page.
  - **Delivery: this app rings itself** (owner: yes, even though the Google Calendar app may ring too; the person can mute
    that app). Every reminder lead L of an upcoming timed event (and, with the switch on, timed task list) produces one
    reminder at start − L: in the open app the existing snackbar (`transition-warning`, "Dentist starts in 30 min", once
    per event and lead, auto-hides at the start), in the Android app also a notification through the `Reminders` plugin
    (one id per event, date and lead: `reminder:<id>@<date>T<time>-<L>`; at most 24 scheduled ahead, nearest first;
    ids no longer wanted are cancelled, and on app start every stored `reminder:*` and old `transition:*` id not in the
    current plan is cancelled, which needs a new plugin method `list()`). `prefs.notify.events` / `.tasklists` keep
    choosing what reaches the lock screen.
  - **Replaces the single transition warning time** (`transitionWarningMinutes`, the Settings row
    `settings-transition-warning`): removed; the in-app warnings follow the reminder lists. A calendar without a default
    and an event without its own list get no reminder (as in Google). Why: two separate "minutes before" settings would
    contradict each other; Google's lists already say what the person wants.
  - **Slice 2, Web Push** (owner: "additionally Web Push"; plan pushed by the app, owner's choice): the server gets VAPID
    keys and stores push subscriptions per person and device; on every sync the app sends the next 7 days of reminders
    (`PUT /api/reminders/plan`, `{ at, title, body, key }[]`, replacing the device's previous plan) and the server sends each
    push at its time (one timer loop like `BackupService`, catch-up of missed ones up to 10 min late, never twice per key).
    The service worker shows them (`push` handler, needs `injectManifest` instead of `generateSW`). Caveat (owner accepted):
    an event changed only in Google gets its push updated at the next sync of one of the person's apps. The Android app
    keeps its own native notifications and does not subscribe to push (no doubles on the same phone).
    **Opt-in per browser** (assumption 2026-10-14, logged: a push subscription needs the browser's permission prompt,
    which needs a tap): the Reminders page gets a row "Reminders in this browser while the app is closed"
    (`reminders-push`, a switch, off by default, hidden in the Android app and where `PushManager` is missing). On:
    permission prompt → `pushManager.subscribe` with the server's public key (`GET /api/push/key`) →
    `POST /api/push/subscriptions`; off: unsubscribe → `DELETE /api/push/subscriptions` (by endpoint). Denied
    permission leaves it off with a hint (`reminders-push-denied`). Subscriptions live in the person's data dir
    (`push.json`, endpoint + keys + plan); a 404/410 from the push service removes that subscription. The plan is sent
    only while subscribed; the key is `reminder:<itemId>@<date>T<start>-<lead>` as in the native plan. Push payload:
    `{ title, body, key }`, shown with `tag: key` (a re-send replaces, never doubles). VAPID keys are generated on first
    start into `DATA_DIR/vapid.json` (no env setup) unless `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set; sender
    library `web-push`. In e2e the push service is replaced by a recorder (`E2E` mode: pushes go to
    `GET /api/__test/pushes` instead of the network). The plan request is `{ endpoint, plan: [...] }` (the endpoint names
    the browser; unknown → 404 → the app subscribes again). Bedtime and morning overview are not pushed in this slice.
- **Notifications** (owner, 2026-10-14: "implement notifications for all the things that need them, not only
  bedtime"; ADHD-RESEARCH R29/R32/R33: few, chosen ones, no badges). Settings → Notifications (`settings-notify-*`, stored
  per person as `prefs.notify`) chooses which reminders reach the lock screen: the bedtime reminder, warnings before
  timed events, warnings before task lists with a time (at each reminder lead, see "Reminders, several per event"), and
  an optional **morning overview** at a chosen time ("Your day" · "3 appointments · 2 lists · first: Dentist 10:00",
  `morningOverview`; today's when its time is ahead, else tomorrow's, which is then prefetched). In-app snackbars are
  unchanged. Delivery: the Android app's `Reminders` plugin now; in a browser nothing is delivered while the app is
  closed until HTTPS allows Web Push (Declarative Web Push on iOS, see docs/IOS-OPTIONS.md). Deliberately not notified:
  overdue or carried-over lists, streaks, the plant (guilt and badge anxiety, ADHD-RESEARCH 1.21).
- **Transition warnings as notifications** (2026-10-14, ADHD-RESEARCH R33; superseded by the reminder lists, see "Reminders,
  several per event": the plan is `reminderPlan.ts`, ids `reminder:<itemId>@<date>T<start>-<lead>`, at most 24, the next 8
  days as far as loaded): `transitionWarning.ts` also schedules the next reminders with `Reminders.schedule({ id, at,
  title: "Dentist starts in 30 min", body: start })`; timed task lists too when chosen (not carried-over ones), cancels ids
  that left that list (moved, deleted, setting off) and re-sends only changes, and on start cancels every stored
  `reminder:*` / `transition:*` id not in the plan (`Reminders.list()`). While the app is hidden nothing is re-sent, so the
  schedule stays as it was left; the native side skips them while the app is in front (the snackbar shows them).
  Events added elsewhere while the app stays closed are not scheduled until it is opened again (the widget's background
  fetch does not schedule; a later step if needed). Same channel "Reminders" as the bedtime reminder.
- **Distribution: a download link.** `scripts/android-build.sh` builds a release-signed APK (key generated locally in
  `~/.config/calendar-android/`, never in git; the build falls back to the debug key without it) and copies it to
  `/home/sauron/projects/calendar/deploy/data/downloads/app.apk` on sauron (the container's `DATA_DIR/downloads/`). The
  server serves it at `GET /app.apk` (API.md); the service worker's navigation fallback excludes `/app.apk`. The APK is
  not part of the Docker image and is not rebuilt by a deploy.
- **Distribution: a download link, on both servers.** `scripts/android-build.sh` builds a release-signed APK (key generated
  locally, never in git; the build falls back to the debug key without it) and copies it to
  `/home/sauron/projects/calendar/deploy/data/downloads/app.apk` on sauron (the container's `DATA_DIR/downloads/`; from
  another machine the script copies it over scp/ssh). The LAN server serves it at `GET /app.apk` (API.md); the service
  worker's navigation fallback excludes `/app.apk`. The public server's `/data` is a named Docker volume on the VPS, so
  `scripts/vps.sh deploy` also takes sauron's `deploy/data/downloads/app.apk` and puts it into the running app container
  (`docker compose cp` to `/data/downloads/app.apk`, written as `.part` and renamed). The APK is not part of the Docker
  image and is not rebuilt by a deploy; a deploy without an APK on sauron leaves the VPS's file as it is.
- **Build constraints.** minSdk 26 (Android 8, `java.time`), compile/target SDK 36. Capacitor's modules ask for Java 21;
  `android/build.gradle` pins every module to Java 17 so JDK 17 builds them.
- **The app's own download button.** Inside the Capacitor app the Settings row is called "Update the app" (otherwise
  "Android app"; hidden on iOS) and loads `/app.apk`. The WebView has no download handler, so `MainActivity` sets a
  `DownloadListener` that hands URLs of the calendar's own host to the system (`ACTION_VIEW`: the browser downloads the file and
  shows its notification); other hosts are ignored.
- **Tests.** No e2e scenarios: Playwright cannot drive a native widget. The snapshot builder has unit tests
  (`web/test/widget-snapshot.test.ts`), the native splitting into days and bars that mirrors the web has JUnit tests
  (`WeekDataTest`), the pure layout maths (column packing, hour range, bitmap scale, text colour) too (`WeekLayoutTest`,
  `android/app/src/test`, `./gradlew testDebugUnitTest`), the download route a server test. The drawing itself is checked by eye on a device.
### Shared lists (owner, 2026-10-14)

A person can share a task list, or a whole category, with another person who has their own Google login. The owner
decided every point below.

- **Storage: the server, not Google.** A shared list is one JSON document `DATA_DIR/shared/lists/<id>.json`
  (`version`, `id`, `rev`, `owner` = Google `sub`, `members` = subs, `updated`, and the list: title, items, date/time or
  undated, tags, estimate, `completedOn`, canvas place, the owner's `categoryId` and a `category` snapshot name/colour/icon).
  One file per list: atomic writes (temp file + rename, as every store), no contention between lists, and a later
  Google Drive backup of the server data takes the files as they are. The category rules (who a category is shared
  with) are one document `DATA_DIR/shared/category-shares.json` (`owner sub -> { categoryId -> member sub }`). Known
  people (`sub -> email, name`, written at every sign-in) are `DATA_DIR/people.json`.
- **Why not a shared Google calendar** (alternative weighed): a calendar shared in Google would need the partner to
  accept an invitation, would expose the owner's whole tasks calendar or need a second one per person, and gives no
  per-list ownership, "leave" or per-category rule. The owner chose server storage. The price: a shared list is not
  visible in Google Calendar and is not covered by Google's own backup until the Drive backup slice.
- **Two ways to share, one store.** Per list (the task list dialog: "Share with ...", "Stop sharing") and per
  category (Settings, Categories: "Share with ..."). The per-list way is the building block: *sharing MOVES* the list
  from the owner's tasks calendar into the shared store (the Google event is created in the other direction by
  "Stop sharing", with a new id). The per-category way is a rule on top: toggling it moves every list of the category,
  and a list created in the category is created shared. Both are wanted because a single list is the everyday case
  ("the groceries"), while a category ("Shopping", "Home") is how a couple thinks about what they run together.
- **One API surface.** Shared lists are served by the existing task list endpoints under ids `shared:<id>`
  (A-162): the `CalendarService` of every person merges the lists they own or are a member of into its range reads,
  Tasks view reads and item ops. The web treats shared and own lists alike; only the badge, the share controls and
  "Leave" are new. `SharedListService` owns the store, membership checks and the rules; the owner's `CalendarService`
  does the Google side of moving in and out.
- **Both people edit everywhere** (calendar views on the list's date, tray, Tasks view with Open/Canvas/Archive and
  the filter): ticking, adding, editing, deleting items, renaming, re-dating. A small badge (`tasklist-shared-badge`)
  shows the other person's initial. The canvas place is one place for both (the list's, not per person).
- **Category of a shared list** (owner: the partner's categories differ). The list carries the owner's category
  (`categoryId` plus a snapshot of name, colour and icon). Everyone sees that name, colour and icon, whatever their own
  categories are. A member cannot change the category; the owner's rename, recolour or deletion of the category
  refreshes (or clears) the snapshot.
- **Deleting.** Only the owner deletes a shared list for everyone (`DELETE`, undo as usual). A member sees "Leave"
  (`tasklist-leave`) instead of "Delete": it removes the list for them only (A-165).
- **Concurrency** (owner: the same optimistic approach as Google events). Every list has a version counter `rev`; its
  etag is the counter. A list write with a stale `If-Match` is refused with `412` and the existing conflict UI
  ("This task list was changed elsewhere ..."). Item ops read-modify-write the latest version, so two people ticking
  different items never conflict. The server writes synchronously (one process), which makes each write atomic.
  Polling is unchanged: the partner's changes appear on the next sync. No websockets.
- **Security.** Every shared-list route checks `owner === caller || members.includes(caller)`; anyone else gets `404`.
  Members must be on the allow-list and known (signed in once). Sub values are validated before they reach a path.
- **People picker.** "Share with ..." lists the allowed people other than yourself (`GET /api/people`) by name, else
  email. A person who never signed in has no `sub` yet and is not offered (A-161).
- **i18n.** All new text is in `locales/<lang>/sharing.ts` (`en`, `de`, `de-x-mainfr`, `de-x-coldmirror`).
- **UI test contract.** `tasklist-shared-badge`, `tasklist-share-person`, `tasklist-share`, `tasklist-unshare`,
  `tasklist-leave`, `category-share-person`.

### Diagnostics (owner, 2026-10-14)

Why: people saw "Can't reach Google Calendar" and the server logged nothing, so the cause (deploy restart, Google 429/5xx,
VPS timeout, phone network on resume, a wrongly mapped 503) could not be proven. This is **logging only**: no behaviour,
no response and no retry changed. Lines are one JSON object each on stdout (`docker compose logs calendar`), written by
`server/src/lib/diag.ts`, which only accepts whitelisted fields.

| `event` | When | Fields besides `ts` |
|---|---|---|
| `startup` | once per boot | `version`, `provider`, `node`, `pid` |
| `google_error` | a Google API call failed (after the Google client's own retries) | `subHash`, `op` (`events.list`, `calendarList.list` ...), `status`, `reason` (Google's reason), `code` (network code such as `ETIMEDOUT`, `ECONNRESET`, `ENOTFOUND`, `TIMEOUT`; only when there was no HTTP status), `retry` (attempt the client library reached), `durationMs` |
| `api_unavailable` | the server sent an `/api` response with status >= 500 | `route` (`GET /api/items`, the route pattern), `status`, `durationMs`, `cause` (`429:rateLimitExceeded`, `503`, `ETIMEDOUT`, or the error class name) |
| `auth_flow` | a step of the app's Google sign-in (see "App sign-in hang" below) | `step` (`start`, `callback`, `fallback`, `exchange`, `exchange_failed`), `app`, `subHash` (callback only), `durationMs` (handler time; start, callback only) |
| `rate_limited` | Google's rate limit started or ended a cooldown (once per transition, §4) | `state` (`start`/`end`), `subHash`, `op`, `cooldownSec`, `step`, `retryAfter` |
| `api_unavailable` | the server sent an `/api` response with status >= 500 (except `RATE_LIMITED`, which has `rate_limited`) | `route` (`GET /api/items`, the route pattern), `status`, `durationMs`, `cause` (`429:rateLimitExceeded`, `503`, `ETIMEDOUT`, or the error class name) |
| `client_sync_error` | the web app entered the banner state (`POST /api/diag/sync-error`, API.md "Diagnostics") | `subHash`, `kind`, `status`, `task`, `online`, `resumed`, `app`, `ageSec` |

Example reading: `google_error` followed by `api_unavailable` with the same `cause` = Google; `client_sync_error` with
`kind: "network"`, `online: false` or `resumed: true` and no server line = the phone's network; an `api_unavailable`
right after a `startup` = a deploy restart.

**Never logged:** access or refresh tokens, e-mail addresses, the raw `sub` (only `subHash`, the first 8 hex characters of
`sha256("cal-diag:" + sub)`), event or task list titles, descriptions, locations, request or response bodies, Google's
error message text (only its status and `reason`), cookies, session ids. Free text is never copied: `reason`, `code`,
`task` and `cause` must match `[A-Za-z0-9_.:-]{1,64}` or are dropped.

Web: `stores/sync.ts` sends one beacon when the error state is entered from a non-error state, not while it lasts. If that
send fails on the network, the beacon is kept in memory and sent once (with `ageSec`) after the next successful sync; every
other failure of the call is ignored. The server accepts one beacon per session per minute (in memory, so a restart resets
it).

Decision: a beacon from the client instead of server-side inference, because only the phone knows whether it was offline or
just resumed. Alternative weighed: a persistent offline queue; rejected as too much machinery for a diagnostic (A-12 keeps the
app without offline writes).

## 8. Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | bind address |
| `PUBLIC_URL` | unset | external base URL, e.g. `http://cal.mordor.local`, later `https://cal.<sub>.<domain>`. Used for the OAuth redirect URI and CORS/allowed origins. Nothing in code hardcodes a host. |
| `ALLOWED_ORIGINS` | `PUBLIC_URL` | comma-separated extra origins for CORS (same-origin needs none) |
| `TZ` | `Europe/Berlin` | calendar time zone |
| `PROVIDER` | `mock` | `mock` \| `google` |
| `DATA_DIR` | `./data` | mock JSON store, `settings.json`, `google-token.json` |
| `SEED` | `true` | seed demo data into an empty mock store |
| `TEST_MODE` | `false` | enables `/api/__test/*`; never true in production |
| `POLL_INTERVAL_MS` | `30000` | web polling interval |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | – | OAuth client (PROVIDER=google) |
| `GOOGLE_REFRESH_TOKEN` | – | long-lived refresh token (or `DATA_DIR/google-token.json` from the auth flow) |
| `GOOGLE_CALENDAR_IDS` | `primary` | comma-separated calendars to show |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_URL}/api/auth/google/callback` | OAuth redirect |
| `LOG_LEVEL` | `info` | log level (`debug`/`info`/`warn`/`error`) |

Deployment: `deploy/docker-compose.yaml` in the repo (owner 2026-10-14: compose versioned with the app; `.env` and `data/` next to it, git-ignored; `~/docker-compose/calendar` symlinks to it): `build:
/home/sauron/projects/calendar`, `container_name: calendar`, `restart: unless-stopped`, Traefik labels
`Host(\`cal.mordor.local\`)` + `loadbalancer.server.port=3000`, `./data:/app/data`, `TZ=Europe/Berlin`,
`PUBLIC_URL=http://cal.mordor.local`, `PROVIDER=mock`, `TEST_MODE=false`, network `proxy-network` (external).
Multi-stage Dockerfile (`node:22-alpine`): build web + server, runtime contains only `server/dist`, `web/dist`,
production deps. Healthcheck: `wget -qO- http://localhost:3000/api/health`.

- `ALLOWED_EMAILS`: comma-separated Google addresses that may sign in (auth on with `PROVIDER=google`).

## 9. Owner actions

- **Hidden calendars and no needless redraws (owner bug 2026-10-14).** The person's hidden calendars live on the server
  (`prefs.json`), not in the WebView, and the native fetch is the widget's data. The fetch therefore sends
  `excludeHidden=1` and the server drops the hidden calendars' items (the snapshot path filters them too, and the bridge
  loads the calendar list before its first push). A widget that is redrawn without a change cross-fades in the launcher
  and looks like flashing, so nothing redraws unchanged: the bridge pushes only when the snapshot differs apart from its
  `generatedAt` stamp, the plugin skips the redraw for a stamp-only difference, and `WidgetRenderer.render` skips
  `updateAppWidget` when its content key (data, auth, size, mode, day, minute) equals the last pushed one (forced by the
  system's `onUpdate`). No timer runs faster than the web sync (30 s) and the widget's own work: the now-line moves at
  most once a minute, only when something else triggers a draw. Alternatives weighed for hidden calendars: the native side
  filtering by ids in the snapshot (stale until the app runs, wrong when the app is closed) lost against the server flag.

### 9.1 HTTPS (prerequisite for full PWA install and for real Google OAuth)

Planned (owner decision): Let's Encrypt **DNS-01** with **Cloudflare DNS** (domain at Namecheap, nameservers moved to
Cloudflare free plan), wildcard certificate `*.<subdomain>.<owner-domain>`, **LAN only** (no public A records;
Pi-hole resolves `*.<subdomain>.<owner-domain>` to `192.168.1.38`). Step-by-step guide:
`/home/sauron/docker-compose/traefik/HTTPS-GUIDE.md`. After it is done:

1. Add a Traefik router for `Host(\`cal.<subdomain>.<owner-domain>\`)` on `websecure` with `tls.certresolver=le`
   (keep `cal.mordor.local` as an HTTP alias during the switch).
2. Set `PUBLIC_URL=https://cal.<subdomain>.<owner-domain>` in the compose file and redeploy.
3. Run `E2E_BASE_URL=https://cal.<subdomain>.<owner-domain> npx bddgen && npx playwright test --grep @smoke`.

Alternatives considered: a local CA (mkcert / step-ca) whose root certificate must be installed on every phone
(fiddly on iOS); a Tailscale/Cloudflare tunnel (rejected by the owner: no VPN/tunnel tools).

### 9.2 Installing on phones

Requires 9.1 for the full experience; on plain HTTP the result is only a shortcut without offline support.

- **Android (Chrome)**: phone on home Wi-Fi with Pi-hole DNS → open `https://cal.<subdomain>.<owner-domain>` →
  tap the in-app **Install app** button (or Chrome ⋮ menu → **Install app**) → confirm. The app appears in the app
  drawer and opens standalone. Updates install automatically on next launch.
- **iOS (Safari only)**: open the URL in Safari → **Share** → **Add to Home Screen** → Add. (The app shows a hint with
  these steps.) Opens standalone. To update: close and reopen the app.
- Away from home the names do not resolve (by design: LAN only); the installed app opens its cached shell and shows the
  sync error banner.
- **Android app with widget (no PWA install needed)**: see "Android app and widget"; install from
  `https://cal.example.org/app.apk` or `http://cal.mordor.lan/app.apk` (README "Android app"); the app asks which one to use.

### 9.3 Enabling real Google Calendar

1. Finish 9.1 (Google requires an HTTPS redirect URI on a real domain; `.local` is not allowed).
2. Google Cloud Console → create project "home-calendar".
3. APIs & Services → Library → enable **Google Calendar API** (optional: Google Tasks API).
4. OAuth consent screen: type **External**, app name, support email; scope
   `https://www.googleapis.com/auth/calendar` (or `calendar.events` + `calendar.readonly`); add the owner's Google
   account as **test user**. Then **Publish app** to "In production" (unverified is fine for personal use) — in
   "Testing" status refresh tokens expire after 7 days.
5. Credentials → Create OAuth client ID → **Web application**; authorised redirect URI
   `https://cal.<subdomain>.<owner-domain>/api/auth/google/callback`; note client ID and secret.
6. Set env `PROVIDER=google`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_URL`; redeploy.
7. Obtain the refresh token: open `https://cal.<subdomain>.<owner-domain>/api/auth/google/start` (available only when
   `PROVIDER=google` and no token is stored), sign in, consent. The callback stores the token in
   `DATA_DIR/google-token.json` (mode 600). Alternatively put it in `GOOGLE_REFRESH_TOKEN`.
8. Optional: `GOOGLE_CALENDAR_IDS` (find ids in Google Calendar → Settings → calendar → "Integrate calendar").
9. Verify: `GET /api/health` shows `provider: "google"`, `providerStatus: "ok"`; create an event in the app and see it
   in the Google Calendar app.

The `/api/auth/google/*` routes are the only additions for real Google; they are disabled with `PROVIDER=mock`.
Mock data is not migrated to Google.

## 10. Developer tooling

Terse output on purpose (one line on success, only failures otherwise); every command finishes in about a minute.

- `pnpm verify`: the gate before any merge or deploy; runs web/server/e2e tsc, server and web unit tests, `i18n:check` and `spec/scripts/check-steps.py` in parallel (`scripts/verify.mjs`).
- `pnpm i18n:scan [path...] [--json]`: hard-coded UI strings left in `web/src` (template text, label/aria-label/title/placeholder/alt, `notify(` and `new Error(` literals); the template detector is `web/src/i18n/raw-text.ts`, shared with `test/i18n-raw-text.test.ts`. The dev-only `MotionLab.vue` is skipped (`IGNORED`) and three developer-error strings are allow-listed with a reason (`ALLOWED`), both at the top of `web/scripts/i18n-scan.ts`.
- `pnpm e2e:affected [base]`: the Playwright `--grep` for features touched since `base` (default `origin/master`), mapped via feature tags/titles, step definitions and `data-testid` literals (`scripts/e2e-affected.mjs`); `none` if nothing is affected.
- `scripts/deploy-status.sh`: last auto-deploy result and the `calendar` container's age, read from sauron over ssh (`DEPLOY_HOST=user@host` overrides the host).
