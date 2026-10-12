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
"the task list X shows the item Y below / next to its title": the `tasklist-card-item` with `data-title` Y in X's
collapsed card is visible and its box lies inside the card (an ellipsised name counts); "below" = its top
is at or under the bottom of `tasklist-card-title`, "next to" = it shares the title's line. "does not show the item Y": the
`tasklist-card-item` Y of X is not visible (it stays in the DOM for screen readers).
"for N minutes" sets the task list's estimate to N (a timed task list lasts its estimate).
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
- Every "I choose ..." / "I enter ..." step waits for the `PUT /api/settings` response (status 200) before continuing.
  A rejected custom color does not send a request.
- Theme modes are the labels `System`, `Light`, `Dark`. Seed presets are the labels `Blue`, `Purple`, `Teal`, `Green`,
  `Orange`, `Red`, `Pink`, `Slate`; a custom color is shown as `Custom`.
- Hue check: computes the HCT hue (Material color science) of the computed `--md-sys-color-<role>` and of the hex value
  and compares the circular difference (implementations may import the reference color utilities in the test code).
- `I switch to another device` creates a new browser context with the same project options (no shared storage) and
  a new page; all following steps act on it.
- `the settings are changed elsewhere to ...` sends `PATCH /api/settings` directly through the API.

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
the expanded task list shows the tags {string}
the Google event for the task list {string} stores the tags {string}
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
the task list {string} is not flagged as overdue
the overdue label of {string} does not use the error color
I move the task list to today
```

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
```

- `I open the month picker` clicks `period-title` (it toggles the picker).
- Density = `data-density` of `year-day[data-date]`. "selected" = `aria-selected="true"` on `picker-day`; "marked" =
  `data-has-items="true"`.

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
I choose {string} as the garden style
the garden style is {string}
I see the sunflower field
I do not see the sunflower field
the sunflower field shows {int} flower(s)
the sunflower field is labelled {string}
the sunflowers are swaying
the sunflowers are not swaying
the sunflowers look {string}
```

- `I turn the streak flame "on|off"` toggles the `settings-streak-flame` switch to that state. Garden styles are the
  labels `Single plant`, `Sunflower field` and `Off` of `settings-garden`. `the garden style is X` (Given) uses
  `PATCH /api/settings`.
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
```

- Google is the mock provider with one calendar per person (`TEST_MODE`); "signs in with Google" completes the OAuth
  round trip through the test double, no real Google. "they" is the person of the last sign-in step.
- "may use the calendar": the allow-list of sign-in addresses for the scenario.
- "cannot be read without signing in": a request to the events API without a session is refused as unauthenticated.
- "Google no longer accepts the access": the test double answers that person's token refresh with `invalid_grant`.
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
the view switcher offers {string}, {string} and {string} marked as experimental
I open the clock view for {date}
the event {string} is an arc from {time} to {time}
the clock hand points at {time}
the arc of {string} is labelled {string}
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
```

- Clock: `clock-arc` per event (`data-title`, `data-start`, `data-end` as HH:MM), `clock-hand` (`data-time` HH:MM).
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
the preview event is drawn as an outline
the event {string} is drawn as an outline
the event {string} glows
{string} may use the calendar
```

- "glows": the event chip has a visible glow (a non-`none` `box-shadow` or `filter: drop-shadow` in the item colour).
- "drawn as an outline": transparent or surface fill with a 1.5 px or wider border in the item colour.
- "every option ... shows a sample": each option of that setting contains a sample event chip drawn in that style.
- "{string} may use the calendar": a one-address allow-list (see "Signing in"); "on another device" is a fresh
  browser context signed in as that person.
- "the theme X is in use": `<html data-theme-name>` equals X.
- New dialog (owner): one dialog creates events and task lists; switch `new-kind` with options `new-kind-event` /
  `new-kind-tasklist` ("Event" / "Task list"); the form below is the event form (`event-dialog`) or the task list form
  (`tasklist-dialog`); date and time carry over when switching. "I start creating a task list" = "+" then switch to
  "Task list".

- Drag + scroll (mouse only): the hold step presses 5 min below the card top, moves to 12 px above the scroll
  container's bottom, then waits. The wheel step asserts scrollTop changed. "drawn on the drop indicator" compares the
  vertical centres of `[data-dragging="true"]` and `drop-indicator`, polling ≤ 3 s for a gap < 4 px.

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
