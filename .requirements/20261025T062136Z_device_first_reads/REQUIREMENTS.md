# Device-first storage, slice 1: every read comes from the device store

Spec: `spec/features/app/last-known-state.feature` (extended, `@id:last-known-state` kept). ADR 0025 (accepted), builds
on ADR 0023. Model: `docs/architecture/models/{web,server}.c4`, views `openingWithLastKnownState`,
`syncingTheDeviceStore`. Steps: `e2e/STEPS.md` "Last known state".

## As Is

ADR 0023: one snapshot per person in IndexedDB `calendar-last-known` (`web/src/stores/lastKnown.ts`,
`web/src/lib/lastKnownDb.ts`) holding config, settings, prefs, calendars, own themes and the items of ranges that were
the visible one, within ±28 days of today. It is restored before the first route and replaced by fresh answers; every
other kind of data is only read from the server, when a screen needs it. Writes go to the server; offline they fail with
the sync banner. The "Last updated HH:mm" note shows only between the restore and the first fresh answer.

### Audit: every kind of data the app shows

| Kind | Loaded today (file) | Refreshed by sync today | On the device today |
|---|---|---|---|
| App config (clock, poll interval, enabled plugins e.g. door) | `stores/clock.ts:39` `/api/config`; `pwa/update.ts:134` | yes (with config on focus/online/retry) | yes, snapshot `config` |
| Events (own, other calendars, invitations, read-only reminder overrides applied by the server) | `stores/items.ts:122,128` `/api/items` per visible range + `prefetch` neighbours; `features/calendar/EventDialog.vue:92` `getEvent` | yes (`items` task, visible range only) | only ranges that were visible, ±28 days |
| Birthdays (Birthdays/contacts calendar, Google birthdays) | same `/api/items` | same | same as events |
| Task lists + items (dated, shared lists `shared:*`, door tag) | `/api/items`; `features/tasklists/useTaskList.ts:30`, `TaskListDialog.vue:102,199` `getTaskList` | visible range | seen ranges only |
| Undated task lists | `/api/items` anchor date (ADR 0017), tray/Tasks view | partly | only if on a seen anchor day |
| Open tasks tray (open lists 30 days + finished today) | `features/tasklists/store.ts:30` `/api/tasklists/open` | yes (`open-tasks` task) | no |
| Tasks view: all open / Archive | `features/tasklists/tasksStore.ts:37,47` | while the view is open (`tasks-view` task) | no |
| Canvas areas | `features/tasklists/canvasStore.ts:92,101` `/api/canvas` | while the Canvas is open | no (view pan/zoom in localStorage, device-wide) |
| Year view / month picker day counts | `stores/items.ts:399` `/api/summary` | yes (`summary` task) | no |
| Settings (theme mode, seed, default view, animations, streak/plant/sunflower switches, **categories**) | `stores/settings.ts:37,62` `/api/settings` | yes | yes, snapshot `settings` |
| Prefs (labs, nav, tasks sort/filter, language, **bedtime**, **notifications** `notify`, min event length, two-row week, …) | `stores/prefs.ts:97` via `App.vue:92` (`labs.load()`), once at start | **no** (never refreshed after start) | yes, snapshot `prefs`; language also `localStorage` (`i18n/index.ts:61`, device-wide) |
| Calendars (list, hidden, default reminders) | `stores/calendars.ts:15`, `App.vue:91`, `features/calendar/calendars.ts:10` | yes | yes, snapshot `calendars` |
| Theme choice (`/api/prefs/theme`) incl. scene, overrides | `stores/theme.ts:41`, at start only | no | localStorage `cal.theme` + `cal.themeCss`/attrs (`theme/index.ts`), **device-wide, not per person, not wiped** |
| Own themes (drawn scenes, pictures) | `stores/theme.ts:40`, at start only | no | yes, snapshot `themes` |
| Task list templates | `features/tasklists/templatesStore.ts:31` on opening picker/settings | no | no — branch `fix/templates-on-device` adds it |
| Tasks-calendar default reminders | `views/RemindersView.vue:47`, `TaskListDialog.vue:91` | no | no |
| People / category shares (sharing) | `components/settings/CategoryDialog.vue:36`, `TaskListDialog.vue:98` | no | no |
| Streak and plant (motivation) | `features/motivation/store.ts:62` raw `fetch('/api/motivation')` | on change events, new day | no |
| Android widget week | `native/widgetBridge.ts:58` own `api.items` (≤10 min) → SharedPreferences | per sync | native copy, separate |
| Reminder plan (in-app, native, Web Push) | computed from loaded items, `features/calendar/reminderPlan.ts` | — | from whatever is loaded |
| Not person data / stays online: session `/api/auth/me` (`stores/auth.ts:47`), backup status (`stores/backup.ts:21`), release notes (`pwa/releaseNotes.ts:44`, `WhatsNewSheet.vue:26`), push key (`pwa/push.ts:51`), health | — | — | — |
| Device-only UI state (hour height, collapsed lists, section mode, tray collapsed, create kind, install/APK hints, bedtime-reminder-shown) | localStorage | — | yes, device-wide; unchanged by this slice |

Door board: the board itself reads `GET /api/door` on the server with its own key (ADR 0003/0004); in the app the door
is the `door` tag on a task list (kept with the lists) and `config.plugins` (kept with the config). Bedtime and
notification settings are prefs. Drawn scenes are part of own themes / the theme choice.

Server side today: `CalendarProvider.listChanges(calendarId, syncToken)` exists (`server/src/providers/google/GoogleProvider.ts:203`)
but nothing calls it; the mock ignores the token (`MockGoogleProvider.ts:255`). Settings carry a `version`; prefs,
templates, canvas carry an `updated`/version-like field in places; own themes and motivation have none.

## To Be

One device store per person (IndexedDB) holds every kind above marked "person data". The app renders only from it; no
screen waits for the server. A sync engine (the existing `sync` store triggers: open, focus, visibility, `online`, poll
interval, retry) asks the server for the changes since the device's cursor and applies them to the store; the stores
the views use (items, settings, prefs, calendars, theme, templates, canvas, tray/tasks view, motivation) are fed from
the device store. Kept: events from today − 1 year to today + 1 year (sliding), all task lists, everything else in full.
Days outside the window are fetched from the server when opened and not kept. Writes still go online exactly as today
(the outbox is slice 2): a successful write's answer goes into the device store at once; a failed one shows the banner
and changes nothing. Wiped on sign-out, on the sign-in page and when another person signs in (also the device-wide
theme cache). The "Last updated HH:mm" note shows while nothing fresh came since the app opened, or the last sync
failed; the time is that of the last complete successful sync.

Templates: branch `fix/templates-on-device` gives templates a device copy and its own scenarios
(`tasklist-templates.feature` "Templates are kept on this device", and "Someone else signing in … does not get my
templates" in this feature). This slice does not repeat those scenarios; when both are merged the templates copy lives
in the same device store and is synced like the other per-person files. The two branches touch the description of
`last-known-state.feature`; whichever merges second takes this description (it already names the templates).

## Requirements

- R1 Device store: one IndexedDB store per person holding config, events (±1 year), all task lists with items
  (incl. shared, undated, finished), settings incl. categories, prefs (incl. bedtime, notify, language), calendars,
  theme choice, own themes, templates, Canvas areas, tasks-calendar default reminders, people and category shares,
  motivation, and the sync cursor with the time of the last complete sync.
- R2 Reads: every view, tray, sheet and dialog reads the kinds of R1 from the device store; the open tasks tray,
  Tasks view (open and Archive), Canvas and year view counts are computed on the device from it (within the window for
  counts). The widget bridge and the reminder plan read from it too.
- R3 Sync: on open, focus, visibility, `online`, the poll interval and retry, the device asks for the changes since its
  cursor and applies them (adds, changes, removals) per kind; a kind the server answers in full replaces that kind.
  This covers days never opened.
- R4 Window: events are kept from today − 1 year to today + 1 year; as days pass, events leaving the window are
  dropped and the day entering it is loaded. A range outside the window is fetched when opened, shown, and not kept;
  offline it shows empty with the sync banner.
- R5 Writes (slice 1): unchanged, online only; on success the answer is applied to the device store; on failure the
  banner shows and the device store is not changed.
- R6 Per person: signing out, reaching the sign-in page, or a session of another person wipes the device store and the
  device-wide theme cache before anything of the other person is shown.
- R7 Note: "Last updated HH:mm" shows while no complete sync succeeded since the app opened, or after a failed sync,
  and disappears after the next complete successful sync. HH:mm is the app-clock time of the last complete sync.
- R8 Robustness: a hanging or blocked IndexedDB never keeps the app from starting (as 0023: then it reads from the
  server as before); a quota error keeps the app working without the device store.

- R9 Live sync (ADR 0030, owner 2026-10-30): every open, visible app keeps one Server-Sent Events connection. On every
  change that goes through the server (events, task lists, settings, prefs, theme, own themes, templates, Canvas,
  shared lists, motivation) the server publishes a content-free `changed` nudge to every open app of the affected
  person and of every member of a shared list; the app then syncs (R3). Target: under about 1 s between devices.
- R10 Google-side changes: while at least one app of a person is connected the server asks Google for changes every 20 s
  (sync tokens, S2) and publishes a nudge when there are any; with no app connected it does not ask.
- R11 Safety net: sync on open, focus, reconnect and a 60 s poll while visible stay; the connection reconnects by
  itself and the app syncs once after every reconnect; a hidden app neither polls nor holds the connection and syncs at
  once when shown.
- R12 Privacy: the stream needs a session; sign-out and another person's sign-in end the person's connections; a nudge
  carries no data and reaches only that person's (or the list members') connections.

### Server needs for "changes since" (requirements, no code yet)

Verified against the Google Calendar API docs (Events: list, "Synchronize resources efficiently", 2026-10-25):
`syncToken` returns only entries changed since the token, deleted ones always included (`showDeleted=false` not
allowed); it **cannot** be combined with `iCalUID, orderBy, privateExtendedProperty, q, sharedExtendedProperty,
timeMin, timeMax, updatedMin`, all other parameters must equal the initial request's; `nextSyncToken` is only on the last
page (follow `nextPageToken` with the same `syncToken`); an expired/invalidated token answers **410 Gone** — clear the
store and do a full sync without a token; disallowed parameters answer 400.

- S1 `GET /api/changes?cursor=<opaque>` (name to settle at build): without a cursor answers the full set of R1 for the
  person (events of the window, all task lists, every per-person file) plus a cursor; with one, per kind the changed and
  removed things and a new cursor, or the kind in full marked `replace`.
- S2 Events: per calendar the server reads with `events.list` + `syncToken`, follows every page to `nextSyncToken`, and
  returns changes inside today ± 1 year as upserts and removals (cancelled, or moved out of the window). Because the
  token cannot carry `timeMin/timeMax/privateExtendedProperty`, the initial list per calendar uses only parameters the
  incremental one may repeat; task lists in the tasks calendar are told apart after reading (by their private
  properties), not by a filter.
- S3 410 Gone (or a token the server cannot use): that calendar is listed again in full and answered as `replace`; the
  device replaces that calendar's events. Never an error banner for this alone.
- S4 Repeating events: the change stream must yield changed series so the window's instances can be produced; to verify
  at build whether `singleEvents=true` without `timeMax` is usable with a token, else read series unexpanded
  (`singleEvents=false`, as `services/calendar.ts:598` already does for exceptions) and expand on the server within the
  window (open choice 4).
- S5 The cursor is per device (two devices of one person sync independently) and opaque to the web app; it carries or
  points to one Google token per calendar plus the versions of the per-person files (open choice 2).
- S6 Shared lists (server store, `services/sharedLists.ts`): a change stamp per list so the changes since a cursor can
  be found, deletions included.
- S7 Per-person files (settings, prefs, theme choice, own themes, templates, canvas, reminder overrides, motivation):
  each answers a version (ETag); unchanged files are left out of the answer, changed ones come in full (they are small).
  Own themes and motivation get a version they lack today. Reminder overrides change events, so a change to them
  re-sends the affected events.
- S8 Calendar list: answered in full each time (small), or with `calendarList` sync tokens later.
- S9 The rate guard (ADR 0007) applies; a sync-token call per calendar replaces today's range reads, so the number of
  Google calls per poll must not grow. Rate-limited: the device keeps its data, no banner (as today).
- S10 Mock provider: `listChanges` must honour the token (changes after it, deletions, a way to expire it for a 410
  test) so the e2e can run against it.
- S12 Live updates endpoint (`GET /api/events/stream`, name settled at build, API.md): `text/event-stream`, event
  `changed` without data, keep-alive comment every 25 s, `401` without a session. In-memory publisher keyed by person;
  shared-list writes publish to each member. The Google poller runs per person while the person has at least one
  connection, its interval `googlePoll` (default 20 s, test override). One server instance: no shared broker
  (ADR 0030).
- S13 The deployment's reverse proxy must pass `text/event-stream` unbuffered and with a long read timeout
  (`docs/DEPLOYMENT.md`, Caddy `flush_interval -1`).
- S11 Idempotent writes are slice 2 (outbox), not needed here.

## Acceptance Criteria

- R1, R2: "Without a connection the app shows the last known calendar", "… the coming weeks show even when I never
  opened them", "… birthdays and events months ahead show", "… every task list shows, dated or not, also an old one still
  open" (Canvas area, Tasks view), "… my categories and bedtime still apply", "… my own theme still applies", "Task lists
  and my settings are kept too"; templates: `tasklist-templates.feature` on `fix/templates-on-device`.
- R3: "A change made elsewhere is taken in at the next sync, also on days I never opened", "Settings and preferences
  changed on another device arrive when the app regains focus", "On a slow connection …".
- R4: "Events more than a year away are not kept, opening their day loads them".
- R5: "Without a connection a change is not saved yet".
- R6: "Signing out removes the stored calendar from the device", "Someone else signing in on this device sees nothing of
  mine".
- R7: "The note says when the calendar was last updated while a sync fails", and the first two scenarios.
- R8: unit tests (as for 0023's restore timeout).
- S1–S10: server integration tests with the mock (token, pages, deletions, 410 → replace, window filter, versions).

- R9: "A change made on one device shows on the other open app within a second", "A setting changed …", "An area made
  on the Canvas …", "A ticked item of a shared list shows on the other person's open app within a second".
- R10: "A change made in Google Calendar itself shows within 20 seconds while the app is open", "Google is asked for
  changes only while an app is open"; unit test: the default interval is 20 s.
- R11: "Changes missed while the connection was down arrive at once when it returns", "Without the live connection the
  poll still brings the change", "A hidden app fetches nothing and catches up at once when it is shown again".
- R12: "Nothing is pushed to a device that is signed out", "Nothing is pushed to the app of another person"; server
  integration test: `401` without a session, no event to a connection of another person.
- S12, S13: server integration tests (publish reaches only the right connections, keep-alive, closing on sign-out,
  poller starts with the first connection and stops with the last); `docs/DEPLOYMENT.md` note.

## Testing Plan

- Unit (web): device store wrapper (per-person keys, wipe, quota/hang), window pruning and sliding, applying a change
  set (upsert, remove, replace per kind), computing tray/Tasks view/year counts from the store, note visibility rule.
- Unit/integration (server): `/api/changes` with the mock — first call full, second call only changes, deletion,
  move out of the window, page following, 410 → full `replace`, per-file versions, per-device cursors independent.
- e2e: the scenarios above, targeted with `--grep`, desktop + mobile where layout matters (Tasks view, Canvas).
- Live sync: unit (web) EventSource lifecycle (open when visible, close when hidden, nudge → one sync, reconnect → one
  sync, coalescing of nudges that arrive during a running sync); unit (server) publisher, poller; e2e the "Live sync"
  rule, each with the poll interval off so only the stream can explain the result.
- Existing `@offline`, `@last-known-state`, `@templates`, sync and sign-in scenarios must stay green.

## Implementation Plan (after the owner's OK on the scenarios)

1. Server: mock `listChanges` honouring tokens + 410; unit tests. → test: provider tests.
2. Server: `/api/changes` for events and task lists (S1–S4, S9) behind the existing service; integration tests.
3. Server: versions for per-person files and shared lists (S6, S7); `/api/changes` includes them. — **PR boundary 1
   (server, mergeable alone: nothing calls it yet).**
4. Web: device store (replaces the 0023 snapshot, migrates nothing: it simply syncs fresh), wipe rules; unit tests.
5. Web: sync engine applies change sets; items/settings/prefs/calendars/theme read from the store; window; note rule.
   → e2e of R1 calendar parts, R3, R4, R6, R7.
6. Web: tray, Tasks view, Canvas, year counts, reminder defaults, people, motivation, widget from the store. → e2e of
   the task list/Canvas scenario. Templates folded in after `fix/templates-on-device` is merged. — **PR boundary 2
   (web).**

7. Server: in-memory publisher and `GET /api/events/stream` (keep-alive, session check, close on sign-out); every
   write path (events, task lists, settings, prefs, theme, own themes, templates, Canvas, shared lists, motivation)
   publishes after it is saved. → server integration tests; deploy note for the proxy (S13).
8. Server: Google poller per person with a connection (20 s, `googlePoll` test override, mock lookup counter
   `/api/__test/remote/lookups`). → test: change in the mock Google yields a nudge within the interval; none without a
   connection.
9. Web: live subscriber (`EventSource` while visible, nudge/reconnect/visible → sync, nothing while hidden); the 60 s
   poll stays. → e2e of the "Live sync" rule. **PR boundary 3 (live sync, after PR boundaries 1 and 2: it needs
   `/api/changes` and the sync engine; mergeable alone only on top of them).**

## Assumptions (to confirm with the owner)

- A1 Days outside the window are shown when opened online but not kept (ADR 0025 "days further out load from the server
  when opened").
- A2 Motivation (streak, plant), people/category shares and the tasks-calendar reminder defaults count as "everything"
  and are kept.
- A3 The note also shows after a failed sync while the app is open (today it only shows after a restore).
- A4 The old open list "Visa" (2025-06-02) shows under "Overdue" in the Tasks view, as any open list dated before
  today does today (`tasks-view.feature`).
- A5 (live sync) A hidden app drops its connection instead of keeping it, so Google is asked only while an app is
  visible; the cost is one reconnect plus one sync when shown. Alternative: keep the connection while hidden and
  ignore nudges (more load, nothing gained).
- A6 (live sync) The e2e uses the default 20 s for the Google scenario and a short test interval elsewhere.
- A7 (live sync) The sync fetch endpoint keeps its working name `/api/changes` in the scenarios' request-count steps.
