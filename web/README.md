# web/ foundation: shell, kit, stores, extension points

Vue 3 + Pinia + vue-router, hand-built Material 3 Expressive components on `--md-sys-*` tokens.
Toolchain: `export PATH=~/.local/opt/node-v24.21.0-linux-x64/bin:$PATH; pnpm -F @calendar/web test | build | size`.
Visual checks: `pnpm build && node scripts/mock-api.mjs 4173` (serves `dist/` plus an in-memory `/api`, frozen clock
2026-10-12), then Playwright (`mcr.microsoft.com/playwright:v1.64.0-noble`, `--network host`) at 375 px.

## Layout

| Path | What |
|---|---|
| `src/api/` | `client.ts` typed client for every endpoint (`api`, `ApiError`, `setApi` for tests), `types.ts`, `colors.ts` (Google palette, presets, `MORDOR_SEED`, nearest color) |
| `src/stores/` | `clock` (`useClock`), `settings` (+ categories, theme wiring), `items` (range cache), `sync`, `calendar` (period + focus date), `ui` (picker, filter bar, dialog, snackbars) |
| `src/lib/` | `dates.ts` (pure date math, titles, ranges), `items.ts` (segments, ordering, column packing, filter semantics), `timers.ts` (leak-safe timers/listeners), `ripple.ts` (`v-ripple`) |
| `src/components/m3/` | the kit: `Button`, `IconButton`, `Fab`, `TopAppBar`, `NavigationBar`, `NavigationRail`, `AdaptiveSheet` (bottom sheet on phones, modal from 768 px), `ConfirmDialog`, `TextField`, `Select`, `Menu`, `Chip`, `Switch`, `SegmentedButton`, `Snackbar`, `ColorSwatchPicker` |
| `src/components/shell/` | `AppTopBar`, `MonthPicker`, `FilterBar`, `CreateFab`, `SyncErrorBanner`, `SyncStatus`, `InstallPrompts`, |
| `src/components/calendar/` | `TimeGrid` (week/day), `ItemView` + `BasicItem` (default chip/card/block renderer) |
| `src/views/` | `MonthView`, `WeekView`, `DayView` (eager chunks per route), `YearView`, `SettingsView` (lazy) |
| `src/extensions/` | `registry.ts` (all extension points), `create.ts` (new-item defaults), `builtin.ts` |

All "now"/"today" go through `useClock()` (`clock.today`, `clock.todayDate`, `clock.minutesNow`, `clock.nowMs()`).
Every timer or listener goes through `lib/timers.ts`; `window.__appTimers` counts live timers when `config.testMode`.
Exactly one polling timer exists (sync store), paused while hidden.

## Extension points (src/extensions/registry.ts)

Feature modules register from their own entry file, imported once in `extensions/builtin.ts`
(`registerBuiltinExtensions()`, called from `main.ts`). The shell never imports a feature directly.

| Function | Purpose |
|---|---|
| `registerDialog(kind, () => import(...))` | component shown when `ui.openDialog(kind, props)` runs. Receives `props`, must emit `close`. Kinds used by the shell: `'event'`, `'tasklist'` (props `{ mode: 'create', date, time }` from the FAB and time slots) and, for opening existing items, `'event'` / `'tasklist-expanded'` with `{ id }`. Build them on `AdaptiveSheet`. |
| `registerCreateAction({ id, label, icon, testid, run })` | FAB menu entries. The built-ins `event` and `tasklist` already open the dialogs above, so normally nothing to do. |
| `registerItemRenderer('event' \| 'tasklist', Component)` | replaces `BasicItem`. Props `{ segment, variant: 'dot'\|'chip'\|'allday'\|'block', height? }`, emit `open`. Keep the `event-chip` / `tasklist-card` test ids. |
| `registerItemOpener(kind, fn)` | what a tap on an item does (default: `ui.openDialog`). Use `openItem(item)` to trigger it. |
| `registerGridLayer(Component)` | rendered inside each day column of the time grid, props `{ date, hourHeight }` (now marker, drop indicators). Column is `position: relative`. |
| `registerViewHeader('time' \| 'month', Component)` | above the time grid (Now card) or the month grid. |
| `registerTray(Component)` | between the view and the navigation bar (open tasks tray). Set CSS var `--tray-h` on `:root` so the FAB floats above it. |
| `registerTopBarWidget('leading' \| 'trailing', Component)` | streak flame / plant in the top app bar (row 2, right side). `AppTopBar` also has the named slots `leading-widgets`, `trailing-widgets` and `background`. |

Other hooks:

- `useSyncStore().registerTask(name, () => Promise)`: run on every sync (poll, focus, online, retry). Tray and motivation use this.
- `useItemsStore()`: `createEvent/updateEvent/deleteEvent/createTaskList/updateTaskList/deleteTaskList` (If-Match from the cached etag, 412 throws `ApiError.isConflict`, unavailable errors reach the banner), `optimistic(id, apply, call)` for task item ops (rolls back, polls never undo it), `upsert/remove`, `byDate` (segments per day), `loadSummary`.
- `useDaySegments()` returns `(isoDate) => Segment[]` with URL filters applied; `useFilters()` reads/writes the `categories`/`tags` query.
- `useNav()`: `go/prev/next/today/switchView/pickDay/openDay` (keeps the filter query). `openCreate(id, date?, time?)` in `extensions/create.ts`.
- `useUiStore().notify(text, { action, duration, testid })` for snackbars (transition warning, streak message).
- `TimeGrid` exposes `scrollToMinutes(min)`; blocks are `top = start/60 * hourHeight`, min height 24 px, Google-like column packing in `lib/items.ts#packColumns`.
- Motion/motivation (merged from feat/web-motion): `App.vue` feeds `animationLevel`/`calmMode` to `useAnimationLevel`, `sounds` to `setSoundsEnabled`;
  `main.ts` calls `installMotion()`. `AppTopBar` mounts `<TopBarScene :scene="settings.effectiveScene">` (`mordor` always; `sunflowers` only with garden
  `sunflowers`; else `none`) in the `background` slot and `<LeadingWidgets>` in `leading-widgets`. `api.onMotivationChanged` triggers `motivation.refresh()`.
  Swipe navigation bails when `isGestureClaimed()`. `/lab` is the lazy MotionLab route. See `src/motion/README.md` for the reward/drag APIs the event and task list UI should use.
- `settings.installAppearance()` sets `data-theme`, the theme-color meta and `html[data-calm]`; `html[data-motion]` is owned by `motion/level.ts`.

## Conventions

- Dialogs: `AdaptiveSheet` (`data-presentation="sheet|modal"`), rendered only while open. Pass `:dismiss-on-scrim="!dirty"`.
- Phone sheets close on a swipe down anywhere (`AdaptiveSheet`). Scrolled content scrolls first; text inputs are exempt. Add `data-no-sheet-drag` to any element whose own drags must not move the sheet (horizontal scrollers, sliders, canvases).
- Touch targets >= 44 px (`IconButton`, `Button`, `Chip` hit area, `Switch`, swatches). Inputs 16 px.
- `v-ripple` adds the state layer element `[data-state-layer]` and `data-pressed`.
- `data-theme` is always `light` or `dark` (system resolves live); the theme cache lives in `localStorage` (`cal.themeMode`, `cal.themeCss`) and is applied by an inline script in `index.html` before paint.
- Item colors use `color-mix(--c 24%, surface)` so contrast holds in both themes.

## API assumptions beyond spec/API.md

- `Settings.scene` (`sunflowers|mordor|none`), sent in `PATCH /api/settings`; falls back to `localStorage cal.scene` if the server omits it.
- `POST /api/demo/reset` for "Reset demo data" (exists on the server; shown only when `/api/config.provider === 'mock'`). Etags are opaque: sent verbatim.
- Dialog props shape and testids `settings-theme-mordor`, `settings-scene`, `settings-category-up/down`, `settings-reset-demo` are additions to the catalog.
- `year-month` carries `data-month="YYYY-MM"`.

## Known gaps

- No view transition (shared-axis slide) between periods; no drag and drop; no now marker / Now card / transition warning (timeline agent).
- No view transition (shared-axis slide) between periods; no tray (task list agent).
- Phone month shows chips, not dots (`variant: 'dot'` exists in the renderer contract).
- The filter bar tag list comes from cached items only (visible range +/- cache).
- The service worker update prompt needs HTTPS to be observable; `registerType: 'prompt'` replaced autoUpdate.

## Task lists (src/features/tasklists)

Registered by `registerTaskListFeature()` (called from `extensions/builtin.ts`): item renderer + opener for `tasklist`, lazy dialogs
`tasklist-expanded` (`{ id }`) and `tasklist` (`{ mode: 'create', date }` / `{ mode: 'edit', id }`), the lazy open tasks tray, and the sync task `open-tasks`.

- `TaskListCard.vue` is the collapsed renderer. Layout uses container queries, so it adapts to any width (title always wins; 50 px phone month cells
  show title + a thin progress bar only). **Drag and drop:** the root `<button data-testid="tasklist-card" data-draggable="tasklist">` is exposed
  as `defineExpose({ el })` and emitted once as the `el` event after mount; use `useDraggable(el, ...)` on it (or on a wrapper). Clicks right after a drag are swallowed by the motion lib.
- `ops.ts`: item operations (`patchItem`, `addItem`, `removeItem`, `moveItem`). One serial queue per list; the UI shows `confirmed list + pending ops`,
  unsent patches of the same item merge (last write wins), a failed op is rolled back alone and a snackbar (`tasklist-rollback`) is shown. Polls never overwrite a list with pending ops.
- `store.ts` (`useTaskListsStore`): `tray` (open lists of the last 30 days, tray order), `count`, `nextTask` (first unticked item of the oldest open list, for the Now card), `refresh()`.
- Carry-over: `lib/items.ts#itemSegments(item, today)` puts an open list dated in the 30 days before today onto today (`segment.carriedFrom`); finishing it sends it back to its own date.
  `items.setCarried()` keeps open lists from outside the visible range in the cache.
- Timed lists occupy `estimateMinutes` (default 30) in the grid.

Assumptions: the create dialog ignores the suggested time (the spec form defaults to no time); the tray is not filtered by category/tag filters (out of sight is out of mind);
tags are a comma separated text field with removable chips below it; the repeat field is create-only (the API cannot change recurrence); the desktop tray is a 300 px right-hand panel
(`App.vue` `.col` becomes a row from 768 px); `--tray-h` is only set on phones; Move to today keeps the time of the list; the `size-limit` budgets for all JS (145 kB) and CSS (18 kB) were raised for this feature.
`X-Motivation-Changed` refresh is already global in `App.vue` (`api.onMotivationChanged`), nothing extra here.
## Calendar feature (src/features/calendar, branch feat/calendar-ui)

Registered by `registerCalendarFeature()` (called from `extensions/builtin.ts`): lazy `'event'` dialog, `EventItem` renderer
(dot/chip/allday/block), grid layers `NowMarker` and `DropIndicator`, view header `NowCard`, and the transition warning
service (`transitionWarning.ts`, a Pinia-bound effect scope driven by `clock.nowTick`).

| File | What |
|---|---|
| `EventDialog.vue`, `eventForm.ts`, `zone.ts` | Dialog, pure form model (defaults, duration-keeping start change, validation messages from the spec, API conversion with a DST-correct offset) |
| `EventItem.vue` | Title-first blocks (2 lines, time and duration only when there is room, container queries for the 7-column week), phone month chips with 2 px start border + clip fade instead of ellipsis, past events dimmed, running event ringed, calm mode desaturates |
| `timeline.ts` | `formatDuration`, `nowCardModel`, `dueWarnings`, `nowMarkerTop`; `blockGeometry`/`MIN_BLOCK_PX` live in `lib/items.ts` (TimeGrid uses them); `packColumns` now also returns `span` (blocks widen into free columns) |
| `NowMarker.vue`, `NowCard.vue`, `nowLines.ts` | Live line (`data-time`), card with progress. `registerNowCardLine(() => string \| null)` lets the task list/tray agent add `Next task: Fold (Laundry)` |
| `dnd.ts` | Shared drag and drop (see below) |

**Shared drag hook for task list cards**: `useCalendarDrag(rootRef, () => segment, () => variant)` from `@/features/calendar/dnd`
(also exported from `@/features/calendar`). Put it in the task list renderer's setup with the card root element ref. It picks slots /
all-day cells / month cells from where the card lives, shows the drop preview, and `applyMove` does the optimistic PATCH
(`updateTaskList`/`updateEvent` with If-Match), rollback + `move-failed` snackbar, and rejects so the card springs back.
`planMove(segment, {date, minutes|null}, tz)` is the pure part. Cards need no `touch-action` override: the long press (350 ms)
decides, scrolling before it works, and `.main` keeps `touch-action: pan-y`.
`items.optimisticItem(id, next|null, call)` (new in the items store) is the generic optimistic create/update/delete.

### Assumptions (owner was asleep)

- The event dialog stays open while saving and shows the error on failure (AC-32, sync.feature) after rolling the optimistic item back; a snackbar `event-rollback` also says it was not saved. It closes only after Google confirmed.
- Drag: timed stays timed, all-day stays all-day (A-55); a multi-day event moves by the delta of the dragged day; moves in the time grid are in wall-clock minutes (a DST day still has 24 rows). Month cells on phones are not draggable (a tap there opens the day).
- Time inputs are native `type=time/date`, so the 12/24 h display follows the browser locale; values are always `HH:mm`.
- "Calendar color" swatch uses the selected calendar's color; the default event color comes from settings.
- Day scroll: today scrolls so now is in the upper third, other days 07:00 at the top.
- The minute ticker fires exactly on the minute (was +20 ms) so "N minutes pass" in a fake-clock test always lands the tick.
- Transition warnings only see the loaded range, so they work while a calendar view showing today is cached (not in settings/year); updated text counts down ("starts in 7 min"), auto-hides at the start. Dismissal is per event.
- Size budgets: initial JS 75 kB unchanged (44 kB); "all JS" raised 130 -> 145 kB and CSS 15 -> 20 kB (spec: initial 150 kB, CSS 30 kB) because the feature adds ~8 kB gzipped, the event dialog chunk is lazy.
- Real-browser checks (Playwright, 375 px touch with CDP long press, 1280 px mouse): drag persists, the long press requests `vibrate(10)`, no swipe navigation fires, vertical scroll still works before the press.
