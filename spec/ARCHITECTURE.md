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
| `GoogleProvider` | Google Calendar API v3 over HTTPS (official client library or plain `fetch`, per RESEARCH.md) with OAuth2 refresh-token auth. Unit-tested with mocked HTTP (injected `fetch` or an HTTP interceptor). Maps Google HTTP errors: 401/403 auth → `ProviderUnavailableError`, 404/410 → `NotFoundError`, 412 → `PreconditionFailedError`, 5xx/network → `ProviderUnavailableError`, other → `ProviderError`. |

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

Server: stateless pass-through to the provider for every request (no cache, so remote changes are visible
immediately). `GoogleProvider` may later use `syncToken` per calendar internally; the REST contract does not change.

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
6. Errors: any failed fetch/mutation with network error, 502 or 503 sets `sync.error` → `sync-error-banner`
   ("Can't reach Google Calendar. Showing the last known data." + "Retry"). The banner is a non-modal strip below
   the top bar; everything stays interactive. The next successful fetch clears it.
   `sync-status` exposes `data-state="idle|syncing|error"` and `data-last-sync="<ISO>"` (time of last successful sync).
7. No offline write queue (assumption A-12).

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
- **i18n**: English, 24 h, `en-GB` formats, week starts Monday everywhere. German comes later (owner, 2026-10-13), so
  every user-visible string (labels, buttons, placeholders such as "List", validation messages, snackbars) lives in one
  message catalogue (`web/src/i18n/en.ts`, keyed, read via `t('key')`); server validation messages are returned as
  keys plus the English text. New and touched code uses the catalogue; no new hard-coded UI strings. Dates and times
  are formatted with `Intl` from one locale setting. Moving the remaining existing strings is its own slice.

### Mobile-first UX (primary target 375–430 px portrait)

Breakpoint: `< 768px` = phone layout; ≥ 768px = desktop layout. Design and implement phone first.

- **Top app bar** (compact): period title, Today button, prev/next buttons (secondary to swiping), sync status, install
  button when available.
- **Bottom bar** (`bottom-bar`, fixed, thumb zone): view switcher Year | Month | Week | Day as tabs. On desktop the switcher
  moves into the top bar (same testids).
- **FAB** `create-button`: floating "+" bottom-right, above the bottom bar, opens a small menu (Event / Task list).
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
  1. *Appearance*: one row "Theme" showing the chosen theme (for Automatic "Automatic · <the seasonal theme in use>", e.g.
     "Automatic · Halloween" in October; owner 2026-10-13), opening the theme menu (`settings-theme`). Theme mode
     (System / Light / Dark, `settings-theme-mode`), seed colour (`settings-seed-preset`, `settings-seed-custom`) and
     the Scene choice live only in the theme menu, no longer on the settings page.
  2. *Calendar*: default view, default event colour, Approaching card + track + window, show tasks calendar in Google.
  3. *Task lists*: categories (list, add, sort; tap opens the category dialog).
  4. *Focus & motivation*: transition warning, calm mode, streak flame, plant, sunflowers, best streak, support cat.
  5. *Motion & sound*: animations, ignore the device setting, sounds.
  6. *Labs*: experimental views.
  7. *Account & data*: sign out, demo data.
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
    `"Next: <title> in <d>"`, else `"Nothing else today"`. No next-task line (owner, 2026-10-13: the card shows only time things; each list's own "Next task"
    stays in its expanded view).
  - Duration format: `< 60 min` → `35 min`; whole hours → `2 h`; otherwise `1 h 20 min`. Values round down to whole
    minutes.
  - The current event is the one with start ≤ now < end; with several, the one ending first.
- **Transition warning** (`transition-warning`): a non-modal M3 snackbar `"<title> starts in <N> min"` shown once per
  event when now reaches start − N (N from settings, default 10), dismissible, auto-hides at event start. System
  notifications are a later option (they need HTTPS, permission and, on iOS, an installed PWA; not in scope).
- **Task list view** (`features/tasklists/TaskListView.vue`, root `tasklist-view` with `data-tasklist-id`,
  `data-title`): the one component that shows a task list with everything that can be done to it. Head (progress ring,
  title that renames on tap, done count `x/y` that bumps on change, "From <day>"), tags, "All done! 🎉" or "Next task",
  item rows (reward checkbox, title that edits on tap with the animated strike-through, up/down/delete), add field,
  footer (Move to today, Edit, Delete with confirmation). It owns the tick logic once for every host: optimistic
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
  show it as a `↶` badge with `aria-label`/`title` "From Sat 10 Oct". Their expanded
  view offers `tasklist-move-today` ("Move to today"), which PATCHes the date. Completed lists stay on their own date.
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
| Initial JS (compressed, first load, all scripts) | ≤ 150 kB |
| Initial CSS (compressed) | ≤ 30 kB |
| Lighthouse mobile performance on localhost (production build) | ≥ 90 |
| Month view with data rendered after navigation start (LAN / localhost) | ≤ 2000 ms |
| Frontend heap growth after 50× view cycles + 50× dialog open/close + 50× task list expand/collapse (after GC) | < 10 % |
| DOM nodes and JS event listeners growth, same workload | < 10 % |
| Detached DOM from closed dialogs/sheets | none retained |
| Server RSS idle (after start + GC) | ≤ 80 MB |
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
| `tasklist-card-overdue`, `tasklist-move-today`, `tasklist-card-estimate`, `tasklist-progress-ring`, `tasklist-complete-message` | task list additions |
| `tasklist-estimate`, `tasklist-repeat` | task list dialog fields |
| `reward-effect` (`data-kind`) | effect overlay elements |
| `streak-flame`, `streak-message`, `plant-button`, `plant-card`, `plant-card-stage`, `plant-card-line`, `settings-best-streak` | motivation |
| `settings-animation-level` (options Full/Reduced/Off), `settings-sounds`, `settings-calm-mode`, `settings-transition-warning` (Off/5 min/10 min/15 min), `settings-streak-flame` (switch), `settings-plant` (switch, default on), `settings-sunflowers` (Grow with points/Full field) | settings additions |
| `filter-bar` | `filter-chip-category` (`data-name`, `data-category-id`, `aria-pressed`), `filter-chip-tag` (`data-name`, `aria-pressed`), `filter-clear` |
| `period-title` | text per §5 |
| `nav-prev`, `nav-next`, `nav-today` | buttons |
| `view-switch-month`, `view-switch-week`, `view-switch-day` | tabs (`aria-selected`) |
| `view-switcher` | container of the three tabs |
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
| `tasklist-expanded` | `data-tasklist-id`, `data-title`, `data-presentation="sheet\|popover"`; contains a `tasklist-view` (also used in the tray) with children `tasklist-expanded-title` (click → `tasklist-expanded-title-input`), `tasklist-expanded-count`, `tasklist-item` (`data-item-id`, `data-title`, `data-done`), `tasklist-item-checkbox`, `tasklist-item-title` (click → `tasklist-item-title-input`, Enter commits, Escape cancels), `tasklist-item-delete`, `tasklist-item-up`, `tasklist-item-down`, `tasklist-add` ("+ Add item" button, click → `tasklist-new-item`, Enter adds, stays open for the next item, closes when left empty), `tasklist-edit`, `tasklist-delete`, `tasklist-close`, `tasklist-expanded-tag` (one per tag, `data-name`) |
| `event-dialog` | `data-presentation="sheet\|modal"`; `event-title`, `event-all-day` (checkbox), `event-start-date`, `event-start-time`, `event-end-date`, `event-end-time`, `event-description`, `event-location`, `event-calendar` (select, option labels = calendar names), `event-color` (radio group/select, option labels `Calendar color` + Google color names, order: Calendar color, Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite), `event-error`, `event-save`, `event-cancel`, `event-delete` |
| `tasklist-dialog` | `data-presentation`; `tasklist-title`, `tasklist-date`, `tasklist-time`, `tasklist-category` (select: category names + `No category`), `tasklist-tags` (comma-separated text), `tasklist-items` (textarea, create only), `tasklist-error`, `tasklist-save`, `tasklist-cancel` |
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
- **One OAuth round trip** signs in and connects the calendar: scopes `openid email` + calendar. The callback reads the
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
  `settings-approach-bar`.
- Routes always exist: `/clock/:date`, `/timeline`, `/strip/:date`. With `labs` on, the view switcher adds them with a
  flask mark (`view-switch-clock|timeline|strip`, `data-experimental="true"`); off, they are not offered.
- Each experiment is its own component folder under `web/src/features/labs/<name>/` and reads the existing items
  store (no new server API). Tracer bullets: correct placement and navigation first, polish later.
- Clock: SVG 24-hour circle as large as the view allows (owner, 2026-10-13), events as arcs labelled with their
  titles, timed task lists as arcs too (estimate, else 30 min; thinner or dashed, labelled "title done/total"),
  untimed task lists listed under the time in the middle (tap opens them), hand at the app clock
  (`clock` store), progress ring.
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
- Timeline (owner: vertical everywhere, a horizontal axis cannot show titles at scale): time runs down through all
  days with a date divider and an all-day band per day that takes its own room, items as long as they last with
  horizontal readable titles, overlaps side by side (wider on desktop), `timeline-now` as a line, zoom on desktop.
- Strip: CSS scroll-snap columns, one per day, sharing ONE time scale (owner: aligned, like the week view): one hour
  gutter, one vertical scroll for all columns, all-day bands equally tall across columns; heights proportional to
  duration; extended in both directions as the user scrolls (virtualised).

### New version notice (owner, 2026-10-12)

The server reports its build version (`APP_VERSION`, else the git sha at build time) in `GET /api/config` as
`version`; the web app knows its own at build time (`<html data-app-version>`). On every sync and when the app comes
back to the foreground it compares them; when they differ it shows a persistent snackbar "New version available" with
"Reload" (`update-available`, `update-reload`). Reload also activates a waiting service worker so the new assets load.
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
  `app-version` ("0.4.2") in the bottom-left corner of the main UI (above the safe area, below dialogs, never covering
  the bottom bar or the FAB).

### Themes

- **Terms** (owner 2026-10-13). **Scene** = the top app bar background (Season, Sunflower field, Mordor or None),
  chosen in the theme menu. **Plant** = the motivation widget in the top bar (the small growing plant); it is
  independent of the scene and is switched in Settings → Motivation. "Garden style" is no longer a term: it is
  removed from the spec, the UI, the code and the API. If more plant kinds come later they would be a "plant style";
  nothing is built for that now.
- A theme is a preset of: seed colour (existing scheme generation), mode (only Neon and Mordor force dark; the season
  presets and Default leave the person's System/Light/Dark setting alone, owner 2026-10-13), `glow` (off|soft|neon),
  `entries` (solid|tinted|outline), `corners` (square|round|pill) and `scene` (none|sunflowers|mordor|spring|summer|fall|winter;
  Halloween comes with its own slice). Presets live in `web/src/theme/presets.ts`: Default, Neon, Spring, Summer, Fall,
  Winter, Mordor and Automatic (resolves to the season by date: spring from 1 March, summer from 1 June, fall from
  1 September, winter from 1 December).
- **One scene choice** (owner 2026-10-13): the top bar background is the theme's `scene` attribute and nothing else.
  The theme menu offers one "Scene" selector: Season, Sunflower field (`sunflowers`), Mordor, None. "Season" stores
  the season's scene for today (spring..winter), so it is not a separate stored value. Default and Neon start with
  `none`; every scene, the Sunflower field included, shows whenever it is chosen (API.md "Scenes"). Alternatives
  weighed: keeping the old `Settings.scene` and hiding the theme one (rejected: two stored values and a precedence
  rule nobody could see) and moving everything into settings (rejected: presets need to carry a scene).
  Migration (once per person, when the server first serves the theme after the change, marker `sceneUnified` in the
  stored theme): the scene that was visible wins. If the preset or override scene was not `none`, it already is the
  value and stays; if it was `none`, the old top bar setting (`sunflowers`, `mordor` or `none`) becomes the override.
  The old `scene` key stays in `settings.json` (read-only, unused) so other people can still migrate.
- The settings page's Theme row shows the preset name; for Automatic it shows "Automatic · <resolved preset>", e.g.
  "Automatic · Fall" (and "Automatic · Halloween" once that theme exists).
- Applied as attributes on `<html>`: `data-theme-name` (the resolved preset, e.g. "Fall" for Automatic in October),
  `entries` (solid|tinted|outline), `corners` (square|round|pill) and `scene` (none|mordor|spring|summer|fall|winter;
  halloween). Presets live in `web/src/theme/presets.ts`: Default, Neon, Spring, Summer, Fall, Halloween,
  Winter, Mordor and Automatic (resolves to the season by date; Halloween for all of October, owner 2026-10-13: spring from 1 March, summer from 1 June, fall from
  1 September, winter from 1 December).
- Applied as attributes on `<html>`: `data-theme-name` (the resolved preset, e.g. "Halloween" for Automatic in October),
  `data-glow`, `data-entries`, `data-corners`, `data-scene`, plus CSS custom properties (`--glow-*`, `--radius-*`).
  Components style from these only (no per-component theme logic). Reduced/Off animation levels keep static glows
  but stop animated ones.
- Stored per person in `DATA_DIR/users/<sub>/prefs.json` (`theme: { preset, overrides }`, same store as hidden
  calendars); `GET/PATCH /api/prefs/theme`. Cached in `localStorage` and applied before mount to avoid a flash.
- Theme menu (`/settings/theme`, entry `settings-theme`): below the live preview, three sections in this order
  (`theme-section`, `data-section`): **Presets** (`presets`, the gallery), **Scene** (`scene`, its own card with the
  scene choices) and **Fine-tuning** (`fine-tuning`: theme mode, seed colour, glow, entries, corners). There is no
  separate Mordor row or button (`settings-theme-mordor` is removed): the Mordor preset (seed #c43e00, dark mode,
  Mordor scene) does the same, and Mordor stays a scene choice. Gallery `theme-card` (`data-name`, `aria-pressed`), each
  card renders a real mini week (event chip + task list card) under that preset's attributes in a scoped container;
  fine-tuning `theme-option` (`data-setting`, `data-value`, `aria-pressed`), each option renders a sample event chip
  in that style; live preview `theme-preview` with a real event chip (`theme-preview-event`), task list card and
  checkbox. Picking applies at once and saves in the background.

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
  when the pointer rests > 0.5 s it sits beside the card with a paw on it and looks at the person questioningly; on
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

### Untitled task lists (owner, 2026-10-12)

A task list may have an empty title when it has at least one item (else "Add a title or an item"). The app shows
such a list as "List" everywhere (card, tray, expanded list): `displayTitle(list)` in one place, the stored title stays
empty. In Google the event summary is the items joined with ", " (so Google's own apps show something useful) and
`extendedProperties.private.untitled = "1"` keeps the app title empty.

### One "new" dialog (owner, 2026-10-12)

The FAB and a tap on an empty time slot (or all-day cell) open the same dialog with a segmented switch "Event | Task
list" at the top (last choice remembered per device); the event form and the task list form are the existing dialog
bodies, sharing the prefilled date/time so switching keeps them. No create menu.

### Rounded fields and shapes (owner, 2026-10-12)

Text fields, selects and text areas are fully rounded (radius follows the theme's corner setting, ~12 px by default),
softly filled, with no bottom indicator line; focus shows a 2 px primary outline. Buttons, chips, cards and dialogs use
the same corner scale so shapes look consistent.

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

Deployment: `/home/sauron/docker-compose/calendar/docker-compose.yaml` (style of `filebrowser`): `build:
/home/sauron/projects/calendar`, `container_name: calendar`, `restart: unless-stopped`, Traefik labels
`Host(\`cal.mordor.local\`)` + `loadbalancer.server.port=3000`, `./data:/app/data`, `TZ=Europe/Berlin`,
`PUBLIC_URL=http://cal.mordor.local`, `PROVIDER=mock`, `TEST_MODE=false`, network `proxy-network` (external).
Multi-stage Dockerfile (`node:22-alpine`): build web + server, runtime contains only `server/dist`, `web/dist`,
production deps. Healthcheck: `wget -qO- http://localhost:3000/api/health`.

- `ALLOWED_EMAILS`: comma-separated Google addresses that may sign in (auth on with `PROVIDER=google`).

## 9. Owner actions

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
