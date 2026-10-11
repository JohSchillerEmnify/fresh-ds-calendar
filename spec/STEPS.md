# Step library contract

All step phrases used in `spec/features/*.feature`, as Cucumber expressions. The e2e step library
(`e2e/steps/*.ts`, playwright-bdd) implements exactly these. Steps match regardless of keyword
(Given/When/Then/And), as in Cucumber. `scripts/check-steps.py` in `spec/` verifies that every
feature step matches exactly one expression below.

## Parameter types

| Type        | Regex                       | Notes                                          |
|-------------|-----------------------------|------------------------------------------------|
| `{string}`  | built-in `"..."`            | Quoted text. `""` is the empty string.         |
| `{int}`     | built-in                    |                                                |
| `{date}`    | `\d{4}-\d{2}-\d{2}`         | Local date in Europe/Berlin.                   |
| `{month}`   | `\d{4}-\d{2}`               |                                                |
| `{time}`    | `\d{2}:\d{2}`               | 24 h local time. `24:00` = end of day.         |
| `{view}`    | `month\|week\|day`          |                                                |
| `{scheme}`  | `light\|dark`                |                                                |
| `{float}`   | built-in                    |                                                |
| `{weekday}` | `"(Monday\|...\|Sunday)"`   | Quoted English weekday name, resolved against the week currently shown (`data-week-start` on `week-view`). |

Define the custom types with `defineParameterType` in `e2e/steps/parameters.ts`.

## Conventions

- **Times and dates** in steps are local Europe/Berlin wall-clock values. The browser context runs with
  `timezoneId: 'Europe/Berlin'`, `locale: 'en-GB'`.
- **"Google ..." steps** act on the provider directly through `/api/__test/remote/*` (see API.md), never via the UI.
- **"the calendar contains ..." steps** create data through the public API (`POST /api/events`, `POST /api/tasklists`)
  before the page is opened.
- **"Google contains ..." steps** read the raw Google-shaped resources through `GET /api/__test/remote/events`.
- **Lists in one string** (`"Milk, Eggs, Bread"`) are joined with `", "` and compared exactly and in order.
- **Form tables** (`I fill in ... form with:`) are two-column rows-hash tables: field name, value.
  - Event fields: `title`, `all day` (`yes`/`no`), `start date`, `start time`, `end date`, `end time`,
    `description`, `location`, `calendar` (calendar display name, e.g. `Personal`, `Work`).
  - Task list fields: `title`, `date`, `time` (empty = no time), `items` (`; `-separated, typed as one item per line).
  - An empty cell clears the field. A cell wrapped in double quotes (`"   "`) is typed literally without the quotes.
  - `<N characters>` (e.g. `<201 characters>`) types N times the letter `x`.
  - Fields are filled in the table order; filling a field that is not visible (e.g. `start time` when `all day` is
    `yes`) is an error.
- **"... form shows:"** compares only the listed fields; an empty cell means the field is empty.
- **Item tables** (`with items:`) have the header `| item | done |`; `done` is `yes` or `no`.
- **Waiting**: assertions use Playwright's auto-retrying `expect` with the default timeout (5 s).
  "I wait for the automatic sync" waits until the app reports a completed sync newer than the step start
  (`data-last-sync` on `sync-status`) — at most `pollIntervalMs + 5 s`.
- **Locating items by title**: event chips by `data-title`, task list cards by `data-title`; if several segments of
  one multi-day item exist, "I open the event" uses the first visible one.
- **Viewport**: Playwright project `mobile` (default) runs everything except `@desktop`; project `desktop` runs
  everything except `@mobile` and `@perf`. Steps must work in both viewports.

## Setup and clock

```
the calendar is empty
today is {date}
the time is {date} {time}
automatic sync runs every {int} seconds
automatic sync is disabled
I am using a phone
I am using Safari on an iPhone
the app runs as an installed app
```

- `the calendar is empty` → `POST /api/__test/reset` with `{ "seed": false }`.
- `today is D` → `POST /api/__test/clock` with `D` 08:00 Europe/Berlin, frozen.
- `the time is D T` → same with the given time.
- `automatic sync runs every N seconds` → `POST /api/__test/config { "pollIntervalMs": N*1000 }`; `is disabled` → `0`.
- `I am using a phone` asserts the viewport is ≤ 430 px wide and touch is enabled (mobile project).
- `I am using Safari on an iPhone` / `the app runs as an installed app` use `page.addInitScript` to override
  `navigator.userAgent` (iPhone Safari UA) and `navigator.standalone` / `matchMedia('(display-mode: standalone)')`.

## Data fixtures

```
the calendar contains an event {string} on {date} from {time} to {time}
the calendar contains an event {string} in the calendar {string} on {date} from {time} to {time}
the calendar contains an event {string} from {date} {time} to {date} {time}
the calendar contains an all-day event {string} on {date}
the calendar contains an all-day event {string} from {date} to {date}
the calendar contains a task list {string} on {date} with items:
the calendar contains a task list {string} on {date} at {time} with items:
the calendar contains an empty task list {string} on {date}
the calendar contains a task list {string} on {date} with {int} generated items
Google contains a raw task list event {string} on {date} with the description:
```

All-day ranges in steps are inclusive (`from 2026-10-17 to 2026-10-20` = 4 days); the API uses an exclusive end.
Generated items are titled exactly `Generated item 1` … `Generated item N`, all not done. 40 such items serialize to
more than 1024 characters of JSON, which forces chunking (see ARCHITECTURE.md).
The raw task list event has `extendedProperties.private.kind = "tasklist"` but no `items` property (doc string = description).

## Navigation

```
I open the app
I open the path {string}
I open the month view for {month}
I open the week view for {date}
I open the day view for {date}
I go to the next period
I go to the previous period
I go to today
I switch to the {view} view
I go back in the browser
I reload the page
I click the day number of {date}
I click the week header of {date}
I tap the day {date} in the month view
I click the overflow link on {date}
the {view} view is shown
the URL path is {string}
the period title is {string}
the weekday headers are {string}
the month grid starts on {date} and ends on {date}
{date} is shown as outside the current month
{date} is shown as inside the current month
the week columns are {string}
{date} is highlighted as today
exactly one day is highlighted as today
no day is highlighted as today
the overflow link on {date} reads {string}
```

## Events: display

```
I see the event {string} on {date}
I see the event {string} on {weekday}
I see the event {string} on each day from {date} to {date}
I see the all-day event {string} on {date}
I do not see the event {string}
I do not see the event {string} on {date}
the event {string} shows the time {string}
the event {string} is positioned from {time} to {time}
the event {string} is positioned on {date} from {time} to {time}
the events {string} and {string} do not overlap
the events {string} and {string} are side by side
the event {string} spans the full width of its day column
the event {string} has the color {string}
the items on {date} are shown in the order {string}
```

- "positioned" checks `data-start-time`/`data-end-time` of the chip segment and that its top/height match the time
  grid (`data-hour-height` on `time-grid`) within ±3 px.
- "do not overlap": bounding boxes do not intersect. "side by side": both have a top within the other's vertical span
  and different left edges. "spans the full width": chip width ≥ 90 % of its day column width.
- "the items on D are shown in the order": DOM order of `data-title` of event chips and task list cards inside the
  month cell of D.

## Events: dialog

```
I start creating an event
I click the time slot {time} on {date}
I fill in the event form with:
I save the event
I cancel the event dialog
I press Escape
I open the event {string}
I delete the event
I confirm the deletion
I cancel the deletion
the event dialog is open
the event dialog is closed
the event dialog shows the error {string}
the event form shows:
the event dialog is shown as a bottom sheet
the event dialog fits within the viewport
```

## Task lists

```
I start creating a task list
I fill in the task list form with:
I save the task list
I cancel the task list dialog
the task list dialog is open
the task list dialog is closed
the task list dialog shows the error {string}
the task list form shows:
I see the task list {string} on {date}
I do not see the task list {string}
the task list {string} shows the done count {string}
the collapsed task list {string} lists the items {string}
the collapsed task list {string} shows {string}
the task list {string} shows the time {string}
the task list {string} is positioned at {time}
the task list {string} is shown in the all-day area on {date}
I expand the task list {string}
I collapse the task list
the task list {string} is expanded
the task list {string} is collapsed
the expanded task list items are {string}
the expanded task list is shown as a bottom sheet
the expanded task list fits within the viewport
I tick the item {string}
I untick the item {string}
the item {string} is ticked
the item {string} is not ticked
I add the item {string}
I rename the item {string} to {string}
I rename the item {string} to {string} but press Escape
I delete the item {string}
I move the item {string} up
I move the item {string} down
I rename the task list to {string}
I edit the task list details
I delete the task list
```

"the task list X shows the done count" checks the expanded header if X is expanded, else the collapsed card.
Item steps act on the currently expanded task list.

## Google (provider) side

```
Google contains an event {string} on {date} from {time} to {time}
Google contains an all-day event {string} from {date} to {date}
Google contains no event {string}
the Google event {string} has:
the Google event for the task list {string} is an all-day event on {date}
the Google event for the task list {string} is a timed event on {date} from {time} to {time}
the Google event for the task list {string} has the private extended property {string} set to {string}
the Google event for the task list {string} has the description:
the Google event for the task list {string} stores its items in more than one chunk
Google adds an event {string} on {date} from {time} to {time}
Google renames the event {string} to {string}
Google moves the event {string} to {date} from {time} to {time}
Google deletes the event {string}
Google adds a task list {string} on {date} with items:
Google ticks the item {string} in the task list {string}
Google renames the task list {string} to {string}
Google becomes unavailable
Google becomes available again
```

`the Google event X has:` compares dotted paths of the raw Google event resource (`calendarId` is the calendar the
event lives in) with the given values.

## Sync and network

```
the network connection is lost
the network connection is restored
the app regains focus
I wait for the automatic sync
I retry the sync
I see the sync error banner
I do not see the sync error banner
```

- Network: `context.setOffline(true|false)`.
- Focus: dispatch `visibilitychange` (with `document.visibilityState` = `visible`) and `focus` on `window`.

## Mobile

```
the page has no horizontal scroll
the view switcher is at the bottom of the screen
the create button is at the bottom of the screen
the navigation, view switcher and create buttons are at least {int} by {int} pixels
I swipe left on the calendar
I swipe right on the calendar
I swipe up on the calendar
the viewport meta tag contains {string}
the bottom bar reserves the safe-area inset at the bottom
```

- No horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
- "at the bottom of the screen": element's bottom edge is within the lowest 120 px of the viewport.
- Swipes dispatch `touchstart`/`touchmove`/`touchend` on `calendar-swipe-area` (CDP `Input.dispatchTouchEvent`):
  horizontal 200 px over 150 ms for left/right; vertical 300 px for up.
- Safe area: the computed style of `bottom-bar` uses `env(safe-area-inset-bottom)`; the step checks the inline/
  stylesheet rule via `data-safe-area="true"` on `bottom-bar` (set by the component that applies the padding).

## PWA and HTTP

```
I request {string}
the response status is {int}
the response JSON field {string} equals {string}
the page links a web app manifest
the manifest declares an icon of size {string}
the manifest declares a maskable icon
every manifest icon can be downloaded as a PNG
the page has a theme color
the page has an apple touch icon of size {string}
the page has the meta tag {string} set to {string}
a service worker is registered for scope {string}
the service worker controls the page
the browser offers to install the app
I see the install app button
I do not see the install app button
I click the install app button
the browser install prompt was shown
I see the iOS install hint {string}
I do not see the iOS install hint
I dismiss the iOS install hint
```

- `I request "METHOD /path"` uses Playwright `request` against the base URL; "JSON field" is a dotted path; the value is
  compared as `String(value)`. "the manifest ..." steps use the last response.
- "the browser offers to install the app" dispatches a synthetic `beforeinstallprompt` event whose `prompt()` sets
  `window.__installPromptShown = true` and whose `userChoice` resolves to `{ outcome: 'dismissed' }`.

## Performance (`@perf`)

```
I cycle through the month, week and day views {int} times
I open and close the event dialog {int} times
I expand and collapse the task list {string} {int} times
I go to the next period {int} times
I record the browser memory after garbage collection
the JS heap has grown by less than {int} percent since the recording
the DOM node count has grown by less than {int} percent since the recording
the event listener count has grown by less than {int} percent since the recording
there are no detached DOM nodes from closed dialogs
the app is hidden
I count requests to {string} for {int} seconds
at most {int} requests to {string} were counted
at least {int} requests to {string} were counted
the JavaScript downloaded for the first load is at most {int} KB compressed
the month view was rendered within {int} ms of navigation start
I run a phone performance audit of the app
the performance score is at least {int}
the server resident memory is below {int} MB
I send {int} warm-up requests to {string}
I send {int} requests to {string}
I send {int} requests to {string} the item {string} of the task list {string} alternating done and not done
I record the server memory after garbage collection
the server memory has grown by less than {int} MB since the recording
```

- `@perf` runs only in the `mobile` project (`desktop` uses `grepInvert: /@mobile|@perf/`), with `workers: 1`.
- Browser memory: Chromium DevTools protocol via `page.context().newCDPSession(page)`: `HeapProfiler.collectGarbage`
  (twice), then `Runtime.getHeapUsage` (`usedSize`) and `Memory.getDOMCounters` (`nodes`, `jsEventListeners`).
- "cycle through the month, week and day views N times": N × (switch to week, day, month) using the view switcher.
- "open and close the event dialog N times": `create-button` → Event → `event-cancel`, waiting for the dialog to be
  removed from the DOM each time. "expand and collapse": `tasklist-card` click → `tasklist-close`.
- "no detached DOM nodes from closed dialogs": after GC, take a heap snapshot (`HeapProfiler.takeHeapSnapshot`) and
  assert no `Detached` node whose `data-testid` starts with `event-dialog`, `tasklist-dialog`, `tasklist-expanded` or
  `confirm-dialog` is retained (count of detached `HTMLElement`s ≤ 50 overall).
- "the app is hidden": override `document.visibilityState`/`document.hidden` to `hidden` and dispatch
  `visibilitychange`; "the app regains focus" reverts it to `visible`.
- "count requests": listens to `page.on('request')` for URLs whose path starts with the given string, for N seconds.
- "JavaScript downloaded for the first load": sum of `transferSize` of `script` resource-timing entries (fresh context,
  no service worker yet) after `load` + 2 s idle; requires the server to send compressed responses.
- "rendered within N ms": `performance.now()` when the first `month-cell` is visible (measured by a `MutationObserver`
  init script), relative to navigation start.
- "phone performance audit": Lighthouse (mobile preset, simulated throttling) against the base URL; score = performance
  category × 100. Runs in the Playwright container on Chromium with `--remote-debugging-port`.
- "the server resident memory is below N MB": `rss` from the last `GET /api/__test/memory?gc=true` response.
- "send N requests to "METHOD /path"": sequential with concurrency 10 via Playwright `request`. The PATCH variant
  alternates `{done:true}` / `{done:false}` on `/api/tasklists/:id/items/:itemId`.
- "record the server memory" / "has grown": `GET /api/__test/memory?gc=true`, compares `rss`.

## Theme (`@theme`)

```
the device prefers a {scheme} color scheme
the device switches to a {scheme} color scheme
the app uses the {scheme} theme
the page theme color matches the {string} color role
the color roles {string} are defined
the period title has a contrast ratio of at least {float}
the event {string} has a text contrast ratio of at least {float}
pressing the create button shows a state layer
```

- Extra parameter types: `{scheme}` = `light|dark`; `{float}` built-in.
- Color scheme: `page.emulateMedia({ colorScheme })` (before or after load).
- "uses the X theme": `document.documentElement.dataset.theme === X`.
- Color role tokens are CSS custom properties `--md-sys-color-<role>` on `:root`; "defined" = non-empty computed value.
- "page theme color matches": `<meta name="theme-color">` content equals the computed `--md-sys-color-<role>` (hex,
  case-insensitive).
- Contrast: WCAG relative luminance of the computed `color` vs. the first non-transparent ancestor `background-color`.
- State layer: while the pointer is down on `create-button` (`mouse.down()`), the button carries
  `data-pressed="true"` and its state-layer element (`[data-state-layer]`) has a non-zero computed opacity.
