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
| `{view}`    | `year\|month\|week\|day`     |                                                |
| `{datelist}`| `\d{4}-\d{2}-\d{2}((, \| and )\d{4}-\d{2}-\d{2})*` | One or more dates: `A`, `A and B`, `A, B and C`. |
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
    `description`, `location`, `calendar` (calendar display name, e.g. `Personal`, `Work`), `color` (`Calendar color`
    or a Google color name, e.g. `Tomato`).
  - Task list fields: `title`, `date`, `time` (empty = no time), `items` (`; `-separated, typed as one item per line),
    `category` (category name or `No category`), `tags` (comma-separated text).
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
the calendar contains an event {string} on {date} from {time} to {time} at {string}
the calendar contains an event {string} in the calendar {string} on {date} from {time} to {time}
the calendar contains an event {string} from {date} {time} to {date} {time}
the calendar contains an all-day event {string} on {date}
the calendar contains an all-day event {string} from {date} to {date}
the calendar contains a task list {string} on {date} with items:
the calendar contains a task list {string} on {date} at {time} with items:
the calendar contains a task list {string} on {date} at {time} for {int} minutes with items:
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
the browser window is {int} by {int} pixels wide and high
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
I click empty space in the month cell of {date}
the entries on {date} fade out towards the bottom of the month cell
the month cell of {date} shows no overflow count
the month cell of {date} shows its first entry
the month cells stay unchanged for {int} seconds
I click the week header of {date}
I tap the day {date} in the month view
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
```

## Events: display

```
I see the event {string} on {date}
I see the event {string} on {weekday}
I see the event {string} on each day from {date} to {date}
I see the event {string} as a bar from {date} to {date}
the event {string} is a bar in lane {int}
I see the all-day event {string} on {date}
I do not see the event {string}
I do not see the event {string} on {date}
the event {string} shows the time {string}
the event {string} is positioned from {time} to {time}
the event {string} is positioned on {date} from {time} to {time}
the events {string} and {string} do not overlap
the event {string} shows the location {string}
the title of the event {string} is not covered
the events {string} and {string} are side by side
the event {string} is stacked on the event {string}
the event {string} spans the full width of its day column
the event {string} has the color {string}
the items on {date} are shown in the order {string}
```

- "on each day" and "on {date}" accept a chip on that date or a multi-day bar covering it; "as a bar" checks one
  `event-bar` segment with `data-start`/`data-end` (clipped to the week row); "lane" checks `data-lane`.
- "positioned" checks `data-start-time`/`data-end-time` of the chip segment and that its top/height match the time
  grid (`data-hour-height` on `time-grid`) within ±3 px.
- "do not overlap": bounding boxes do not intersect. "side by side": both have a top within the other's vertical span
  and different left edges. "stacked on": the first chip starts lower and further right than the second, boxes overlap
  vertically (cascade, A-64). "spans the full width": chip width ≥ 90 % of its day column width.
- "the items on D are shown in the order": DOM order of `data-title` of event chips and task list cards inside the
  month cell of D.

## Events: dialog

```
I start creating an event
I click the time slot {time} on {date}
I fill in the event form with:
I press Enter in the event field {string}
the event field {string} has focus
I save the event
I cancel the event dialog
I press Escape
I open the event {string}
I delete the event
I confirm the deletion
I cancel the deletion
I undo the deletion
the undo time is over
the snackbar says {string}
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
I switch the new dialog to {string}
I fill in the task list form with:
I press Enter in the task list field {string}
the task list field {string} has focus
I save the task list
I cancel the task list dialog
the task list dialog is open
the task list dialog is closed
the task list dialog shows the error {string}
the task list form shows:
I see the task list {string} on {date}
I do not see the task list {string}
the task list {string} shows the done count {string}
the task list {string} shows the item {string} below its title
the task list {string} shows the item {string} next to its title
the task list {string} does not show the item {string}
the task list {string} shows its title without overlap
the title of the task list {string} is not covered
the items of the task list {string} fade out towards the bottom
the task list {string} shows no overflow count
the collapsed task list {string} lists the items {string}
the collapsed task list {string} shows {string}
the task list {string} is positioned at {time}
the task list {string} is shown in the all-day area on {date}
I expand the task list {string}
I collapse the task list
the task list {string} is expanded
the task list {string} is collapsed
no task list is expanded
the expanded task list items are {string}
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
I edit the task list details
I delete the task list
I tap the task list {string}
I tap the expanded task list {string}
I tap the item {string} of the expanded task list
I note where the event {string} is
the event {string} has not moved
the expanded task list overlaps the event {string}
the expanded task list has the left and width of the card {string}
the task list card {string} is narrower than its day column
the expanded task list has the left and width of the day column of {string}
the expanded task list is only as wide as its content needs, within the day column of {string}
the expanded task list is narrower than the day column of {string}
the expanded task list has no scrollbars and no sideways overflow
the expanded task list is as tall as its content
the expanded task list has no time extension
the month view shows no time blocks
I tap the title of the expanded task list
no list sheet is open
the expanded task list has its first item below the header
the expanded task list keeps its offset to the card {string} when the grid scrolls by {int} px
the expanded task list shows the full title {string}
the expanded task list shows the real time block of the card {string} and a slimmer extension starting at its end
the task list card {string} is still the one-row inline card of its time block
the task list {string} opens as the list sheet
I tap outside the expanded task list
I note where the task list cards are
the task list cards have not moved
the task list {string} is expanded over the calendar
the expanded task list shows the item {string} as done and the item {string} as open
the expanded task list has no checkboxes
the focus is inside the expanded task list
the card of the task list {string} has the focus
the card of the task list {string} says it is expanded
the card of the task list {string} says it is collapsed
I zoom the time grid in
I zoom the time grid out
I zoom the time grid in on the lower edge of the grown card
I zoom the time grid in far from the grown card
the real time block of the expanded task list matches the card {string}
```

"the task list X shows the done count" checks the expanded header if X is expanded, else the collapsed card.
"the task list X shows the item Y below / next to its title": the `tasklist-card-item` with `data-title` Y in X's
collapsed card is visible and its box lies inside the card (an ellipsised name counts); "below" = its top
is at or under the bottom of `tasklist-card-title`, "next to" = it shares the title's line. "does not show the item Y": the
`tasklist-card-item` Y of X is not visible (it stays in the DOM for screen readers).
"the task list X shows its title without overlap": X's `tasklist-card-title` is visible and its box intersects no other
visible text part of the card (`tasklist-card-time`, `tasklist-card-items`, `tasklist-card-count`).
"for N minutes" sets the task list's estimate to N (a timed task list lasts its estimate).
Item steps act on the currently expanded task list.
Expanded card (`tasklists-expand.feature`; ARCHITECTURE "Expanded task list card"): "I expand the task list X" opens the list
sheet: it taps the card, waits for the grown card (`tasklist-expanded` with `data-presentation="overlay"`), taps it and waits
for the sheet. "I tap the task list X" is only the first tap; "I tap the expanded task list X" taps the grown card
(`tasklist-card-grown`), "the item I of the expanded task list" an item row (`tasklist-card-item`) of it. "opens as the list
sheet": a `tasklist-expanded` that is not the overlay is visible and the overlay is gone. "I tap outside the expanded task
list" clicks a point of the viewport outside it and not on a button, link or field. "I note where the task list cards are" /
"the event X" record the boxes of the `tasklist-card`s / the event chip; "have not moved" compares them (within 1 px) after
the expansion. "is expanded over the calendar": the overlay is visible, the collapsed card has `aria-expanded="true"` and
the overlay is the top element at its own centre. "has the left and width of the card X": the grown card's box equals the
collapsed card's left and width within 2 px (month); "of the day column of X": the grown card spans its time grid column (inside the border, 2 px), over side-by-side neighbours. "as tall as its content": the grown month card ends within 12 px below its last item; "has no time extension": no `tasklist-grown-ext` layer. "the month view shows no time blocks": no `.block` item and no zoom timeline in the month view. "keeps its offset ... scrolls": after setting the grid's `scrollTop` in the same task, the grown card is still at the same offset to the collapsed card (it scrolls natively). A tap on the title row collapses, a tap on the item area opens the sheet (taps use `tasklist-card-items`). "I zoom the time grid in / out": one Ctrl+wheel gesture on the time grid scroller (deltaY -300 / +300), then wait until `data-hour-height` changed and the gesture settled. "the real time block of the expanded task list matches the card X": `tasklist-grown-real` has the collapsed card's top and height within 2 px, and there is only one visible grown card. "only as wide as its content needs, within the day column of X": the grown card is at least as wide as the collapsed card, inside the day column (2 px), and either its width is within 6 px of the larger of its content's natural width and the collapsed card's width (the widest `tasklist-card-title`/`tasklist-card-item` at `white-space: nowrap`, measured on a clone, plus the card padding) or, when the content is wider, equals the column width. "narrower than the day column of X": its width is at least 20 px less than the column. "overlaps the event X": the grown card reaches vertically into the event's time span; where they also overlap horizontally, the grown card is the
collapsed card's left and width within 2 px (month); "of the day column of X": the grown card spans its time grid column (inside the border, 2 px), over side-by-side neighbours. "as tall as its content": the grown month card ends within 12 px below its last item; "has no time extension": no `tasklist-grown-ext` layer. "the month view shows no time blocks": no `.block` item and no zoom timeline in the month view. "keeps its offset ... scrolls": after setting the grid's `scrollTop` in the same task, the grown card is still at the same offset to the collapsed card (it scrolls natively). A tap on the title row collapses, a tap on the item area opens the sheet (taps use `tasklist-card-items`). "I zoom the time grid in on the lower edge of the grown card": the same gesture centred on the bottom of the grown card (the collapsed card's time moves up, the grown card stays in view); "... far from the grown card": centred on the scroller's top, so the card's time leaves the screen. "I zoom the time grid in / out": one Ctrl+wheel gesture on the time grid scroller (deltaY -300 / +300), then wait until `data-hour-height` changed and the gesture settled. "the real time block of the expanded task list matches the card X": `tasklist-grown-real` has the collapsed card's top and height within 2 px, and there is only one visible grown card. "overlaps the event X": the grown card reaches into the event's box and is the
top element there. "shows the full title": `tasklist-card-title` of the grown card has the whole text, is not clipped
(`scrollWidth <= clientWidth`) and lies inside the card. "shows the real time block ... and a slimmer extension": the grown card's `tasklist-grown-real` layer has the height of the collapsed card (2 px), `tasklist-grown-ext` starts at its end (2 px, below it) and is narrower; "is still the one-row inline card of its time block": the
collapsed card has `data-fit="inline"` and the height of its time block (parent box, 2 px). "shows the item I as done and J as
open": `tasklist-card-item` `data-done` true / false in the overlay; "has no checkboxes": no input, checkbox, edit or close
button inside it. "the focus is inside" / "the card has the focus": `document.activeElement` is within the overlay / is the
collapsed card button.

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
I start swiping left on the calendar by a quarter of the width
I start swiping left on the calendar by half the width
the week of {date} is shown beside the current one
I let go
I pinch out on the time grid to twice the size
one hour of the time grid is about twice as tall as before
one hour of the time grid is still about twice as tall as at the start
the task list {string} is drawn a quarter as tall as the event {string}
the viewport meta tag contains {string}
the bottom bar reserves the safe-area inset at the bottom
```

- No horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
- "at the bottom of the screen": element's bottom edge is within the lowest 120 px of the viewport.
- Swipes dispatch `touchstart`/`touchmove`/`touchend` on `calendar-swipe-area` (CDP `Input.dispatchTouchEvent`):
  horizontal 200 px over 150 ms for left/right; vertical 300 px for up.
- "start swiping … by a quarter/half of the width": touchstart + slow touchmoves (≥ 400 ms, so no flick) to that
  fraction of `calendar-swipe-area`'s width, finger kept down; "I let go" sends touchend. "shown beside": a
  `swipe-neighbour` element with `data-period-start` = that date is visible and sits right of the current view.
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
the settings offer to install the app
the settings do not offer to install the app
I open the install instructions in the settings
the install instructions show the steps {string}
I close the install instructions
the install instructions are closed
```

- Settings install row (iOS, owner 2026-10-14): `settings-install-app` (row button, only on iOS and not installed) opens
  `ios-install-sheet` with the ordered steps `ios-install-step`; `ios-install-close` closes it. "the install
  instructions show the steps" compares the comma-separated step texts with the `ios-install-step` texts in order.

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
I run a phone performance audit of the app {int} times
the median performance score is at least {int}
I request {string} on a fresh server
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
  category × 100, run N times one after the other; the scenario judges the median (A-159). Runs in the Playwright container on Chromium with `--remote-debugging-port`.
- "I request "METHOD /path" on a fresh server": starts its own server process (`node --expose-gc server/dist/index.js`, the
  same `TEST_MODE` env as `e2e/run.sh`: `PROVIDER=mock`, `SEED=false`, `POLL_INTERVAL_MS=30000`, `NODE_ENV=production`, but a free
  loopback port and an empty temporary `DATA_DIR`), waits for `GET /api/health`, performs the request there (stored as the
  last response like `I request {string}`), then stops the process and deletes its data directory (A-102).
- "the server resident memory is below N MB": `rss` from the last response, here the `GET /api/__test/memory?gc=true`
  response of the fresh server.
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
the event {string} is filled with its color
the task list {string} is filled with its color
the task list {string} has a text contrast ratio of at least {float}
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

## Settings (`@settings`)

```
I open the settings
the settings sections are {string}
the settings page has no theme mode or seed colour controls
the server reports the build version {string}
the settings show the version {string}
the corner shows the version {string}
the settings screen is shown
I leave the settings
I choose the theme mode {string}
the theme mode {string} is selected
I choose the seed color preset {string}
I enter the custom seed color {string}
the seed color {string} is selected
the custom seed color field shows the error {string}
the color role {string} has a hue within {int} degrees of {string}
I choose {string} as the default view
the default view {string} is selected
I choose {string} as the default event color
the default event color {string} is selected
I switch to another device
the settings are changed elsewhere to the theme mode {string}
```

- `I open the settings` clicks `settings-button` in the top app bar; `I leave the settings` clicks `settings-back`
  (returns to the previous calendar URL, or `/` if none).
- Every "I choose ..." / "I enter ..." step waits for the `PUT /api/settings` response (status 200) before continuing,
  except the seed colour steps (`I choose the seed color preset`, `I enter the custom seed color`): the seed colour is
  fine-tuning of the chosen theme, so these wait for the `PATCH /api/prefs/theme` response (status 200) instead
  (ARCHITECTURE "Themes", owner 2026-10-13). A rejected custom color does not send a request.
- Theme modes are the labels `System`, `Light`, `Dark`. Seed presets are the labels `Blue`, `Purple`, `Teal`, `Green`,
  `Orange`, `Red`, `Pink`, `Slate`; a custom color is shown as `Custom`.
- Hue check: computes the HCT hue (Material color science) of the computed `--md-sys-color-<role>` and of the hex value
  and compares the circular difference (implementations may import the reference color utilities in the test code).
- `I switch to another device` creates a new browser context with the same project options (no shared storage) and
  a new page; all following steps act on it.
- `the settings are changed elsewhere to ...` sends `PATCH /api/settings` directly through the API.

## Language (`@i18n`)

```
the browser language is {string}
the view switcher shows {string}
the page language is {string}
I choose {string} as the language
the language {string} is selected
the page was not reloaded
```

- `the browser language is "de-DE"` (Given) makes `navigator.language` / `navigator.languages` report that language
  for every page of the current context, with a context init script (a Playwright context's `locale` cannot change after
  creation). The context option `locale: 'en-GB'` stays, so numbers and `Intl` defaults are unaffected. Steps that open
  "another device" create a fresh context with the project locale, i.e. an English browser.
- `the view switcher shows "A, B, C, D"` compares the texts of the `tab`s inside `view-switcher` (bottom bar or rail,
  in DOM order, joined with `", "`). With Labs on, the experimental views are part of the list.
- `the page language is X` = the `lang` attribute of `<html>` (`en`, `de`, `de-x-mainfr`, `de-x-coldmir`).
- `I choose "L" as the language` selects the option labelled L in `settings-language` (a select) and waits for the
  `PATCH /api/prefs` response (status 200) when the value changes. Before choosing it sets a marker on `window`, which
  `the page was not reloaded` looks for (a reload would lose it); the options are `Automatisch`/`Automatic` (follows
  the device, translated), `English`, `Deutsch`, `Fränggisch`, `Coldmirror` (each in its own name, never translated).
- `the language "L" is selected` = the selected option label of `settings-language`.
- The existing `the settings sections are`, `the period title is` and `the weekday headers are` steps are reused.

## Categories, tags and filters (`@categories`)

```
the calendar contains a task list {string} in the category {string} on {date}
the calendar contains a task list {string} in the category {string} with the tags {string} on {date}
I add the category {string} with the color {string} and the icon {string}
I add the category {string} with the color {string}
I rename the category {string} to {string}
I change the color of the category {string} to {string}
I delete the category {string}
the categories are {string}
the category {string} has the color {string}
the category dialog shows the error {string}
the task list {string} has the color {string}
the task list {string} shows the icon {string}
the task list {string} shows no icon
the Google event for the task list {string} has the color ID {string}
the Google event for the task list {string} has no color ID
I show the filters
I filter by the category {string}
I filter by the tag {string}
I clear the filters
the category filter {string} is selected
the tag filters are {string}
the URL query is {string}
```

- Category fixtures create an empty task list (no items) via `POST /api/tasklists` with `categoryId` resolved by name
  from `GET /api/settings`. Tags are comma-separated.
- Category steps act in the Settings screen: add = `settings-category-add` → `category-dialog` → fill `category-name`,
  `category-color` (hex text field), optional `category-icon` → `category-save`. Rename/recolor open the category
  (`settings-category` with `data-name`) and save. Delete = open → `category-delete` (then the confirm steps).
- "the categories are" = `data-name` of `settings-category` elements in DOM order.
- "the task list X has the color" = `data-color` on its `tasklist-card` (lowercase hex). "shows the icon" = text of
  `tasklist-card-icon`; "shows no icon" = no such element.
- "stores the tags" parses `extendedProperties.private.tags` (JSON array) and compares it joined with `, `.
- Filters: `I show the filters` clicks `filter-button` if `filter-bar` is not visible. "filter by" clicks the chip
  `filter-chip-category` / `filter-chip-tag` with that `data-name` (toggles it). `I clear the filters` clicks
  `filter-clear`. "is selected" = `aria-pressed="true"`. "the tag filters are" = `data-name` of all
  `filter-chip-tag` in DOM order.
- "the URL query is" compares `location.search` without the leading `?` (`""` = no query).

### Task categories switch (`@categories`; setting `settings-task-categories`, pref `taskCategories`)

```
I turn the task categories {string}
the settings page shows no categories
the Tasks view offers no category filter, grouping or sorting
I open the new task list dialog in the Tasks view
the task list dialog has no category field
the task lists {string} and {string} have the same color
I retitle the task list {string} to {string} in the Tasks view
```

- "I turn the task categories on/off": clicks `settings-task-categories` (Settings screen is open) when its `aria-checked`
  differs and waits for the `PATCH /api/prefs` response (200).
- "the settings page shows no categories": no `settings-category` and no `settings-category-add`.
- "offers no category filter, grouping or sorting": opens the Tasks view; its filter sheet has no `tasks-filter-category`,
  `tasks-group-by` has no "Category" button and `tasks-sort-by` does not offer "Category".
- "I open the new task list dialog in the Tasks view": opens the Tasks view and clicks `create-button` (which opens the dialog there).
- "the task list dialog has no category field": `tasklist-category` is absent from the open `tasklist-dialog`.
- "the task lists A and B have the same color": equal `data-color` on their `tasklist-card`s.
- "I retitle ...": opens the list's dialog from its title in the Tasks view, replaces the title and saves.

## Event colors (`@colors`)

```
the event color options are {string}
the Google event {string} has no color ID
Google sets the color ID of the event {string} to {string}
```

- Options = labels of the `event-color` picker options in DOM order.

## Clock and time (`@timeline`, `@adhd`)

```
the time is {date} {time} and the clock is running
{int} minutes pass
```

- `the time is D T and the clock is running`: `POST /api/__test/clock { now, frozen: false }` **and** install a fake
  browser clock at the same instant before the page opens (Playwright `page.clock.install({ time })`), so app timers
  only advance when the test says so.
- `N minutes pass`: `page.clock.runFor(N * 60_000)` and `POST /api/__test/clock { now: previous + N min, frozen: false }`
  so server and browser stay in step.

## Timeline and Now card

```
the event {string} is about {int} times as tall as the event {string}
the event {string} is at least {int} pixels tall
the now marker is positioned at {time}
the now marker is in the column of {date}
I do not see the now marker
the now marker is visible on screen
the time grid is scrolled to show {time} at the top
the now card shows the line {string}
the now card does not show a current event
the current event progress is {int} percent
the now card stayed in place
I see the transition warning {string}
I do not see a transition warning
I dismiss the transition warning
```

- "about N times as tall": height ratio within ±10 %. Heights are measured from bounding boxes.
- `now-marker` has `data-time="HH:mm"`; "positioned at" checks it and its top against the time grid (±3 px).
- "visible on screen": its bounding box is inside the viewport. "scrolled to show T at the top": the scroll position of
  `time-grid` equals T × hour height (±1 hour height / 4).
- Now card lines are the texts of `now-card-line` elements (exact match of one of them). "does not show a current
  event" = no `now-card-current`. Progress = `aria-valuenow` of `now-progress` (integer percent).

## Open tasks tray (`@opentasks`)

```
the open tasks tray shows the count {string}
I open the open tasks tray
the open tasks tray is collapsed
the open tasks tray lists {string}
the open tasks tray does not list {string}
the open tasks tray shows the task list {string} with items:
I tick the item {string} in the open tasks tray
I untick the item {string} in the open tasks tray
the item {string} of the task list {string} was ticked on {date}
the open tasks tray shows all {int} items of the task list {string}
I unfold the task list {string} in the open tasks tray
the create button does not cover any control of the open tasks tray
the task list {string} in the open tasks tray is struck through and shows only its title
I add the item {string} to {string} in the open tasks tray
I edit the details of {string} in the open tasks tray
the open tasks tray shows the message {string} for {string}
the task list {string} is shown as carried over from {string}
I hide where carried-over task lists come from in the settings
the task list {string} is not flagged as overdue
the overdue label of {string} does not use the error color
```

- "I hide where carried-over task lists come from in the settings": settings → `settings-carried-from` off (waiting for
  the prefs `PATCH`) → back.
- "shown as carried over from D": `tasklist-card-overdue` of the card is visible and its accessible name is
  "From D" (the text itself in roomy cards, the `aria-label` of the badge in narrow ones).
- "does not use the error color": the computed `color` and `background-color` of `tasklist-card-overdue` differ from
  `--md-sys-color-error` and `--md-sys-color-error-container`.
- "the open tasks tray shows the message M for L": within 1 500 ms of the previous step, the tray row of L shows M
  (it may fold away afterwards, as finished lists do).

## Year view and month picker (`@year`, `@picker`)

```
I open the year view for {int}
the year view shows {int} months
the density of {date} in the year view is {int}
I click the month {string} in the year view
the year view's {string} shows no circle for days of other months
I open the month picker
the month picker is open
the month picker is closed
the month picker shows {string}
I go to the next month in the month picker
I go to the previous month in the month picker
I swipe left in the month picker
I swipe right in the month picker
I pick {date} in the month picker
{date} is selected in the month picker
{date} is marked as having items in the month picker
{date} is not marked as having items in the month picker
I drag up and down inside the month picker
the page is not scrolled
the bottom bar ends at the bottom of the viewport
```

- "the year view's M shows no circle for days of other months": the `year-month` tile of month M has at least one
  `year-day-out` cell (a leading or trailing day of a neighbouring month, `aria-hidden`), and every one of them has no
  `data-density`, no text, a transparent background and no box shadow. The cells stay in the grid (alignment).
- `I open the month picker` clicks `period-title` (it toggles the picker).
- Density = `data-density` of `year-day[data-date]`. "selected" = `aria-selected="true"` on `picker-day`; "marked" =
  `data-has-items="true"`.
- "I drag up and down inside the month picker": touch drag of 150 px up, then 150 px down, over the picker's grid
  (CDP touch events; falls back to a mouse wheel on non-touch projects).
- "the page is not scrolled": `document.scrollingElement.scrollTop === 0` and `scrollHeight <= innerHeight`.
- "the bottom bar ends at the bottom of the viewport": `bottom-bar` bottom edge equals `innerHeight` (±1 px).

## ADHD support, settings additions

```
I choose {string} as the transition warning time
I turn on calm mode
calm mode is active
the collapsed task list {string} does not list its items
the task list {string} shows the estimate {string}
I choose the animation level {string}
the animation level {string} is selected
the animation level is {string}
the sounds setting is off
the device prefers reduced motion
```

- Task list form gains `estimate` (minutes, empty = none) and `repeat` (`Never`, `Daily`, `Weekly`, `Monthly`; `@optional`).
- `the animation level is X` (Given) sets it through `PATCH /api/settings`.
- `calm mode is active`: `document.documentElement.dataset.calm === "true"`.
- `the device prefers reduced motion`: `page.emulateMedia({ reducedMotion: 'reduce' })`.

## Reward effects (`@reward`)

```
a {string} effect appears and is removed within {int} ms
no reward effect appears
no {string} effect appears
there are no reward effect elements left
the progress ring of the task list {string} shows {int} percent
the expanded task list shows the message {string}
I quickly tick the items {string}
the event dialog opened with an animation
the event dialog opened without an animation
I tick and untick the item {string} {int} times
at most {int} app timers are active
the page does not contain the words {string}
```

- Effects are elements `[data-testid="reward-effect"][data-kind="<kind>"]`, kinds: `tick`, `list-complete`, `drop`,
  `streak`, `water`, `grow`, `perk-up`, `bloom`, `butterfly`. "appears and is removed within N ms": a `MutationObserver` init script records
  insertion and removal times; the step waits until it was inserted (default timeout) and asserts removal ≤ N ms after
  insertion.
- "no reward effect appears": no effect of kind `tick`, `list-complete` or `drop` is inserted during the 1 500 ms after
  the previous step. "no X effect appears": same for one kind, observed from page load.
- "there are no reward effect elements left": count of `reward-effect` is 0 after 1 500 ms of idle.
- Progress ring: `aria-valuenow` of `tasklist-progress-ring` in the expanded list (rounded integer percent).
- "quickly tick": clicks each checkbox without waiting for responses or effects.
- "opened with an animation": immediately after open, `dialog.getAnimations({ subtree: true }).length > 0`;
  "without" = 0.
- "at most N app timers are active": reads `window.__appTimers` (a test-mode-only counter maintained by the app's
  timer helper; ARCHITECTURE §5a).
- "the page does not contain the words": case-insensitive whole-word search in `document.body.innerText`; the list is
  comma-separated.

## Drag and drop (`@dnd`)

```
I drag the event {string} to {date} at {time}
I hold the event {string} at the bottom edge of the time grid for {int} ms
I move the dragged event to the middle of the time grid
I scroll the mouse wheel up by {int} pixels while dragging
the dragged event is drawn on the drop indicator
I drop the dragged event
the event {string} starts at the time the drop indicator showed
I drag the event {string} to {date}
I drag the event {string} down by {int} minutes
I drag the task list {string} to {date}
I drag the task list {string} to {date} at {time}
I drag the event {string} back and forth {int} times
I pick up the event {string}
I release the event without moving it
the event {string} is lifted
the event {string} is not lifted
a haptic tick was requested
the event {string} shows resize handles in the day view for {date}
the event {string} shows resize handles in the week view for {date}
the task list {string} shows resize handles in the day view for {date}
I drag the bottom handle of {string} down by {int} minutes
I drag the bottom handle of {string} up by {int} minutes
I drag the top handle of {string} up by {int} minutes
the event {string} shows resize handles
the event {string} shows no resize handles
```

- Desktop project: mouse (`mouse.down` on the chip centre, move in 10 steps to the target, `mouse.up`). The target is
  the `time-slot` of the date/hour plus the minute offset (quarter-hour precision), or the `month-cell` /
  `week-allday-cell` of the date.
- Mobile project: CDP touch events: `touchStart`, hold 500 ms (long press), `touchMove` in 10 steps, `touchEnd`.
- After a drop the step waits for the `PATCH` response (or failure) and for the chip to settle (`data-dragging` absent).
- "lifted": `data-dragging="true"` on the chip (the app sets it on pick-up). "pick up" = press and hold 500 ms without
  moving; "release without moving" = mouse up / touch end.
- "haptic tick": an init script wraps `navigator.vibrate` and records calls; at least one call with a duration ≤ 30 ms.
- "back and forth N times": N moves of +1 day and −1 day alternately (each persisted).
- "X shows resize handles in the day/week view for D" (Given): opens that view, picks X up and releases it without
  moving, then checks the handles are shown. "shows resize handles" = both `resize-handle-top` and
  `resize-handle-bottom` of X are visible; "shows no resize handles" = neither is.
- "I drag the top/bottom handle of X up/down by N minutes": press on the handle centre (mouse; touch without the
  long press) and move N minutes of grid height in 10 steps, release; then wait for the save as after a drop.

## Streak and plant (`@streak`, `@plant`)

```
I checked in on {datelist}
the streak shows {int}
I see the streak message {string}
I do not see a streak message
the best streak in settings is {int}
the plant has {int} growth points and was last watered on {date}
I see the plant
I do not see the plant
I see the streak flame
I do not see the streak flame
the plant is at the stage {string}
the plant looks {string}
I open the plant card
the plant card shows the stage {string}
the plant card shows {string}
```

- `I checked in on ...` → `POST /api/__test/motivation { checkIns: [dates] }` (replaces check-in history).
- `the plant has N growth points and was last watered on D` → `POST /api/__test/motivation { plant: { growth: N,
  lastWatered: D, todayPoints: 0 } }`.
- Streak: `streak-flame` text content = count; message = `streak-message` (toast, auto-hides after 4 s).
- Plant: `plant-button` (`data-stage`, `data-mood`); card `plant-card`, `plant-card-stage`, `plant-card-line`.

```
I turn the streak flame {string}
I turn the plant {string}
I choose {string} for the sunflowers
the scene is {string}
the sunflowers are set to {string}
the sunflowers setting is active
the sunflowers setting is inactive
the sunflowers hint says {string}
I see the sunflower field
I do not see the sunflower field
the sunflower field shows {int} flower(s)
the sunflower field is labelled {string}
the sunflowers are swaying
the sunflowers are not swaying
the sunflowers look {string}
```

- `I turn the streak flame "on|off"` toggles the `settings-streak-flame` switch to that state; `I turn the plant
  "on|off"` does the same for the `settings-plant` switch. `I choose X for the sunflowers` picks the option with that
  label in `settings-sunflowers` (`Grow with points` = `grow`, `Full field` = `full`); `the sunflowers are set to X`
  (Given) does it with `PATCH /api/settings { sunflowers }`. `the scene is X` (Given) sets the person's scene with
  `PATCH /api/prefs/theme { overrides: { scene } }`; X is `Sunflower field`, `Mordor` or `None`.
- `the sunflowers setting is inactive`: `settings-sunflowers` is shown but its options are disabled, and the hint
  `settings-sunflowers-hint` is shown; `active`: the options are enabled and there is no hint. The setting stays
  global and is only inactive (not hidden) while the person's scene is not the Sunflower field.
- `sunflower-field` (in the top app bar background) has `aria-label` = the label and contains one `sunflower` element
  per **visible** flower ("shows N flowers" counts them). Swaying = computed `animation-name` of `sunflower` is not
  `none` and `animation-play-state` is `running`. "look X" = `data-mood` on `sunflower-field`.
- Kinds `bloom` (a new sunflower) is added to the reward effect kinds.

## Signing in (`@signin`)

```
{string} and {string} may use the calendar
{string} has an event {string} on {date} from {time} to {time}
{string} signs in with Google
{string} is signed in
Google no longer accepts the access of {string}
their session expires
someone opens the week view for {date} without signing in
they sign out in the settings
they open the week view for {date}
they see the week view for {date}
they see the event {string} on {date}
they do not see the event {string}
they are told the calendar is private
they see no events
they see the sign-in page
opening the week view for {date} shows the sign-in page
the calendar data cannot be read without signing in
they are asked to sign in with Google again
Google's consent screen is answered without calendar access
they are told Google Calendar access is missing
the settings offer to grant calendar access
they grant calendar access
they are no longer told Google Calendar access is missing
{string} signs in with Google from the app
{string} signed in with Google from the app
the system browser is not signed in
the app is handed a one-time code
the app exchanges the code
the app exchanges the code again
the app is asked to sign in again
```

- Google is the mock provider with one calendar per person (`TEST_MODE`); "signs in with Google" completes the OAuth
  round trip through the test double, no real Google. "they" is the person of the last sign-in step.
- "may use the calendar": the allow-list of sign-in addresses for the scenario.
- "cannot be read without signing in": a request to the events API without a session is refused as unauthenticated.
- "their session expires": the browser loses the session cookie (all cookies of the page's context are cleared), so the
  next request is refused as unauthenticated; a page that is already open keeps its old state (the stale shell).
- "Google no longer accepts the access": the test double answers that person's token refresh with `invalid_grant`.
- "answered without calendar access": the fake consent screen returns a token whose `scope` lacks the calendar scope
  (the person left Google's "Google Calendar" checkbox unticked). "told ... is missing": the banner
  `calendar-access-banner` with the button `calendar-access-grant` is visible. "the settings offer": Settings -> Account &
  data shows `settings-calendar-access`. "they grant calendar access": the second consent screen is answered WITH the
  calendar and the banner button is pressed; the round trip returns to the calendar.
- "is filled with its color": the chip's computed background colour equals its `data-color` (the item colour as given, in
  both themes); its text is white or black, whichever contrasts more.

## All calendars (`@calendars`)

```
{string} has the calendar {string} and the shared calendar {string}
the calendar {string} has an event {string} on {date} from {time} to {time}
the event {string} has the color of the calendar {string}
they hide the calendar {string} in the filter bar
{string} hid the calendar {string}
{string} opens the week view for {date} on another device
```

- Calendars live in the person's mock Google account (TEST_MODE); "the shared calendar" is shared with them
  (not their primary). "has the color of the calendar": the event chip's `data-color` equals that calendar's colour.
- "hid the calendar" signs the person in and hides it through the app. "on another device" is a fresh browser context
  signed in as the same person.
- "fade out towards the bottom" (month cell / task list card): the entries' container is clipped with a gradient mask
  (`mask-image`/`-webkit-mask-image` not `none`) that ends transparent at the bottom, and at least one entry reaches
  into the faded band. "shows no overflow count": no `+N` / `+k more` text and no `month-cell-more` /
  `tasklist-card-more` element.
- "shows its first entry": the `month-cell-entries` box is at least 16 px tall and its first entry starts inside it, above
  the faded band (a cell whose bars or measuring leave the entries no room looks empty).
- "stay unchanged for N seconds": a `MutationObserver` on `month-view` sees no childList change and no real change of a
  `data-*` attribute (`data-tier`, `data-fit`, `data-fade`) for N seconds: layout tiers settle instead of flipping.
- "the browser window is W by H pixels wide and high" resizes the viewport (use before opening a view).

## Birthdays (`@birthdays`)

```
the Birthdays calendar has a birthday {string} on {date}
the Birthdays calendar has an anniversary {string} on {date}
the event {string} is marked as a birthday
the event {string} is marked as an anniversary
the event {string} is not marked as a birthday
the event dialog is read-only
the event dialog has no save or delete button
```

- "the Birthdays calendar has ...": adds Google's contacts calendar (`addressbook#contacts@group.v.calendar.google.com`,
  read-only, colour `#9fc6e7`) on first use and inserts a yearly all-day entry with `eventType` birthday and
  `birthdayProperties.type` birthday / anniversary, as Google makes it from a contact.
- "is marked as a birthday / an anniversary": the first visible chip of the event has `data-special` birthday /
  anniversary and a marker (`event-marker`) 🎂 / 💍; "is not marked": no `data-special` and no marker.
- "the event dialog is read-only": the details view (`event-readonly`) is shown instead of the form; "no save or delete
  button": neither `event-save` nor `event-delete` exists.

## Reduced motion override

```
the settings say the device asks for less motion
I allow full animations despite the device setting
```

- The hint is `settings-system-reduced-motion` (shown only while `prefers-reduced-motion: reduce`); the switch is
  `settings-ignore-system-motion`. With it on, the app's own animation level applies; off (default) the system caps
  it at Reduced as before. Kept per person.
- "shows the location": the event chip's `event-chip-location` is visible with that text (it may be ellipsised at the
  end only when the block is narrower than the text).

## Labs (`@labs`)

```
I turn on experimental views in the settings
the view switcher offers the experimental views {string}
the view switcher does not offer {string}
I switch the Labs view {string} on in the settings
I switch the Labs view {string} off in the settings
I open the clock view for {date}
the event {string} is an arc from {time} to {time}
the clock hand points at {time}
the task list {string} is an arc from {time} to {time}
the clock lists {string} without a time
the clock fills the available space
the arc of {string} is labelled {string}
the arc of {string} is not covered by the arc of {string}
I tap the arc of {string}
I turn the arc of {string} to {time}
I select the arc of {string}
I drag the start handle of {string} to {time}
I drag the end handle of {string} to {time}
I tap the clock at {time}
the middle of the clock says {string}
the clock shades the time until {time}
the clock shows the all-day event {string}
the approach bar is on
the approaching track is off
I set the approaching window to {int} hours in the settings
I switch off the Approaching card in the settings
I do not see the Approaching card
the approach bar shows {string} in {int} minutes
{string} is closer to now on the approach bar
I turn on the approach bar and open the week view for {date}
the approach bar shows {string}, {string} and {string} in this order
the approach bar shows {string} at its end
the approach bar is on with a window of {int} hours
the approach bar shows {string} and {string}
the approach bar shows {int} entries
on the approach bar {string} is {int} times as long as {string}
the title of {string} is shown next to its block
on the approach bar {string} starts at now and shows {int} minutes
I open the timeline view
{string} comes before {string} on the timeline
the now marker is before {string} on the timeline
on the timeline {string} is farther from {string} than {string} is from the now marker
on the timeline {string} is about {int} times as long as {string}
{string} is in the all-day band above the timed entries
the timeline runs from top to bottom
the title of {string} on the timeline reads left to right in one line
I open the strip view for {date}
I see the event {string} in the strip column of {date}
I scroll the strip one day to the right
the strip column of {date} is in front
the page did not reload
in the strip {string} is about {int} times as tall as {string}
{string} is in the strip's all-day band
the hour lines of the strip columns of {date} and {date} are at the same height
the all-day bands of the strip columns of {date} and {date} are equally tall
I open the zoom month for {date}
the zoom month shows {string}
the zoom month shows the whole month
the zoom month cell of {date} has {int} entries
the zoom month shows no start times
I zoom the zoom month in until the start times show
I zoom the zoom month in until the task list items show
I zoom the zoom month in to the largest zoom
the title of the task list {string} is on top in the zoom month
{string} is drawn lower than {string} in the zoom month
the zoom month heights of {string} and {string} are proportional to their durations
{string} shows its start time {string} in the zoom month
the task list {string} shows the item {string} in the zoom month
I press the zoom in button of the zoom month
I press the zoom out button of the zoom month
the zoom month is zoomed in
I zoom the zoom month in with Ctrl+wheel
I tap the day number {date} in the zoom month
I open the horizontal view for {date}
I open the horizontal day view for {date}
I zoom the horizontal view in days to the maximum
the horizontal view shows between {int} and {int} days on screen
I note the scroll position of the horizontal view
I drag the horizontal view sideways with a finger
the horizontal view has panned
the horizontal view shows {int} day rows
in the horizontal view {string} is left of {string} in the same row
in the horizontal view {string} and {string} are in separate lanes of the same row
I note the width of {string} in the horizontal view
{string} is wider in the horizontal view than noted
in the horizontal view {string} is about {int} times as wide as {string}
in the horizontal view the title of {string} is inside the viewport and inside its card
I note the height of the day rows of the horizontal view
the day rows of the horizontal view are taller than noted
I zoom the horizontal view in time with Ctrl+wheel
I zoom the horizontal view in days with Alt+wheel
I press the horizontal view's time zoom in button
I press the horizontal view's day zoom in button
the horizontal view is zoomed in time
the horizontal view does not show the hour {time}
the horizontal view shows the hour {time}
I scroll the horizontal view sideways
I tap the day label {date} in the horizontal view
```

- Clock: `clock-arc` per event and per timed task list (`data-title`, `data-start`, `data-end` as HH:MM, `data-kind`
  `event|tasklist`), `clock-hand` (`data-time` HH:MM). "lists X without a time": a `clock-untimed` chip with that text (next to the dial).
  "fills the available space": the dial's diameter is ≥ 90 % of the smaller side of the view's content area.
- Clock gestures: points on the dial are computed from the minute and the arc's `data-r` (viewBox radius) through the
  dial's screen matrix. "tap the arc" = a tap/click on the middle of the arc; "turn the arc of X to T" = press 5 minutes
  after its start, hold 500 ms (long press), move round the dial in 5-minute steps the short way to T (+ the same offset)
  and release; "select" = a long press released in place (the arc gets `data-selected="true"` and `clock-handle`s with
  `data-edge` `start|end`); "drag the start|end handle" = press the handle and move round to T; "tap the clock at T" =
  a tap on the plate at radius 120. Touch projects use CDP touch events, others the mouse.
- "the middle of the clock says": `clock-now-line` text; "shades the time until T": `clock-wedge` `data-to`;
  all-day events: `clock-allday` (`data-title`).
- Approach bar: `approach-bar` inside the `now-card` (replacing its "Next:" line) with `approach-item` chips
  (`data-title`, `data-minutes` = minutes until start) and `approach-now`; "in this order" = exactly these chips, by
  distance from `approach-now`; "closer" compares the item's distance from `approach-now` before and after the clock
  step. "I turn on the approach bar and open …" = the settings switch `settings-approach-bar`, then the week view.
- Timeline: `timeline-item` (`data-title`) and `timeline-now`, positions compared along the timeline's axis.
- Strip: `strip-column` (`data-date`); "in front" = the leftmost fully visible column; "did not reload" = a marker set
  on `window` before the step is still there.
- Labs v2 (owner feedback): sizes are always proportional to duration (time blindness), "about N times" allows ±15 %;
  all-day bands are `timeline-allday` / `strip-allday` above the timed area; clock labels are `clock-label`
  (`data-title`) next to or along each arc.
- Zoom month: `zoom-view` carries `data-month` (title), `data-zoom` (1..7), `data-times` / `data-lists` / `data-timeline`
  (detail weights 0..1, "until ... show" presses `zoom-in` until the weight is 1; each press multiplies the zoom by 1.25) and
  `data-detail`; `zoom-cell` (`data-date`, `data-count` = entries of the day), `zoom-time` (`data-weight`) before a timed event
  in `zoom-entries`. "shows the whole month": zoom 1 and the last cell lies inside `zoom-port`. "Ctrl+wheel": a `wheel`
  event with `ctrlKey` on `zoom-port`; the zoom is remembered in `sessionStorage` `cal.zoomMonth`.
- Horizontal view: `htime-view` carries `data-zoom-x` (time) and `data-zoom-y` (days);
  `htime-row` (`data-date`) per day, `htime-day-label` (`data-date`), `htime-hour` (`data-hour`) in the sticky axis,
  `htime-port` the viewport; events are the usual `event-chip`. "left of ... in the same row": both chips lie in the same
  `htime-row` and the first one's left edge is smaller. "separate lanes": same row, their boxes overlap in x and not in y.
  "wider / taller than noted" compares with the box noted before. "about N times as wide": a ±15 % ratio of the chips'
  widths. "Ctrl+wheel" / "Alt+wheel": a `wheel` event on `htime-port` with `ctrlKey` / `altKey` (deltaY -300); the zoom is
  remembered in `sessionStorage` `cal.zoomHTime`. "shows the hour H": the `htime-hour` label's box lies inside the port's
  horizontal span. "scroll sideways": a plain `wheel` event with a large `deltaX` on the port. The time buttons are
  `htime-time-in`, the day buttons `htime-day-in`. "I open the horizontal day view" opens the removed `?mode=day` link
  (it shows the week). "zoom in days to the maximum": press `htime-day-in` until it is disabled; "between N and M days on
  screen": port height / row height lies in that range. "drag sideways with a finger": a CDP touch drag of 220 px right to
  left across the port (`touchDrag`, 150 ms); "scroll position" is the left edge of the `htime-hour` 00:00 label, "has
  panned" that it moved by more than 40 px.
- Timeline (owner): vertical axis on every device (`timeline` has `data-orientation="vertical"`, later items have larger y);
  "reads left to right in one line": the item's title is not rotated and its text box is wider than tall.

## App updates

```
a new version of the app is deployed
the app syncs
I am told a new version is available
I choose to reload
the app runs the new version
```

- "deployed": `POST /api/__test/version { version }` makes the server report a new build version (TEST_MODE).
- "the app syncs": the same as "I wait for the automatic sync" or a focus-triggered sync.
- "told": snackbar `update-available` with action `update-reload`; "runs the new version": after reload
  `document.documentElement.dataset.appVersion` equals the deployed version.

```
the app runs inside the Android app with version code {int}
the server offers the app version code {int}
I am offered to download the new app version
I am not offered to download the new app version
I choose to download the app
the app download starts
```

- App update hint (APK): "runs inside the Android app with version code N" adds an init script that fakes
  `window.Capacitor` (`isNativePlatform: () => true`, `Plugins.ServerChoice.appVersion → { versionCode: N }`); "the server
  offers the app version code N" is `POST /api/__test/apk { versionCode, versionName }`; "offered": snackbar `apk-available`
  with action `apk-download`; "download starts": the page requested `/app.apk` (a download navigation, seen as the
  `download` event). The "add button covers no control of the" map knows "app update hint" (`apk-available`; on a phone the add button slides out while a persistent snackbar shows). Without Capacitor (browser) nothing shows. Real-device behaviour of the bridge is not e2e-testable.

## Release notes

```
the release notes are:
I open What's new
What's new shows the days {string}
What's new shows {string} under {date}
this device last ran an older version and has seen the notes up to {date}
I am told what is new: {string} and {int} more
I dismiss the release note
I choose What's new in the release note
I am not told what is new
I reload the app
```

- "the release notes are:" (table `date`, `text`, newest first) is `POST /api/__test/release-notes { notes }`.
- "I open What's new": the `settings-whats-new` row in the open settings; the sheet `whats-new` is visible. "shows the
  days X": the `whats-new-day` `data-date` values in order, comma-separated. "shows T under D": a `whats-new-item` with
  text T inside the `whats-new-day` of D.
- "this device last ran an older version and has seen the notes up to D": an init script sets localStorage
  `cal.lastVersion` to `0.0.1` and `cal.notesSeen` to the id of the newest note dated D or earlier (ids from
  `GET /api/release-notes`).
- "told what is new: T and N more": snackbar `whats-new-note` is visible, contains T and the text "+N more". "not told":
  no `whats-new-note` within 2 s after the app is idle. "dismiss": `whats-new-dismiss`; "choose What's new in the release
  note": `whats-new-open`. "I reload the app": `page.reload()` and wait until the app is idle. The "add button covers no
  control of the" map knows "release note" (`whats-new-note`).

- Undo (`@undo`): deleting takes effect at once in the app without a confirmation; the `undo-snackbar` shows
  "Deleted: <title>" with action `undo-action`. "I undo the deletion" clicks `undo-action`. "the undo time is over" waits
  until `undo-snackbar` is gone (≤ 8 s) and the pending delete request has finished. "the snackbar says" = the text of
  the visible `undo-snackbar` message (`snackbar-text`).

## Theme menu (`@themes`)

```
I open the theme menu
I choose the theme {string}
I chose the theme {string}
{string} chose the theme {string}
the theme {string} is marked as chosen
the theme {string} is in use
every option for {string} shows a sample event drawn in that style
I pick {string} for {string}
the theme menu sections are {string}, {string}, {string} and {string}
the scene choices are {string}
the theme menu has no Mordor button
the top bar shows the {string} scene
the top bar shows no scene
the settings show the theme {string}
I set the seasons and holidays to {string}
the seasons and holidays are off
the seasons and holidays are set to {string}
the advent timeline shows {int} lit candle(s)
the Christmas tree lights are on
the Christmas tree lights are off
the preview event is drawn as an outline
the event {string} is drawn as an outline
the event {string} glows
the event {string} does not glow
{string} may use the calendar
I set the {string} slider to {int}
the {string} slider shows {string}
no option for {string} is pressed
the option {string} for {string} is pressed
the event {string} has a corner radius of {int} px
I scroll the theme menu to the {string} section
the live preview is pinned under the theme menu header
the preview event has a corner radius of {int} px
the live preview is expanded
the live preview is collapsed
I collapse the live preview
I expand the live preview
the event {string} glows with a blur between {int} and {int} px
the entry tint is {int} %
I choose {string} for the {string} setting
the app text is {float} px
the task item checkboxes are drawn as {string} with a {string} mark
the app uses the {string} icon set
every option of the {string} setting shows a sample icon
```

- Fine-tuning sliders (owner 2026-10-13): "I set the X slider to N" finds the native `input[type=range]` by its label (`Glow strength` =
  `theme-slider-glow`, `Corner radius` = `theme-slider-radius`, `Entry tint` = `theme-slider-tint`), opens the theme menu
  when needed, sets the value the way a keyboard or pointer would (fires `input`) and waits for the save
  (`PATCH /api/prefs/theme`). "the X slider shows T": the visible value text next to it (`<testid>-value`), e.g. `4 px`, `30 %`,
  `40` (glow strength has no unit).
- "no option for Y is pressed" / "the option V for Y is pressed": the `theme-option` buttons of that `data-setting`
  (`glow`, `corners`) and their `aria-pressed`.
- "has a corner radius of N px": the computed `border-top-left-radius` of the event as the week view draws it (a timed
  block, whose radius follows the slider as `--r-block`: slider 4 px = 5 px, Round 6 px = 8 px, Pill = 16 px). "glows with a blur
  between A and B px": the largest blur radius of the chip's coloured `box-shadow` is within A..B. "does not glow": no
  coloured shadow with a blur. "the entry tint is N %": the computed `--e-fill` on `<html>` is `N%`.
- "I choose V for the S setting": segmented controls of the menu by label (`Density` = `theme-density`, `Checkbox shape` =
  `theme-checkbox-shape`, `Checkbox fill` = `theme-check-fill`, `Check mark` = `theme-check-glyph`, `Icon set` = `theme-icon-set`); the option is the button
  with that label inside; waits for the save. "the app text is N px": computed `font-size` of `<body>` (the body text size;
  14 px at Comfortable, 12.6 px Compact, 15.68 px Airy).
- "the app uses the X icon set": `<html data-icons>` equals X (`outlined`, `rounded`, `sharp`) and the back
  icon of the menu (`theme-back`) is drawn in that set (its `svg` has `data-icon-set` X; every app icon carries it). "every option of
  the S setting shows a sample icon": each button of that control contains an `svg`.
- "the task item checkboxes are drawn as S with a G mark": `<html data-checkbox>` equals S (`round`, `square`, `rounded`) and
  `data-check` equals G (`tick`, `bold`, `cross`, `dot`), and in the expanded task list every `tasklist-item-checkbox` shows
  only that glyph (`[data-glyph]` with a non-`none` display).

- "glows": the event chip has a visible glow (a non-`none` `box-shadow` or `filter: drop-shadow` in the item colour).
- "drawn as an outline": transparent or surface fill with a 1.5 px or wider border in the item colour.
- "every option ... shows a sample": each option of that setting contains a sample event chip drawn in that style.
- App sign-in (`signin.feature`): the "system browser" is the test's own cookie-keeping HTTP client (`request`), which runs
  `/api/auth/google/start?app=1` -> fake consent -> callback; the page is the app's WebView. "is handed a one-time code" =
  the callback answers 302 to an `intent://auth?code=...` URL (the deep link `lan.mordor.calendar://auth?code=...`); "not signed in" = that client got no
  `cal_session` cookie. "exchanges the code" = the page opens `/api/auth/app-exchange?code=...` (the deep link's effect);
  "is asked to sign in again" = that load answered the "expired or already used" page (HTTP 400, link to `/signin`).
- "{string} may use the calendar": a one-address allow-list (see "Signing in"); "on another device" is a fresh
  browser context signed in as that person.
- "the theme X is in use": `<html data-theme-name>` equals X (with Header + colours, the calendar's theme for today).
- "I pick X for Y": the option is found by the label it shows (`theme-option` with that `data-setting`), and the theme
  menu is opened first when it is not open. Scene options, in order: "Spring", "Summer", "Fall", "Halloween", "Winter", "Sunflower field", "Mordor",
  "None" (`data-value` `spring`, `summer`, `fall`, `halloween`, `winter`, `sunflowers`, `mordor`, `none`);
  the holiday scenes sit in the order Spring, Easter, Summer, Summer holidays, Fall, Halloween, Christmas,
  New Year's Eve, New Year, Winter, Sunflower field, Mordor, None (`data-value` `easter`, `summerholidays`,
  `christmas`, `newyearseve`, `newyear`; the top bar's `data-scene` is the same value);
  "the scene choices are" takes the labels as one comma-separated string, compares them in order, checks that
  they sit in the `scene` section (not in fine-tuning) and that `settings-scene` (the retired second control) is absent.
- "the theme menu sections are": the headings of the `theme-section` elements (`data-section` `calendar`, `presets`, `scene`,
  `fine-tuning`; the live preview card above them is not a section), in page order. "has no Mordor button":
  `settings-theme-mordor` does not exist.
- "the top bar shows the X scene": back on the calendar, `top-bar-scene` has `data-scene` X (`sunflowers`, `mordor`,
  `spring`..); "shows no scene": `top-bar-scene` is absent.
- Live preview (`theme-live-preview`, `data-collapsed` `true`|`false`; toggle `theme-live-preview-toggle`, `aria-expanded`):
  "I scroll the theme menu to the X section" scrolls the `theme-section` whose heading is X into view inside the menu's
  own scroll container (`theme-view`); "is pinned under the theme menu header" = after that scroll the preview is fully
  inside the viewport and its top edge is within 2 px of the bottom edge of the menu header (`theme-view` > `header`).
  "the preview event has a corner radius of N px" = the computed `border-top-left-radius` of `theme-preview-event` (the
  first sample event of the preview, a timed block like the week view's, so the same numbers apply as in "the event X has
  a corner radius of N px"); it does NOT leave the menu. "I collapse / expand the live preview" clicks the toggle when
  the state differs; "is collapsed / expanded" reads `data-collapsed`. The sample events carry no `event-chip` testid, so
  steps about the calendar's real events never meet them.
- "the settings show the theme X": `settings-theme-name` has exactly the text X (e.g. "Halloween", "Neon · Halloween header", "Neon").
- "I set the seasons and holidays to X": opens the theme menu when needed, clicks the option with that label ("Off",
  "Header only", "Header + colours"; `data-value` `off`, `header`, `all`) of the segmented button `theme-seasonal` in the
  "Seasons & holidays" section and waits for the save. "the seasons and holidays are set to X": that option has
  `aria-pressed` `true`. A new person has "Header + colours", so scenarios that want a plain look set "Off" first.
  "the seasons and holidays are off" (Given, for Backgrounds): `PATCH /api/prefs/theme { seasonal: 'off' }` directly, without the
  theme menu and before or after the page loads (a later load reads it).
- "the advent timeline shows N lit candles": the top bar scene has four `advent-candle` elements (`data-testid`, also
  `data-part`), in timeline order left to right, exactly the first N with `data-lit="true"`. "the Christmas tree lights are on / off": the top bar scene
  has one `xmas-tree` element with `data-lights` `on` / `off`; the tree is the end of the timeline, right of the fourth candle.
- New dialog (owner): one dialog creates events and task lists; switch `new-kind` with options `new-kind-event` /
  `new-kind-tasklist` ("Event" / "Task list"); the form below is the event form (`event-dialog`) or the task list form
  (`tasklist-dialog`); date and time carry over when switching. "I start creating a task list" = "+" then switch to
  "Task list".

- Drag + scroll (mouse only): the hold step presses 5 min below the card top, moves to 12 px above the scroll
  container's bottom, then waits. The wheel step asserts scrollTop changed. "drawn on the drop indicator" compares the
  vertical centres of `[data-dragging="true"]` and `drop-indicator`, polling ≤ 3 s for a gap < 4 px.

## Scenes and the support cat (`@scenes`, `@cat`)

```
the top bar scene shows {string}, {string}, {string} and {string}
the support cat comes by on the next finished list
the support cat is set to {string} in the settings
the support cat appears and is gone within {int} ms
the support cat does not appear
the title of the task list {string} is struck through
I pick up the event {string} and move it down by {int} hours
the support cat pushes the card from above
I hold the dragged card still for {int} second(s)
the support cat sits beside the card with a paw on it
the support cat is gone within {int} ms
```

- Butterflies visit only now and then: the scene step sets `window.__butterflyNow = true` before loading so the
  "butterfly" part is present for the check.
- Scene parts are elements in the top bar scene with `data-part` (e.g. `sprouting-tree`, `lily-of-the-valley`,
  `sunflower`, `sun`, `butterfly`, `cat`, `jack-o-lantern`, `bat`, `moon`, `ghost`; the holiday scenes have `easter-egg`,
  `hare`, `first-flower`, `sea`, `beach-umbrella`, `advent-candle`, `xmas-tree`, `snow`, `firework`, `skyline`,
  `star`, `sunrise`, `confetti`, `hill`; the sunflower field scene also has
  `sky`, `hills`, `cloud` and `bee`); the step lowercases and
  hyphenates the names (and drops apostrophes). Bats use the butterfly hook (`window.__butterflyNow`). "I choose the theme" without
  a prior "I open the theme menu" opens it from the week view for today first.
- "comes by on the next finished list" forces the next roll (`POST /api/__test/cat { next: true }` or
  `window.__catNext = true` before load). The cat is `[data-testid="support-cat"]`; "appears and is gone" uses the
  reward-effect observer (inserted, then removed ≤ N ms). "set to X in the settings" picks the option with that label in
  `settings-support-cat` (values `off|sometimes|always`, labels Off/Sometimes/Every time) and waits for the save. "does not appear": no `support-cat` inserted within 4 000 ms after the tick.

## Tasks calendar (`@tasks-calendar`)

```
I create the task list {string} on {date} with the item {string}
Google has a hidden calendar {string}
Google has a hidden calendar {string} with the event {string}
the main calendar has no event {string}
Google has exactly one calendar {string}
the filter bar does not offer the calendar {string}
I turn on {string} in the settings
Google shows the calendar {string}
```

- "I create the task list …" goes through the new dialog (FAB → Task list, title, date, one item, save).
- "hidden" = the mock account's calendar list entry has `hidden: true` (switched off in Google's list). "the main
  calendar" = the person's primary calendar. "exactly one" counts calendars with that summary in the calendar list.
- "does not offer": no filter chip with that calendar's name after "I show the filters".
- "I turn on {string} in the settings" flips the switch with that label (settings page). "Google shows" = the mock
  calendar list entry has `hidden: false`. The switch is `settings-tasks-calendar-visible`.
- Approach window: pref `approachWindowHours` (3 | 6 | 12). "at its end" = the chip's `data-at-end="true"` and its
  left edge is in the last quarter of the track. "shows A and B" = exactly these chips (any order).
- "N times as long": widths of the two `approach-item` blocks (`approach-block` inside) differ by factor N ± 10 %.
  "shown next to its block": `data-title-outside="true"` and the title's left edge ≥ the block's right edge.
- "the now card stayed in place": the `now-card` element present before the previous step is the same DOM node
  afterwards (a marker property set on it survives) and no enter animation ran on it (`data-entered` unchanged).
- "starts at now and shows N minutes": the block's left edge is at `approach-now` (± 2 px) and its width equals N
  minutes on the track scale (± 10 %); `data-running="true"` on the item.
- Approaching card = `now-card` (testids kept). "the approaching track is off" → `PATCH /api/prefs { approachBar: false }`
  (default is on). "I set the approaching window to N hours" types N into `settings-approach-window-custom` and waits
  for the save; "I switch off the Approaching card" flips `settings-approaching-card`; "I do not see" = no `now-card`.
- "title … is struck through": the list's title element (`tasklist-card-title` or the expanded view's title) has
  `data-struck="true"` and a visible strike line (`text-decoration-line` includes `line-through` or a `strike-line`
  element over it).
- Drag helper cat: `[data-testid="support-cat"][data-role="drag"]` with `data-pose` = `push-down` (above the card),
  `pull-up` (below), `push-side` (beside, moving to another day) or `wait` (beside, paw on the card, questioning look).
  "pushes the card from above" = pose `push-down` and the cat's box is above the dragged card's centre. "sits beside
  … with a paw on it" = pose `wait`. The pick-up step uses mouse press + moves (desktop), keeping the pointer down.
- Pinch: two CDP touch points on `time-grid` moving apart until their distance doubles (≥ 300 ms). "one hour … tall"
  reads `data-hour-height` of `time-grid` (± 10 %) compared with the value captured before the pinch / at page open.
- "drawn a quarter as tall": block heights of the task list card and the event chip, ratio 0.25 ± 0.05 (both at the
  current hour height; the step zooms in first if the list would hit the minimum).
- Settings sections (owner 2026-10-13): `settings-section` with `data-section` = appearance | calendar | tasklists |
  motivation | motion | labs | account. Theme mode and seed colour steps (`I choose the theme mode`, `I choose the seed
  color preset`, `I enter the custom seed color`, `the seed color … is selected`, `the theme mode … is selected`)
  operate in the theme menu (open it from the settings' `settings-theme` if not open); the testids are unchanged.
  "I open the settings" stays the settings page.
- Version: "the server reports the build version V" uses the existing `POST /api/__test/version { version }` and
  reloads; `settings-version` text starts with "Version 0.4.2"; `app-version` text equals "0.4.2". The corner switch
  goes through the generic `I turn on {string} in the settings` step.

## Bedtime (`@bedtime`)

```
bedtime mode is on with fixed times {time} and {time}
bedtime mode is on based on my first appointment with {int} hours of sleep and {int} minutes of lead time
the night bands of {date} are {string}
the night band runs from {date} {time} to {date} {time}
no night band is shown
the approach bar shows a night band
I see the bedtime reminder {string}
I do not see a bedtime reminder
```

- Setup steps `PATCH /api/prefs { bedtime: { enabled: true, mode, ... } }` as that person (the other fields keep
  their defaults: fixed 23:00 and 07:00, reminder 30 minutes). The first one sets `mode: "fixed"`, `bedtime`, `wake`;
  the second `mode: "dynamic"`, `sleepMinutes` = hours x 60 and `leadMinutes`. No setup step means bedtime is off.
- Night band: every drawn piece has `data-testid="bedtime-band"` with `data-date` (the day it is drawn on),
  `data-start` / `data-end` (`HH:MM` within that day, `24:00` at its end) and `data-from` / `data-to` (the whole
  night as `YYYY-MM-DD HH:MM`). "the night bands of D are S" joins `data-start-data-end` of the pieces with
  `data-date` D (in the view that is open, in document order) with `", "`, e.g. `"00:00-07:00, 23:00-24:00"`.
  "the night band runs from A to B" looks for a piece with that `data-from` and `data-to`. "no night band is shown":
  no `bedtime-band` and no `bedtime-track-band` exists. Day and week show `bedtime-band` pieces in the day columns,
  the Timeline in its day sections, the Strip in its columns and the Clock as arcs.
- Approach bar: "shows a night band" = a `bedtime-track-band` inside `approach-bar`.
- Reminder: a snackbar with `data-testid="bedtime-reminder"`; "I see" compares its text exactly.

## Left-handed mode (`@left-hand`)

```
left-handed mode is on
the {string} is on the {string} side of the screen
the switches in the settings are on the {string} side of the screen
the support cat walks in from the {string}
```

- Scenarios tagged `@tablet` run in the `tablet` project only (820x1180, touch, `isMobile`: an iPad in portrait).
- "left-handed mode is on" sets the person pref with `PATCH /api/prefs { "leftHanded": true }` through the API before the
  page is opened (the switch itself is exercised through the generic `I turn on {string} in the settings` step with the
  label "Left-handed mode", switch testid `settings-left-handed`).
- "the X is on the S side of the screen" (S = `left` | `right`): the centre x of the element's bounding box is left
  / right of the viewport centre (`innerWidth / 2`). X names: `create button` = `create-button`, `tray toggle` =
  `task-tray-chevron` (the open/close chevron in the phone tray bar), `settings button` = `settings-button`,
  `Today button` = `nav-today`, `undo action` = `undo-action`, `time axis` = `time-axis` (the hour labels column of
  `time-grid`).
- "the switches in the settings are on …": every `role=switch` inside `settings-view` (at least one) has its centre on that side.
- "the support cat walks in from the S": the visible `support-cat` element has `data-from` = `left` | `right` (the
  side it enters from; the drag helper cat keeps `data-side` for the side it stands on). Polled while the cat is shown.

## Theme import (`@theme-import`)

```
own themes are turned on in Labs
I turn on own themes in the settings
the theme menu has no block for creating own themes
the theme menu has a block for creating own themes
I choose "Create with AI"
I see a prompt that describes the theme file {string}
I can copy the prompt
I import the theme file {string}
I paste the theme text {string}
I paste the AI answer {string}
I upload the picture file {string}
the import preview shows the theme {string}
I save the imported theme
the gallery offers the theme {string}
the gallery does not offer the theme {string}
the import says {string}
I can copy the repair prompt
I cannot save the imported theme
the import notes that unsafe content was removed
no script from the theme runs
the top bar draws the decor {string}
the top bar shows the picture of the theme
{string} imported the theme file {string}
{string} uses the imported theme {string}
I delete the theme {string}
I save my look as my own theme named {string}
my own theme {string} has {string} set to {string}
```

- Fixture files live in `e2e/fixtures/themes/`: `ocean.json` (valid `calendar-theme/2`, drawn scene: gradient with the
  decor `waves`), `gemini-answer.txt` (an AI chat answer as pasted: text around a ```` ```json ```` fence, the theme
  "Lagoon", and a URL in its description written as a Markdown link `[http://…](http://…)`), `sneaky.svg` (a picture
  with a `<script>`, an `onload` attribute and an external `href`, which sets `window.__pwned = true` if it ever runs).
- "own themes are turned on in Labs" sets `labsOwnThemes` through `PATCH /api/prefs` for the person who is using the
  app at that moment (before sign-in: the signed-out person); "I turn on own themes in the settings" opens the
  settings and flips `settings-labs-own-themes` (waits for the save), as the Labs steps do. The block with the AI prompt and
  the import is `theme-own`.
- "Create with AI" = `theme-ai` button; the prompt is `theme-ai-prompt` (contains the schema id); "copy" clicks
  `theme-ai-copy` and checks the clipboard (granted permission) equals the prompt text.
- "import the theme file" uploads through `theme-import-file`; "paste" fills `theme-import-text` and submits.
  Preview = `theme-import-preview` (`data-name`); errors = `theme-import-error` items (exact text of one of them);
  "cannot save" = `theme-import-save` disabled; "unsafe content was removed" = `theme-import-sanitized` visible;
  "no script runs" = `window.__pwned` is undefined after 1 s and no `<script>` inside the scene.
- "imported the theme file" = `POST /api/themes` with the fixture as that person. "delete" = the theme card's
  `theme-delete` (with undo snackbar like other deletes; the step waits until it is gone).
## Tasks view (`@tasks-view`)

```
the calendar contains an undated task list {string} with items:
I open the Tasks view
I create the task list {string} in the Tasks view
I remove the date of the task list {string} in the Tasks view
I group the Tasks view by {string}
I sort the Tasks view by {string}
I sort the Tasks view by {string} in reversed order
I tick the item {string} of the task list {string} in the Tasks view
the Tasks view lists {string} under {string}
the Tasks view lists {string}
the Tasks view groups are {string}
the Tasks view is grouped by {string}
I collapse the card of the task list {string} in the Tasks view
I expand the card of the task list {string} in the Tasks view
the card of the task list {string} in the Tasks view is collapsed
the card of the task list {string} in the Tasks view is expanded
the card of the task list {string} in the Tasks view shows the items {string}
the card of the task list {string} in the Tasks view shows no items
the card of the task list {string} in the Tasks view shows the done count {string}
I collapse all task lists in the Tasks view
I expand all task lists in the Tasks view
the Add item button of the task list {string} in the Tasks view shares a row with Edit and Delete
the add field of the task list {string} in the Tasks view is hidden
the add field of the task list {string} in the Tasks view is shown
I tap Add item of the task list {string} in the Tasks view
the calendar shows the task list {string} on {date}
neither the calendar on {date} nor the open tasks tray shows the task list {string}
```

- Steps that act in the Tasks view open it first (`/tasks`, via `view-switch-tasks`) when it is not shown.
- Collapse steps (`tasklists-collapse.feature`) act on the `tasks-item` with `data-title` L: "collapse/expand the card"
  clicks its `tasklist-collapse` when its `aria-expanded` differs; "is collapsed / expanded" = `data-collapsed` on
  its `tasklist-view` is `true` / `false`; "shows no items" = no visible `tasklist-item`; "shows the items" = the
  visible `tasklist-item` `data-title`s joined by ", "; "shows the done count" = `tasklist-expanded-count`.
  "collapse/expand all" clicks `tasks-collapse-all` until every card shows the wanted state. "shares a row with
  Edit and Delete": `tasklist-add`, `tasklist-edit` and `tasklist-delete` have the same vertical centre (within
  4 px). "the add field is hidden / shown" = `tasklist-new-item` not visible / visible; "I tap Add item" clicks
  `tasklist-add`.
- "undated task list" fixture: `POST /api/tasklists` with `date: null`; items table as usual.
- "I create the task list T in the Tasks view": `create-button` (in the Tasks view it opens the task list dialog
  without a date), type T into `tasklist-title`, `tasklist-save`.
- "I remove the date of the task list L": taps `tasklist-expanded-title` of L's `tasks-item` (opens the task list
  dialog), clicks `tasklist-no-date`, `tasklist-save`.
- "I group … by G" clicks the `tasks-group-by` option with that label (`Time`, `Category`, `None`); "I sort … by S"
  picks the label in the `tasks-sort-by` select (`Date`, `Name`, `Category`, `Last changed`, `Progress`). Both wait for
  the `PATCH /api/prefs` response. "... in reversed order" also sets the `tasks-sort-dir` toggle to reversed
  (`aria-pressed="true"`, clicking it only when it is not yet) and waits for that save too. "is grouped by G" = `aria-pressed="true"` on that `tasks-group-by` option.
- "lists T under G": the `tasks-item` with `data-title` T lies inside the `tasks-group` whose `tasks-group-title` text
  is G. "lists A, B, C" = all `tasks-item` titles in DOM order, joined `", "`. "groups are" = the `tasks-group-title`
  texts in DOM order, joined `", "`. When grouped by None there is one group without a title.
- "I tick the item I of the task list L": ticks `tasklist-item-checkbox` of the item inside L's `tasks-item`
  (a `tasklist-view`, the tray's own item component).
- "the calendar shows L on D" opens the day view for D and expects the `tasklist-card` L there. "neither … nor …"
  opens the day view for D and expects no `tasklist-card` L, opens the open tasks tray and expects it not to list L.

  `theme-ai-copy` and checks the clipboard equals the prompt text. "copy the repair prompt" clicks `theme-repair-copy`
  and checks the clipboard equals `theme-repair-prompt`.
- "import the theme file" uploads through `theme-import-file`; "paste the theme text" fills `theme-import-text` and
  submits (`theme-import-submit`); "paste the AI answer" does the same with the text of the fixture file; "upload the
  picture file" uploads through `theme-picture-file` (and checks again). Preview = `theme-import-preview`
  (`data-name`); errors = `theme-import-error` items (exact text of one of them); "cannot save" = `theme-import-save`
  disabled; "unsafe content was removed" = `theme-import-sanitized` visible; "no script runs" = `window.__pwned` is
  undefined after 1 s and no `<script>` inside the preview or the top bar scene.
- "the top bar draws the decor" = `top-bar-scene` contains `drawn-scene` with that `data-decor`; "shows the picture of
  the theme" = it contains `scene-image` and no `drawn-scene`. Both go back to the calendar first.
- "imported the theme file" = `POST /api/themes` with `{ theme: <fixture> }` as that person. "uses the imported
  theme" = `PATCH /api/prefs/theme` with that theme's id. "delete" = the theme card's `theme-delete` (with undo
  snackbar like other deletes; the step waits until it is gone).
- "save my look as my own theme named" clicks `theme-save-own`, fills `theme-save-name` in `theme-save-dialog`, clicks
  `theme-save-confirm` and waits until the theme is saved and chosen (`POST /api/themes`, then the saved choice).
  "my own theme has … set to …" reads `GET /api/themes` as that person and compares one field of the document.

## Tasks archive (`@tasks-archive`)

```
the calendar contains a task list {string} finished on {date}
the calendar contains a task list {string} finished on {date} with the item {string}
the setting {string} is {string}
I open the Archive
I search the Archive for {string}
I untick the item {string} of the task list {string} in the Archive
I choose {string} for the task list {string} in the Archive
the Archive lists {string}
the Archive does not list {string}
the Open tab lists {string}
the Open tab does not list {string}
the open task list {string} has no date and {int} open item(s)
```

- Also used from "Tasks view": "the calendar contains an undated task list ... with items:", "I tick the item ... in the
  Tasks view", "the calendar shows the task list ... on ...", "neither the calendar ... nor the open tasks tray ...".
- "finished on D" fixture: an undated list whose items (one item "Done" unless `with the item` names it) are ticked
  through the API while the test clock is D (so `completedOn` = D), then the clock is set back to the Background date.
  The undated list is dated to D by the completion (default setting), which does not matter for the Archive.
- "the setting S is V": S = `Finished list without a date`, V = `Show on the day it was finished` | `Archive only`;
  `PATCH /api/prefs { undatedDone: 'calendar' | 'archive' }` as that person.
- "I open the Archive": opens the Tasks view (as the Tasks view steps do) and clicks `tasks-tab-archive`
  (`aria-pressed="true"`). "the Open tab lists / does not list T" clicks `tasks-tab-open` and checks the `tasks-item`
  titles (`data-title`); "the Archive lists A, B" opens the Archive and compares all `tasks-archive-item` titles in DOM
  order joined `", "` ("does not list T": none has that title).
- "I search the Archive for X": opens the Archive and fills `tasks-archive-search` (the field's own debounce is
  awaited by the expectation that follows).
- "I untick the item I of the task list L in the Archive": unticks `tasklist-item-checkbox` of that item inside L's
  `tasks-archive-item` and waits for the `PATCH /api/tasklists/:id/items/:itemId` response.
- "I choose Use as template for the task list L": clicks `tasks-archive-duplicate` in L's `tasks-archive-item` and
  waits for the `POST /api/tasklists` response.
- "the open task list L has no date and N open item(s)": opens the Open tab; the `tasks-item` L has an empty
  `data-date` and N `tasklist-item` rows with `data-done="false"` (and no done ones).

## Tasks canvas (`@tasks-canvas`)

```
I open the Canvas
the Canvas shows the notes {string}
the Canvas does not show the note {string}
the note {string} shows the date {date}
the note {string} shows the items {string}
I move the note {string} to {int}, {int} on the Canvas
the note {string} is at {int}, {int} on the Canvas
the note {string} is in the Unsorted stack
the note {string} is not in the Unsorted stack
I tick the item {string} of the note {string} on the Canvas
the page is a little taller than the screen
I add an area on the Canvas
the add button covers no control of the {string}
I create the area {string} on the Canvas
I move the note {string} into the area {string} on the Canvas
the note {string} is in the area {string}
the Canvas shows the area {string}
I long-press the note {string} on its first item and drag it to {int}, {int}
the item {string} of the note {string} is not ticked
I long-press the item {string} of the note {string} and drag the note to {int}, {int}
I long-press the checkbox of the item {string} of the note {string} and drag the note to {int}, {int}
I swipe across the note {string} on the Canvas
I tap the empty Canvas
I long-press the area {string} and release without moving
the area {string} shows resize handles
the area {string} shows no resize handles
I drag the bottom right handle of the area {string} by {int}, {int} pixels
the area {string} is {int} wide and {int} high
I pan the Canvas by {int}, {int} pixels
the Canvas is panned to {int}, {int}
I zoom the Canvas in with Ctrl+wheel
the Canvas zoom is above {float}
```

- Also used: "the calendar contains an undated task list ... with items:", "... finished on D", "I create the task list T in the
  Tasks view", "the Archive lists ...", "I reload the page", "I switch to another device".
- "I open the Canvas": opens the Tasks view as the Tasks view steps do and clicks `tasks-tab-canvas`
  (`aria-pressed="true"`), then waits for `tasks-canvas`.
- "the Canvas shows the notes A, B": the `data-title` of all `canvas-note`s, sorted alphabetically and joined `", "`,
  equals the text (A-130). "does not show the note T": none has that title.
- "the note T shows the date D": `canvas-note` T has `data-date` D and a `canvas-note-date`. "shows the items": the
  `tasklist-item` titles of the note joined `", "` in order.
- "I move the note T to X, Y": on a phone (`hasTouch`) a finger through CDP (`touchStart` in the middle of the note, a
  500 ms long press, `touchMove` in 10 steps, `touchEnd`, as the Drag and drop steps); otherwise a plain mouse drag from
  the middle of `canvas-note-grip` (a mouse must not start on a button). Either way the pointer travels
  `(X - data-x, Y - data-y) * data-zoom` pixels; the step waits for the `PATCH /api/tasklists/:id` response (status 200).
  "the note T is at X, Y": `data-x`, `data-y` and `data-placed="true"`.
- "I long-press the note T on its first item and drag it to X, Y": like the move, but the finger goes down on the first
  `tasklist-item-title` (a button), to show that a long press picks the note up anywhere. "the item I of the note T is
  not ticked": `data-done="false"`.
- "I long-press the item I of the note T and drag the note to X, Y": like the long press on the first item, but the finger
  goes down on the text of that `tasklist-item` row (its `tasklist-item-title`, not the checkbox).
- "I long-press the checkbox of the item I of the note T and drag the note to X, Y": the same, with the finger down on the
  item's `tasklist-item-checkbox`.
- "I swipe across the note T": the same finger (or mouse) drag by (60, 80) px from the middle of the note with no long
  press; the scenario then expects an unmoved note in the stack and the view still at 0, 0.
- "I tap the empty Canvas": a click in the bottom right corner of `canvas-viewport` (outside notes and areas); it hides
  the resize handles.
- "I long-press the area A and release without moving": finger down on the body of `canvas-area` (a spot away from the
  header), held 500 ms, up. A mouse has no long press, so there it is a click on `canvas-area-header` (which also opens
  the editor; the step closes it with `canvas-area-editor-close`).
- "the area A shows / shows no resize handles": the area has 4 / 0 `canvas-area-handle` elements.
- "I drag the bottom right handle of the area A by DX, DY pixels": drags `canvas-area-handle` with `data-corner="se"`
  (a handle drags at once, no long press). "the area A is W wide and H high": `data-w`, `data-h` and the saved area
  (`GET /api/canvas`) agree.
- "in / not in the Unsorted stack": `data-placed` is `"false"` / `"true"`.
- "I tick the item I of the note T on the Canvas": clicks `tasklist-item-checkbox` of that `tasklist-item` inside the
  note and waits for the `PATCH /api/tasklists/:id/items/:itemId` response.
- "I create the area N": clicks `canvas-area-add`, fills `canvas-area-name-input` with N, presses Enter and waits until
  `GET /api/canvas` (through the test API) lists an area named N.
- "the page is a little taller than the screen": gives the document 120 px of scroll range (an invisible 1 px box below the screen), as a phone's collapsing address bar does, so the browser can start a native pan.
- "I add an area on the Canvas": clicks `canvas-area-add` and waits for `canvas-area-editor`.
- "the add button covers no control of the P" (P = `area editor`, `filter sheet` or `sort sheet`): waits until the bounding box of
  `create-button` (when it has one) intersects none of the boxes of the buttons of `canvas-area-editor`, `tasks-filter-sheet`
  or `tasks-sort-sheet`. On a phone the button slides away while the
  editor is open (`ui.panelOpen`, the same `.away` as for the expanded tray).
- "I move the note T into the area A": like "I move the note T to X, Y" with X, Y = the area's `data-x` + 20 and
  `data-y` + 56. "the note T is in the area A": `data-area` of the note equals A.
- "the Canvas shows the area N": a `canvas-area` with `data-name` N is visible.
- "I pan the Canvas by DX, DY pixels": a mouse drag on an empty spot of `canvas-viewport` (bottom right quarter) by DX, DY;
  "is panned to": `data-pan-x` and `data-pan-y` equal the numbers (zoom 1).
- "I zoom the Canvas in with Ctrl+wheel": dispatches a `wheel` event with `ctrlKey` and `deltaY` -300 over the middle of
  `canvas-viewport` (as the time grid's zoom step does) and waits until `data-zoom` grew and `localStorage` `cal.canvasView`
  holds the new zoom (the view is remembered a moment after the last change). "the Canvas zoom is above Z": `data-zoom` greater than Z (waits).

## Tasks filter (`@tasks-filter`)

```
the calendar contains a task list {string} in the category {string} finished on {date}
I filter the Tasks view by the category {string}
I choose {string} as the Tasks view When filter
I clear the Tasks view filters
the Tasks view category filter {string} is on
the Tasks view When filter is {string}
I open the Tasks view filter sheet
I open the Tasks view sort sheet
I close the Tasks view sheet
the Tasks view shows the active filters {string}
I remove the active filter {string}
the note {string} is dimmed
the note {string} is not dimmed
```

- Also used: "the calendar contains a task list ... in the category ... on ...", "... with items:", "I open the Tasks view",
  "I open the Canvas", "the Tasks view lists ...", "the Archive lists ...", "I switch to another device".
- "... in the category C finished on D": like "finished on D" (Tasks archive: one item "Done" ticked while the test clock
  stands on D) with `categoryId` of the category named C set on creation.
- "I filter the Tasks view by the category C": opens the Tasks view when it is not shown, clicks the
  `tasks-filter-category` chip whose text is C (`No category` for the "none" chip) and waits for the `PATCH /api/prefs`
  response (status 200).
- "I choose W as the Tasks view When filter": clicks the `tasks-filter-when-option` (in `tasks-filter-when`) whose text is
  W (`All`, `No date`, `Dated`, `Overdue`, `Today`, `Tomorrow`, `This week`), and waits for the `PATCH /api/prefs`
  response. "I clear the Tasks view filters": clicks `tasks-filter-clear` and waits for the same.
- "the category filter C is on": that `tasks-filter-category` chip has `aria-pressed="true"`. "the When filter is W":
  `tasks-filter-when` (the group of options) has `data-value` equal to W's value (`all`, `nodate`, `dated`, `overdue`, `today`, `tomorrow`, `week`).
- **Sheets** (owner, 2026-10-13): the filter and sort controls live in bottom sheets (`tasks-filter-sheet`, `tasks-sort-sheet`,
  opened by `tasks-filter-open` / `tasks-sort-open`, closed by `tasks-sheet-done`). Every step above, and the Tasks view steps "I group
  ... by", "I sort ... by" (also "in reversed order") and "is grouped by", opens the needed sheet first when it is closed, acts in
  it and closes it with `tasks-sheet-done`; the steps "I open the Tasks view filter / sort sheet" and "I close the Tasks view sheet"
  only open and close.
- "the Tasks view shows the active filters L": the texts of all `tasks-filter-active` chips (categories first, then When) joined
  `", "`. "I remove the active filter F": clicks that chip and waits for the `PATCH /api/prefs` response.
- "the note N is dimmed / not dimmed": `canvas-note` `data-dimmed` is `"true"` / `"false"`.

## Backup to Google Drive (`@backup`)

```
the quiet period of the backup has passed
a day passes on the server
the Drive holds {int} backup(s) of {string}
I back up now
the last backup is from {date} at {time}
the server loses all data of {string}
I restore from the backup
the restore asks for confirmation
I confirm the restore
the Drive is unavailable
the backup status says it failed
the saved support cat setting is {string}
{string} signs in without the Drive permission
I am asked to allow backups to Google Drive
there is no button to back up now
```

- Also used: "{string} and {string} may use the calendar", "{string} is signed in", "{string} signs in with Google", "the time is D T",
  "the support cat is set to S in the settings", "I chose the theme T", "the theme T is in use", "I open the settings", "I open the
  Canvas", "I create the area N on the Canvas", "the Canvas shows the area N". A person with no data of their own is not backed up
  (A-181), so scenarios first change a setting.
- Google Drive is `MockDrive` (`TEST_MODE`, ARCHITECTURE "Backups"): the hidden app folder in `DATA_DIR/mock-drive.json`,
  one folder per person. "is signed in" and "signs in with Google" grant the Drive permission (the test double's
  consent returns the `drive.appdata` scope); "signs in without the Drive permission" signs in with a consent that
  leaves it out (`POST /api/__test/oauth/account { email, driveScope: false }`, then the usual consent).
- "the quiet period of the backup has passed": `POST /api/__test/backup/flush` (the debounce timer fires now, as if two
  quiet minutes had passed) and waits for it to finish. "a day passes on the server": sets the test clock 24 hours later
  (frozen) and calls `POST /api/__test/backup/tick` (the daily check, once).
- "the Drive holds N backups of P": `GET /api/__test/backup/drive?owner=P` has N entries (`backup(s)` is optional text).
- "I back up now": opens the settings when they are not open, clicks `settings-backup-now` and waits until the
  `POST /api/backup` response has arrived. "the last backup is from D at T": `settings-backup-status` has
  `data-last-backup` whose instant is D T in Europe/Berlin.
- "the server loses all data of P": `POST /api/__test/backup/wipe { owner }` deletes everything under `users/<sub>/` (as
  a new server with an empty DATA_DIR would) and signs the person out; the Drive stays as it is.
- "I restore from the backup": opens the settings when needed and clicks `settings-backup-restore`;
  "the restore asks for confirmation": `confirm-dialog` is visible; "I confirm the restore": clicks `confirm-ok` and waits
  for the page to reload after `POST /api/backup/restore`.
- "the Drive is unavailable": `POST /api/__test/backup/drive-down { down: true }` (every Drive call fails; cleared by
  reset). "the backup status says it failed": `settings-backup-status` has `data-state="failed"` and its text contains
  the reason.
- "the saved support cat setting is S": `GET /api/prefs` has the `supportCat` value of S (`Off`, `Sometimes`, `Every time`).
- "I am asked to allow backups to Google Drive": `settings-backup-allow` is visible and `settings-backup-status` has
  `data-state="off"`. "there is no button to back up now": no `settings-backup-now` and no `settings-backup-restore`.
## Sharing task lists (`@sharing`)

```
{string}, {string} and {string} may use the calendar
{string} has an undated task list {string} with the items {string}
{string} has an undated task list {string} with the items {string} in the category {string}
I share the task list {string} with {string}
I stop sharing the task list {string}
I share the category {string} with {string} in the settings
{string} creates the undated task list {string} in the category {string}
{string} opens the Tasks view on another device
{string} ticks the item {string} of the shared task list {string}
{string} renames the shared task list {string} to {string}
{string} leaves the shared task list {string}
{string} sees the task lists {string}
{string} sees no task lists
{string} cannot read the shared task list {string}
the task list {string} in the Tasks view is shared with {string}
the item {string} of the task list {string} in the Tasks view is ticked
I edit the task list {string} in the Tasks view
```

- "A, B and C may use the calendar": a three-address allow-list; TEST_MODE also records every address as a known person
  (as if they had signed in once), so they can be picked as members (ARCHITECTURE "Shared lists").
- "P has an undated task list T with the items I [in the category C]": setup through `POST /api/__test/tasklists` for
  person P (API.md); items are `, `-separated; the category is found by name in the settings. Not user activity: the
  endpoint restores the plant state.
- "I share the task list T with P": the signed-in person opens the Tasks view, opens T's dialog (`tasklist-expanded-title`),
  picks P in `tasklist-share-person` (by the name the option shows: the part of the address before the `@`), presses `tasklist-share` and waits for `POST /api/tasklists/:id/share`
  (200), then closes the dialog. "I stop sharing the task list T": the same dialog, `tasklist-unshare`.
- "I share the category C with P in the settings": opens the settings, edits the category C (`settings-category`),
  picks P (by name, as above) in `category-share-person` and saves (`PUT /api/categories/:id/share`, 200).
- "P creates the undated task list T in the category C": `POST /api/tasklists` as P (a session of its own, see below).
- "P opens the Tasks view on another device": a fresh browser context signed in as P (like "opens the week view ... on
  another device"), then the Tasks view.
- "P ticks the item I of the shared task list T", "P renames the shared task list T to N", "P leaves the shared task list
  T": the person acts through the API with a session of their own (a second cookie jar signed in through the OAuth test
  double); they find the list by its title in `GET /api/tasklists/all-open`, then `PATCH /api/tasklists/:id/items/:itemId`,
  `PATCH /api/tasklists/:id` (title) and `POST /api/tasklists/:id/leave`.
- "P sees the task lists "A, B"": `GET /api/tasklists/all-open` of P's own session; the titles, sorted, equal the
  `, `-separated list. "P sees no task lists": the same call returns none.
- "P cannot read the shared task list T": T's id is taken from the signed-in person's list; `GET /api/tasklists/:id` and
  `PATCH` with P's session answer `404`, and P's lists do not contain it.
- "the task list T in the Tasks view is shared with I": the `tasks-item` T contains `tasklist-shared-badge` whose text
  is I (the other person's initial).
- "the item I of the task list T in the Tasks view is ticked": `data-done="true"` of the item's `tasklist-item-checkbox`.
- "I edit the task list T in the Tasks view": opens the Tasks view and the task list dialog of T (tap on
  `tasklist-expanded-title`).
## View switcher position (`@nav-position`)

```
the view switcher on phones is set to {string}
the view switcher on desktop and tablets is set to {string}
I choose {string} as the view switcher position on phones
the view switcher is in the {string} position
the view switcher is directly under the top bar
the view switcher is above the calendar
the view switcher is on the {string} side of the screen
there is no bottom bar
the open tasks tray is at the bottom of the screen
the open tasks tray is above the bottom bar
the add button is above the open tasks tray
```

- "the view switcher on phones is set to P" / "... on desktop and tablets is set to P" (P = `bottom` | `top` | `rail`)
  set the person pref with `PATCH /api/prefs { "navPhone": P }` / `{ "navDesktop": P }` through the API before the page
  is opened. Left-handed mode is a separate `Given` ("left-handed mode is on").
- "I choose X as the view switcher position on phones" (X = `Bottom` | `Top` | `Side rail`): clicks the option of the
  segmented button `settings-nav-phone` (the desktop one is `settings-nav-desktop`) and waits for the `PATCH /api/prefs` 200.
- "the view switcher is in the P position": the `view-switcher` element has `data-position` = P (the bottom bar, the top
  tabs row and the rail each render one `view-switcher`).
- "directly under the top bar": the top of `view-switcher` is within 2 px of the bottom of `top-bar` (banners and
  hints are not shown in these scenarios). "above the calendar": its bottom is above the top of `calendar-swipe-area`.
- "the view switcher is on the S side of the screen" is the left-hand step with the element name `view switcher`
  (`view-switcher`).
- "there is no bottom bar": no element `[data-testid=bottom-bar][data-position=bottom]` exists. The bottom navigation bar
  and the rail keep the testid `bottom-bar` (existing steps), and both carry `data-position` (`bottom` / `rail`).
- "the open tasks tray is at the bottom of the screen": the bottom edge of `task-tray` is within 1 px of `innerHeight`
  (the test viewport has no safe-area inset). "above the bottom bar": the tray bottom is at or above the top of the
  `bottom-bar`. "the add button is above the open tasks tray": the bottom of `create-button` is at or above the top of
  `task-tray`.
- The overlap check reuses "the add button covers no control of the {string}" with the panel name `view switcher`
  (`view-switcher`), see the panel map in `e2e/steps/tasks-canvas.steps.ts`.

