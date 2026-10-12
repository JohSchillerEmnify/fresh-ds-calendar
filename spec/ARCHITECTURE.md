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

One task list = one Google event in `TASKLIST_CALENDAR_ID` (default primary):

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
- **Time grid** (week/day): 24 rows, `--hour-height` 48 px (desktop) / 44 px (phone), initial scroll to 07:00
  (or one hour before the current time if today is visible and later than 08:00). Overlap layout: Google-like column
  packing — events in a connected overlap cluster are split into equal columns; touching (end == start) is not overlap.
  Timed task lists are 30 min blocks in the grid.
- **Month overflow**: desktop shows max 3 entries per cell then `+N more`; phone shows max 2 compact chips then `+N`.
- **Defaults for new event**: date = focus date; if that is today, the next full hour after now (capped at 23:00),
  else 09:00; duration 1 h; calendar primary. Changing the start keeps the duration.
- **Clock**: `useClock()` (see API.md `/api/config`).
- **i18n**: English, 24 h, `en-GB` formats, week starts Monday everywhere.

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
- **Month view on phone**: cells show the day number and up to 2 compact chips (colored, title only, truncated) then
  `+N`. Tapping anywhere in a cell opens `/day/<date>` (the day agenda). Desktop: day number → day view, chip → opens
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
- **Item colors**: event/category colors are shown as given (the user picked them), with an on-color chosen for
  contrast ≥ 4.5:1; in dark theme chips use a tone-adjusted container of the same hue.
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
  1. *Appearance*: theme mode as a segmented button (System / Light / Dark); seed color as 8 preset swatches (Blue,
     Purple, Teal, Green, Orange, Red, Pink, Slate; shown as round color buttons with check mark) plus "Custom" with a hex
     text field (and native color input). Changes apply immediately (preview = the real UI) and are saved at once.
  2. *Calendar*: default view (Month/Week/Day), default event color (Calendar color + 11 Google colors).
  3. *Task list categories*: list with color dot, icon and name; tap opens the category dialog (name, color presets
     from the Google palette + custom hex, emoji icon field, delete); "Add category" button.
  Settings are loaded at startup together with `/api/config`, re-fetched on focus, and saved with `PATCH` (optimistic,
  rolled back with the error banner on failure).
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
- **Now card** (`now-card`): above the time grid in the day view (today) and the week view (current week).
  - Up to three lines (`now-card-line`): current event `"<title> · <d> left"` with a shrinking linear progress bar
    (`now-progress`, M3 linear progress, `aria-valuenow` = elapsed %); next timed event today
    `"Next: <title> in <d>"`, else `"Nothing else today"`; next task `"Next task: <item> (<list>)"`. The next task is
    the first unticked item of the oldest open list in the tray order.
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
  "All done! 🎉" visible), then moves to the finished rows with a move animation (the store moves it from open to
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
  - Pick-up: touch → long press 450 ms with < 8 px movement, then `navigator.vibrate(10)` if available (Android).
    iOS Safari has no Vibration API, so iOS gets only the visual lift. Mouse → press and move > 4 px.
  - While dragging: `data-dragging="true"`, the card lifts (scale 1.05, elevation shadow) and wiggles briefly. A ghost
    follows the pointer with spring lag; tilt is proportional to horizontal velocity (max 6°). A drop indicator snaps
    to 15-minute slots (time grid) or days (month and all-day). Page swipe and scroll are suppressed during a drag;
    auto-scroll near the edges.
  - Drop: optimistic move, settle spring + `drop` effect, then `PATCH` (with `If-Match`). On failure the card springs
    back to its origin and the sync error banner shows. Escape cancels a drag (desktop).
  - Duration is preserved. Timed items stay timed and all-day items stay all-day (no conversion by drag; assumption
    A-55). Multi-day events move by their first day.
  - Accessible alternative: the edit dialogs. Chips keep `role="button"`, and keyboard users use the dialog.
- **Streak flame** (`streak-flame`, text = current count) and **plant** (`plant-button`, `data-stage`, `data-mood`) in
  the top app bar, shown per the settings `streakFlame` and `garden`. `streak-message` is a small toast ("Checked in, day 4" /
  "Welcome back!") that auto-hides after 4 s and never blocks input. The plant card (`plant-card`, `plant-card-stage`,
  `plant-card-line`) is a small popover or sheet with the larger SVG plant.
  - Plant art: 5 stage SVGs (≤ 3 kB each, inline, M3 tones of the seed colour). Wilting is drawn as a droop transform
    plus reduced saturation by mood. It is never brown or dead.
  - Best streak shows in Settings (`settings-best-streak`).
- **Sunflower field** (`sunflower-field`, `aria-label` "Sunflower field: N flowers", `data-mood`; children `sunflower`):
  - Drawn in the background layer of the top app bar, behind the title and buttons. Low contrast: the flowers use
    `--md-sys-color-surface-container-highest` and tertiary tones at ≤ 35 % opacity in both themes. Text contrast
    stays ≥ 4.5:1.
  - One SVG `<symbol>` is reused via `<use>` per flower, with random-but-seeded size and height variation (seed = flower
    index).
  - Sway is a pure CSS keyframe on `transform: rotate()` with per-flower `animation-delay`. It is paused through
    `animation-play-state` when hidden or when the motion level is not Full. No per-frame JS.
  - Moods: droop (rotate down) and fade (lower opacity and saturation) by plant mood. Flowers are never removed. A new
    flower grows in (`bloom` effect).
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
| `settings-animation-level` (options Full/Reduced/Off), `settings-sounds`, `settings-calm-mode`, `settings-transition-warning` (Off/5 min/10 min/15 min), `settings-streak-flame` (switch), `settings-garden` (Single plant/Sunflower field/Off) | settings additions |
| `filter-bar` | `filter-chip-category` (`data-name`, `data-category-id`, `aria-pressed`), `filter-chip-tag` (`data-name`, `aria-pressed`), `filter-clear` |
| `period-title` | text per §5 |
| `nav-prev`, `nav-next`, `nav-today` | buttons |
| `view-switch-month`, `view-switch-week`, `view-switch-day` | tabs (`aria-selected`) |
| `view-switcher` | container of the three tabs |
| `create-button`, `create-menu-event`, `create-menu-tasklist` | FAB and menu |
| `calendar-swipe-area` | swipe target wrapping the active view |
| `month-view`, `week-view` (`data-week-start`), `day-view` (`data-date`) | view roots |
| `month-weekday-header` | 7 elements, text `Mon`..`Sun` |
| `month-cell` | `data-date`, `data-today="true"` on today, `data-outside-month="true"` |
| `month-cell-day-number`, `month-cell-more` | inside a cell; `month-cell-more` text `+N more` (phone `+N`) |
| `week-header` | `data-date`, `data-today`, text `Mon 12` |
| `week-allday-cell` | `data-date` (all-day area per day) |
| `week-day-column`, `day-column` | `data-date` (timed area) |
| `day-header` | `data-date`, `data-today` |
| `day-allday-area` | `data-date` |
| `time-grid` | `data-hour-height` (px) |
| `time-slot` | `data-date`, `data-hour` (clickable, creates event) |
| `event-chip` | `data-event-id`, `data-title`, `data-date` (segment day), `data-all-day`, `data-start-time`, `data-end-time` (segment, `24:00` if it continues), `data-color`; child `event-chip-title`, `event-chip-time` |
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
| `TASKLIST_CALENDAR_ID` | `primary` | calendar for new task lists |
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
