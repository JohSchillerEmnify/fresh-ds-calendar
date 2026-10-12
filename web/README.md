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
| `src/components/shell/` | `AppTopBar`, `MonthPicker`, `FilterBar`, `CreateFab`, `SyncErrorBanner`, `SyncStatus`, `InstallPrompts`, scene placeholder |
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
- Motion: the shell mirrors `html[data-motion]` (min of setting, calm, system) and `html[data-calm]` in `settings.installAppearance()`.
  When `src/motion/level.ts` is merged, call `useAnimationLevel(() => settings.settings.animationLevel, () => settings.settings.calmMode)` in `App.vue` and drop the mirror.
- Top bar scene: `AppTopBar` mounts `features/motivation/TopBarScene.vue` when that file exists (resolved with `import.meta.glob`), otherwise `components/shell/TopBarScenePlaceholder.vue`.
  It receives `:scene` = `settings.effectiveScene` (`mordor` always; `sunflowers` only with garden `sunflowers`; else `none`).

## Conventions

- Dialogs: `AdaptiveSheet` (`data-presentation="sheet|modal"`), rendered only while open. Pass `:dismiss-on-scrim="!dirty"`.
- Touch targets >= 44 px (`IconButton`, `Button`, `Chip` hit area, `Switch`, swatches). Inputs 16 px.
- `v-ripple` adds the state layer element `[data-state-layer]` and `data-pressed`.
- `data-theme` is always `light` or `dark` (system resolves live); the theme cache lives in `localStorage` (`cal.themeMode`, `cal.themeCss`) and is applied by an inline script in `index.html` before paint.
- Item colors use `color-mix(--c 24%, surface)` so contrast holds in both themes.

## API assumptions beyond spec/API.md

- `Settings.scene` (`sunflowers|mordor|none`), sent in `PATCH /api/settings`; falls back to `localStorage cal.scene` if the server omits it.
- `POST /api/demo/reset` for "Reset demo data" (shown only when `/api/config.provider === 'mock'`). The server agent must provide it (or tell us the real path).
- Dialog props shape and testids `settings-theme-mordor`, `settings-scene`, `settings-category-up/down`, `settings-reset-demo` are additions to the catalog.
- `year-month` carries `data-month="YYYY-MM"`.

## Known gaps

- No view transition (shared-axis slide) between periods; no drag and drop; no now marker / Now card / transition warning / tray (timeline and task list agents).
- Phone month shows chips, not dots (`variant: 'dot'` exists in the renderer contract).
- The filter bar tag list comes from cached items only (visible range +/- cache).
- The service worker update prompt needs HTTPS to be observable; `registerType: 'prompt'` replaced autoUpdate.
