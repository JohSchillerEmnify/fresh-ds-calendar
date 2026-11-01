# Step library contract

All step phrases used in `spec/features/**/*.feature`, as Cucumber expressions. The e2e step library
(`e2e/steps/*.ts`, playwright-bdd) implements exactly these. Steps match regardless of keyword
(Given/When/Then/And), as in Cucumber. `e2e/scripts/check-steps.py` verifies that every
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
    `category` (category name or `No category`), `tags` (comma-separated text), `estimate` (minutes, empty = none).
  - Template fields (`@templates`): `name`, `items`, `estimate`, `category`, with the same value rules.
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

## UI hooks (`data-testid`)

The steps locate elements by these hooks; renaming one is a contract change.

| testid | Element / attributes |
|---|---|
| `app-shell` | root |
| `top-bar` | top app bar; holds `settings-button`, `filter-button`, `period-title`, `nav-prev`, `nav-next`, `nav-today`, `sync-status`, `install-app-button` |
| `settings-view`, `settings-back` | settings page and its back button |
| `settings-theme-mode` | segmented button (in the theme menu); options `data-value="system\|light\|dark"`, `aria-pressed`, labels System/Light/Dark |
| `settings-seed-preset` | swatches with `data-name`, `data-color`, `aria-pressed`; `settings-seed-custom` (hex text field, Enter/blur applies), `settings-seed-error` |
| `settings-default-view` | select |
| `category-dialog` | also `category-error`, `category-cancel`, `category-delete` |
| `view-switcher` | the tabs' container (`data-position` = `bottom` \| `top` \| `rail`); the top tabs row is `nav-tabs`; tabs `view-switch-year`, `view-switch-month`, `view-switch-week`, `view-switch-day`, `view-switch-tasks` (`aria-selected`) |
| `create-button`, `new-kind`, `new-kind-event`, `new-kind-tasklist` | add button and the kind switch of the one "new" dialog |
| `year-view`, `year-month`, `year-day` | year view |
| `month-picker`, `month-picker-title`, `month-picker-prev`, `month-picker-next`, `picker-day` | month picker |
| `month-view`, `week-view` (`data-week-start`), `day-view` (`data-date`) | view roots |
| `month-weekday-header` | 7 elements, `Mon`..`Sun` |
| `month-cell` | `data-date`, `data-today="true"`, `data-outside-month="true"`; child `month-cell-day-number` |
| `week-header` (`data-date`, `data-today`), `week-allday-cell` (`data-date`), `week-day-column`, `day-column` (`data-date`) | week/day structure |
| `day-header` (`data-date`, `data-today`), `day-allday-area` (`data-date`) | day view structure |
| `time-slot` | `data-date`, `data-hour`; tap creates an event |
| `event-chip-time`, `event-chip-location` | children of `event-chip` |
| `resize-handle-top`, `resize-handle-bottom` | inside the block being resized |
| `now-marker`, `now-card`, `now-card-line`, `now-card-current`, `now-progress` | timeline and Now card |
| `transition-warning` | snackbar |
| `task-tray`, `task-tray-toggle`, `task-tray-count`, `task-tray-item`, `task-tray-title`, `task-tray-unfold` | open tasks tray; open rows contain a `tasklist-view` |
| `tasklist-card-overdue`, `tasklist-card-estimate`, `tasklist-progress-ring`, `tasklist-complete-message` | task list card additions |
| `tasklist-view` | the list (sheet, tray, Tasks view, Canvas): `tasklist-expanded-title` (→ `tasklist-expanded-title-input`), `tasklist-expanded-count`, `tasklist-item` (`data-item-id`, `data-title`, `data-done`), `tasklist-item-checkbox`, `tasklist-item-title` (→ `tasklist-item-title-input`; Enter commits, Escape cancels), `tasklist-item-grip` (the drag handle, `aria-label` "Drag <item> to reorder"; the row has `data-dragging` while lifted), `tasklist-item-delete`, `tasklist-add` (→ `tasklist-new-item`), `tasklist-collapse` (`aria-expanded`; root `data-collapsed`), `tasklist-edit`, `tasklist-delete`, `tasklist-close` |
| `event-dialog` | `data-presentation="sheet\|modal"`; `event-title`, `event-all-day`, `event-start-date`, `event-start-time`, `event-end-date`, `event-end-time`, `event-description`, `event-location`, `event-calendar`, `event-color` (swatches `event-color-option` with `data-color`; order: Calendar color, Tomato, Flamingo, Tangerine, Banana, Sage, Basil, Peacock, Blueberry, Lavender, Grape, Graphite), `event-error`, `event-save`, `event-cancel`, `event-delete` |
| `tasklist-dialog` | `data-presentation`; `tasklist-title`, `tasklist-date`, `tasklist-time`, `tasklist-date-clear` (empties the date: undated), `tasklist-category`, `tasklist-items` (create only), `tasklist-estimate`, `tasklist-repeat`, `tasklist-error`, `tasklist-save`, `tasklist-cancel` |
| `sheet-scrim` | the area beside a dialog |
| `streak-flame`, `streak-message`, `plant-button`, `plant-card`, `plant-card-stage`, `plant-card-line`, `settings-best-streak` | motivation |
| `settings-animation-level`, `settings-sounds`, `settings-calm-mode`, `settings-streak`, `settings-sunflowers` | settings additions |
| `tasks-view` (`data-group-by`, `data-sort-by`), `tasks-group-by`, `tasks-sort-by`, `tasks-sort-dir` (`data-dir`), `tasks-collapse-all`, `tasks-group` (`data-group`), `tasks-group-title`, `tasks-item` (`data-tasklist-id`, `data-title`, `data-date`) | Tasks view |
| `tasks-tab-canvas`, `tasks-canvas`, `canvas-viewport` (`data-zoom`, `data-pan-x`, `data-pan-y`), `canvas-note` (`data-tasklist-id`, `data-x`, `data-y`, `data-placed`, `data-area`, `data-dimmed`; `canvas-note-grip`, `canvas-note-date`), `canvas-unsorted`, `canvas-area` (`data-area-id`, `data-name`, `data-color`, `data-x/y/w/h`, `data-selected`; `canvas-area-header`, `canvas-area-handle` `data-corner`), `canvas-area-add`, `canvas-area-editor` (`canvas-area-name-input`, `canvas-area-color`, `canvas-area-delete`, `canvas-area-editor-close`) | Canvas |
| `confirm-dialog`, `confirm-ok`, `confirm-cancel` | delete confirmation |
| `sync-error-banner`, `sync-retry` | error strip |
| `last-updated-note` | "Last updated HH:mm" while the shown calendar is the last known state (feature last-known-state) |
| `install-app-button`, `ios-install-hint`, `ios-install-hint-dismiss` | install prompts |

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
the calendar contains a task list {string} on {date} with {int} generated long items
Google contains a raw task list event {string} on {date} with the description:
```

All-day ranges in steps are inclusive (`from 2026-10-17 to 2026-10-20` = 4 days); the API uses an exclusive end.
Generated items are titled exactly `Generated item 1` … `Generated item N`, all not done. Generated long items are the same titles padded with `x` to 150 characters. 40 such items serialize to
more than 1024 characters of JSON, which forces chunking (see API.md "Storage in Google").
The raw task list event has `extendedProperties.private.kind = "tasklist"` but no `items` property (doc string = description).

## Navigation

```
I open the app
I open the app {int} minutes later
the browser window is {int} by {int} pixels wide and high
I open the path {string}
I open the month view for {month}
I open the week view for {date}
I open the day view for {date}
I go to the next period
I go to the previous period
I go to today
the top bar shows no arrows
the top bar shows the arrows
a screen reader finds the buttons {string} and {string} in the top bar, off screen
a keyboard user activates {string} in the top bar
I switch to the {view} view
I go back in the browser
I reload the page
I click the day number of {date}
I click empty space in the month cell of {date}
the entries on {date} fade out towards the bottom of the month cell
the month cell of {date} shows no overflow count
every entry in the month cell of {date} can be seen at least in part
the month cell of {date} leaves out the entry {string}
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

- "I go to the next / previous period" moves as a person does: with the ‹ › arrows (`nav-next` / `nav-prev`) where the
  top bar has them (desktop with a mouse), with a swipe left / right on `calendar-swipe-area` on touch screens, which
  have none (owner, 2026-10-26); either way it waits for the URL to change. "the top bar shows no arrows": `top-bar`
  has no visible `nav-prev` / `nav-next` (on touch they stay in the DOM as sr-only buttons, at most 1 px, for screen
  readers and keyboards; owner, 2026-10-26). "the top bar shows the arrows": both are visible with a real size (a
  narrow window with a mouse). "a screen reader finds the buttons X and Y ... off screen": each is found by role button
  and accessible name, takes focus, and is at most 1 px. "a keyboard user activates X": focus, then Enter.

## Events: display

```
I see the event {string} on {date}
I see the event {string} on each of {datelist}
I move the {string} of {date} to {date}
I see the event {string} on {weekday}
I see the event {string} on each day from {date} to {date}
I see the event {string} as a bar from {date} to {date}
the event {string} is a bar in lane {int}
the first entry of the month cell of {date} is at the height of the bar {string}
the first entry of the month cell of {date} is in the slot below the bar {string}
the all-day event {string} on {date} is at the height of the bar {string}
the bar {string} has the height of the chip {string}
the bar {string} shows no continuation arrows
every all-day entry in the band is no taller than an all-day entry
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

- "the all-day event A on D is at the height of the bar B": A's chip top equals B's `event-bar` top within 3 px; when B is not on the page (day view clipped away), the top of the all-day area of D.
- "every all-day entry in the band is no taller than an all-day entry": there is at least one visible `event-chip` in the
  `week-allday-cell` / `day-allday-area` cells, and each is at most 22 px tall at a viewport at least 768 px wide, 18 px
  below (the all-day entry's own height), with 0.5 px slack.
- "on each day" and "on {date}" accept a chip on that date or a multi-day bar covering it; "as a bar" checks one
  `event-bar` segment with `data-start`/`data-end` (clipped to the week row); "lane" checks `data-lane`.
- Month slots (feature event-display): "the first entry of the month cell of D" is the
  first visible chip or card inside the month cell of D (not a bar). "at the height of the bar B": its top equals the
  top of B's `event-bar` segment within 3 px. "in the slot below the bar B": its top is below B's bottom and within one
  chip height + 4 px of it. "the bar B has the height of the chip C": heights equal within 1 px. "shows no continuation
  arrows": no `.arr` element and no ◂ ▸ text in any `event-bar` segment of B.
- "positioned" checks `data-start-time`/`data-end-time` of the chip segment and that its top/height match the time
  grid (`data-hour-height` on `time-grid`) within ±3 px.
- "do not overlap": bounding boxes do not intersect. "side by side": both have a top within the other's vertical span
  and different left edges. "stacked on": the first chip starts lower and further right than the second, boxes overlap
  vertically, and the first's left edge lies inside the second's width (same column; cascade, feature event-display). "spans the full width": chip width ≥ 90 % of its day column width.
- "the items on D are shown in the order": DOM order of `data-title` of event chips and task list cards inside the
  month cell of D.

## Events: dialog

```
I start creating an event
I tap beside the dialog
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
a snackbar says {string}
the snackbar is drawn in the {scheme} theme
the event dialog is open
the event dialog is closed
the event dialog shows the error {string}
the calendar color swatch is {string}
the event form shows:
the event dialog is shown as a bottom sheet
the event dialog fits within the viewport
```

## Task lists

```
I start creating a task list
the new dialog opens as {string}
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
the task list {string} shows no done count
the task list {string} shows the progress ring
the task list {string} shows no progress ring
the task list {string} shows no progress bar
the task list {string} shows the progress bar
the task list {string} is announced as {string}
the task list {string} shows the item {string} below its title
the task list {string} shows the item {string} next to its title
the task list {string} does not show the item {string}
the task list {string} shows its title without overlap
the title of the task list {string} is not covered
the items of the task list {string} fade out towards the bottom
the task list {string} shows no overflow count
the collapsed task list {string} lists the items {string}
the collapsed titleless task list lists the items {string}
the titleless task list on {date} is labelled {string}
the titleless task list has no title row and shows no item as its title
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
I am told {string}
the task list {string} does not contain the item {string}
I rename the item {string} to {string}
I rename the item {string} to {string} but press Escape
I delete the item {string}
I drag the item {string} above the item {string}
I long-press the item {string} and drag it above the item {string}
I drag the item {string} and drop it where it was
I drag the item {string} over the gap between {string} and {string} and hold
the items {string} and {string} do not overlap the dragged item {string} and it lies between them
I tap the item {string}
I pick up the item {string}
I release the item without moving it
the item {string} is lifted
the item {string} has the drag handle {string}
I edit the task list details
I delete the task list
the task list tap setting is {string}
I tap the task list {string}
I tap the titleless task list
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
the expanded task list shows the real time block of the card {string} and a slimmer extension ending at its start
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
the titleless task list is expanded over the calendar
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

- "the titleless task list on D is labelled L": the one `tasklist-card` with `data-untitled="true"` on D has no
  `tasklist-card-title`, and its `tasklist-card-items` is visible with exactly the text L.
- Item drag (`tasklists-items.feature`): "I drag the item X above the item Y" = a mouse presses the item's `tasklist-item-grip`, moves in
  10 steps to just above Y's row (when X moves down: to the place of the item before Y) and releases; on the phone project the finger
  long-presses X's row (500 ms hold, CDP touch, as the calendar's drag steps) and moves the same way. It waits for the saved order
  (`PUT /api/tasklists/:id/items/order`, 200) and for `data-dragging` to go. "I long-press the item X and drag it above Y" = the
  same, phone project only. "drag X and drop it where it was" = away and back (a finger: held and released in place); no request
  is expected. "I tap the item X" taps its `tasklist-item-checkbox` (a short tap ticks and starts no drag). "I pick up the item X" =
  a finger held 500 ms on its title and kept down; "is lifted" = `data-dragging="true"` on its row; "I release the item without
  moving it" lifts the finger. "I drag X over the gap between A and B and hold" = grip (a finger: long-press) moved in 10 steps to the upper edge of B and kept down for 900 ms (released by the world's cleanup); "the items A and B do not overlap the dragged item X ..." = A's bottom <= X's top and X's bottom <= B's top (4 px tolerance for the 1.05 lift scale), i.e. the other rows made room. "has the drag handle L" = `aria-label` L on its `tasklist-item-grip`. In the Tasks view the same
  drag acts on the `tasklist-view` of that list's `tasks-item`.

"the task list X shows the done count" checks the expanded header if X is expanded, else the collapsed card.
"the task list X shows no done count / no progress ring" = the collapsed card has no `tasklist-card-count` / `tasklist-progress-ring` element (a list with exactly one item shows neither; the expanded list keeps both); "shows the progress ring" = the card has that ring element (some narrow variants hide it with CSS); "shows / shows no progress bar" = the card has / has no `tasklist-card-bar` element (the thin bar that narrow cards show instead of count and ring; a one-item list has none); "is announced as L" = the card's `aria-label` is exactly L ("T, 1 of 2 done"; a one-item list: "T, done" / "T, not done").
"the task list X shows the item Y below / next to its title": the `tasklist-card-item` with `data-title` Y in X's
collapsed card is visible and its box lies inside the card (an ellipsised name counts); "below" = its top
is at or under the bottom of `tasklist-card-title`, "next to" = it shares the title's line. "does not show the item Y": the
`tasklist-card-item` Y of X is not visible (it stays in the DOM for screen readers).
"the task list X shows its title without overlap": X's `tasklist-card-title` is visible and its box intersects no other
visible text part of the card (`tasklist-card-time`, `tasklist-card-items`, `tasklist-card-count`).
"for N minutes" sets the task list's estimate to N (a timed task list lasts its estimate).
Item steps act on the currently expanded task list.
"the task list tap setting is S" (S = `inline` | `drawer`): `PATCH /api/prefs { taskOpen: S }` as that person, before the view opens.
Expanded card (`tasklists-expand.feature`; feature tasklists-expand-card): "I expand the task list X" opens the list
sheet: it taps the card, waits for the grown card (`tasklist-expanded` with `data-presentation="overlay"`), taps it and waits
for the sheet; when the first tap already opens the sheet (growing is a Labs setting, off by default) it stops there. "I tap the task list X" is only the first tap; "I tap the expanded task list X" taps the grown card
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

## Repeating task lists (`@repeating`)

```
the calendar contains a weekly task list {string} on Mondays since {date} with items:
{string} of {string} was ticked on {date}
I rename the expanded task list to {string}
I am asked whether to change {string} or {string}
{string} is chosen
I choose {string} for the change
I cancel the choice
I am not asked which task lists to change
the task list {string} has no estimate
```

- The choice is `repeat-scope-dialog` (an `AdaptiveSheet`): radio options `repeat-scope-this` / `repeat-scope-following` (the
  `label` elements, `data-checked="true"` on the chosen one), `repeat-scope-ok`, `repeat-scope-cancel`.
- "weekly task list ... on Mondays since D": `POST /api/tasklists` with `recurrence: weekly` and `date: D`.
- "X of L was ticked on D": the occurrence of L listed by `GET /api/items?from=D&to=D+1` gets `PATCH .../items/<X>`
  `{ done: true }` (that week is split off, as a tick in the app does).
- "I rename the expanded task list to T": taps `tasklist-expanded-title` in the list sheet, fills
  `tasklist-expanded-title-input` with T and presses Enter.
- "I am asked whether to change A or B": the choice is visible and its two options read A and B. "A is chosen": the
  checked option reads A.
- "I choose A for the change": picks option A, presses OK and waits until the choice is gone and the write it sends has
  answered (with "This and all following task lists": the request with `?scope=following`); an item delete sends nothing before its undo time, so the
  step then only waits for the undo snackbar.
- "I am not asked which task lists to change": no `repeat-scope-dialog` in the page.
- "has no estimate": the card of T is visible and has no `tasklist-card-estimate`.
- "I add the item" and "I delete the item" (above) stop at the choice when one appears.

## Google (provider) side

```
Google contains an event {string} on {date} from {time} to {time}
Google contains an event {string} from {date} {time} to {date} {time}
Google contains an all-day event {string} from {date} to {date}
Google contains no event {string}
the Google event {string} has:
the Google event for the task list {string} is an all-day event on {date}
the Google event for the task list {string} is a timed event on {date} from {time} to {time}
the Google event for the task list {string} has the private extended property {string} set to {string}
the Google event for the task list {string} has the description:
the Google event for the task list {string} stores its items in more than one chunk
Google adds an event {string} on {date} from {time} to {time}
Google has an event {string} repeating every week from {date} from {time} to {time}
Google renames the event {string} to {string}
Google moves the event {string} to {date} from {time} to {time}
Google deletes the event {string}
Google adds a task list {string} on {date} with items:
Google ticks the item {string} in the task list {string}
Google renames the task list {string} to {string}
Google becomes unavailable
Google becomes available again
Google asks the app to slow down for the next sync
```

`Google asks the app to slow down for the next sync` → `POST /api/__test/rate-limit { "retryAfterSec": 4 }` (the next
provider call answers "rate limited", ADR 0007), then waits for two `/api/items` answers carrying `X-Stale: 1` (the
sync that hits the limit and one full poll inside the cooldown).

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
once the slow-down is over I see the event {string} on {date}
```

- "Google has an event T repeating every week from D from A to B": the mock Google gets one series (A–B on D, Berlin
  time) with `recurrence: ["RRULE:FREQ=WEEKLY"]` and none of the app's properties, as Google Calendar creates it.
- "I see the event T on each of D1, D2 …": for each date, opens its month view (if not already on screen) and the
  event's chip on that date is visible. "I move the T of D to D2": opens the month view of D and drags T's chip on D
  to the cell of D2 (like "I drag the event T to D").
- Network: `context.setOffline(true|false)`.
- `once the slow-down is over I see the event X on D`: waits until 4 s after the stale answer (the slow-down's end at
  the latest), then for the event chip within the poll interval + 5 s.
- Focus: dispatch `visibilitychange` (with `document.visibilityState` = `visible`) and `focus` on `window`.

## Last known state (`@last-known-state`)

```
I have seen the {view} view for {date}
the app has synced this device
I open the app again
the server answers only after {int} seconds
the server has answered
the language is changed elsewhere to {string}
I am told the calendar was last updated at {string}
I am not told when the calendar was last updated
this device keeps a last known calendar
this device keeps no last known calendar
```

- "I have seen the V view for D": opens that view (a month view opens D's month), waits until it has settled, then
  does what "the app has synced this device" does.
- "the app has synced this device" (ADR 0025): waits until the service worker controls the page (so the app shell also
  opens offline) and the device store has taken in a complete sync of every kind of data for the signed-in person
  (`<html data-device-store="synced">`, set after the IndexedDB write of a sync in which every kind succeeded; the
  attribute carries `data-device-synced-at`, which a later sync changes, so "I wait for the automatic sync" also waits
  for a newer value).
- "the language is changed elsewhere to L": `PATCH /api/prefs { language: L }` as the person using the app (as another
  device would), without touching the page; L is a language code (`de`, `en`).
- "I open the app again": reloads the page (the last opened view) and waits until a calendar view shows, not for the
  app to settle (its data may not come).
- "the server answers only after N seconds": `POST /api/__test/slow { ms: N*1000 }` (API.md); every later `/api` answer
  but `/api/__test/*` waits that long, until reset.
- "the server has answered": waits (slow-down + 10 s at most) until `sync-status` carries a `data-last-sync` (a fresh
  answer of this page) and is not `syncing`.
- "last updated at T": `last-updated-note` is visible and its text ends with T (`Last updated 08:12`); "not told": it
  is absent.
- "keeps a last known calendar": the device store (IndexedDB) holds data of a person; "keeps no ...": it holds none
  (or does not exist), localStorage has no `cal.devicePerson` and no cached theme of a person (`cal.theme` holds no own theme; the sign-in page may cache the default look).
- Device store window (ADR 0025): events from today - 1 year to today + 1 year; every task list regardless of date.

### Live sync (`@last-known-state`, rule "Live sync", ADR 0030)

```
the app is open on a second device
within a second the second device shows the event {string} on {date}
within a second the second device uses the dark theme
within a second the second device shows the Canvas area {string}
within a second I see the event {string} on {date}
within {int} seconds I see the event {string} on {date}
within a second the item {string} of the task list {string} in the Tasks view is ticked
the server asks Google for changes every {int} seconds
Google is not asked for changes during the next {int} seconds
Google is asked for changes within {int} seconds
the live connection is blocked
```

- "the app is open on a second device": a second browser context (no shared storage, as "I switch to another device")
  signed in as the same person (or the single owner when sign-in is off), opened on the view the first page shows
  (also the Canvas), waited until it has synced; the first page stays the current one. Steps with "the second device"
  read that page.
- "within a second ...": the same check as the plain step but polled for at most 1 s (the poll interval is off in these
  scenarios, so only the live connection can explain it); "within N seconds" polls for at most N s. The shown change
  must come without a reload and without a focus event.
- "the app is open on a second device" does not move "the current page"; "{string} opens ... on another device" (as
  today) does, so in the shared-list and other-person scenarios the other person's page is the one read.
- "the server asks Google for changes every N seconds": `POST /api/__test/config { "googlePollMs": N*1000 }`; the
  default without it is 20 s (unit-tested). Reset clears it.
- "Google is not asked for changes during the next N seconds": waits N s, then asks `GET /api/__test/remote/lookups`
  (the mock's counter of change lookups) and expects it unchanged. "Google is asked for changes within N seconds":
  waits until the counter has grown, at most N s.
- "the live connection is blocked": the page's request to the live-updates endpoint is aborted
  (`context.route`), so the app has to rely on its polling.
- Counting requests (section "Performance") is used with `/api/changes` to show that a device fetched nothing; the
  endpoint name follows the build (REQUIREMENTS "Live sync").

## Offline changes (`@offline-changes`, ADR 0025 slice 2)

```
this device keeps {int} unsent change(s)
this device keeps no unsent changes
I wait until the changes are sent
I close the app
I switch to the second device
I switch back to the first device
the second device does not show the event {string}
the server has the event {string} on {date} from {time} to {time}
the server has no event {string}
the server has the task list {string} with items:
the server has no task list {string}
the server refuses the next change as invalid
I am told that the change to {string} was not saved because it was deleted elsewhere
I am told that the change to {string} was not saved because the server refused it
I am not told that a change was not saved
I dismiss the notice
I press Edit again in the notice
the notice offers no Edit again
1 minute passes
I see the sync failed icon
I do not see the sync failed icon
I tap the sync failed icon
I am told the last successful sync was at {string}
the unsent changes list shows {string}
the unsent changes list is empty
Google deletes the task list {string}
they ask to sign out in the settings
they are asked whether to sign out and lose {int} unsent change(s)
they choose to stay signed in
they sign out anyway
```

- Hooks: `<html data-unsynced="N">` carries the outbox size for the waits; the icon is `sync-failed-icon` (top bar, beside
  `sync-status`), its popover `sync-failed-popover` with the time (`sync-failed-last`), one `sync-failed-change` per unsent change
  and `sync-failed-empty`. A refused change is a persistent snackbar `outbox-notice` (`outbox-notice-dismiss`,
  `outbox-edit-again`). There is no per-item mark and no counter.
- "this device keeps N unsent change(s)": the device store (IndexedDB) holds N outbox entries of the person, also while
  signed out or on the sign-in page; "keeps no unsent changes": it holds none.
- "N minutes pass" (existing, timeline) and "1 minute passes": with "the clock is running" the page's clock (Playwright `page.clock`) and the
  server-side test clock move on by N minutes; with the server's time frozen (the offline scenarios) only the page's own `Date.now` jumps
  (the app counts device time for the 5 minute rule); timers run in real time.
- "I see/do not see the sync failed icon": `sync-failed-icon` is visible / not in the page. It shows when no send or sync
  has succeeded for 5 minutes and goes at the next successful send or sync. "I tap the sync failed icon" opens its sheet.
  "told the last successful sync was at T": `sync-failed-last` ends with T. "the unsent changes list shows X": one
  `sync-failed-change` reads X (`<title> ticked`, `<title> created`, `<title> renamed`, `<title> changed`,
  `<title> deleted`); "is empty": none and the sheet says nothing is unsent.
- "Google deletes the task list T": deletes its Google event through `/api/__test/remote/*`.
- "I wait until the changes are sent": waits until `data-unsynced` is `0` (at most the poll interval + 5 s; the
  send is also started by `online`, focus and open).
- "I close the app": navigates the page to `about:blank` (the page unloads, the device store stays);
  "I open the app" (above) then loads it again. Deleting an item or entry enters the outbox when its undo time is
  over ("the undo time is over" is reused), never before.
- "I switch to the second device" / "I switch back to the first device": makes the page of "the app is open on a
  second device" (or the first page) the current one without reloading; the network steps act on the current page's
  context, so each device is offline on its own. "the second device does not show the event X": the second page
  holds no chip for X (read without reload or focus).
- Server checks ("the server has ..."): read through the test API (`GET /api/__test/remote/*`) for the signed-in
  person (or the single owner), never through the page; an item table compares `item`/`done` in order. "the server
  has the task list T with items" finds the list by title, dated or not.
- "the server refuses the next change as invalid": `POST /api/__test/refuse-next-write { status: 400 }` (API.md); the next write request the server receives answers `400 VALIDATION_ERROR`, later ones are
  normal.
- Notices: a persistent notice (`save-failed-notice`, not a snackbar that fades) naming the entry as the person last saw
  it on this device; "I dismiss the notice" presses its `save-failed-dismiss`; "not told that a change was not saved":
  no `save-failed-notice` is visible. "I press Edit again in the notice" presses `save-failed-edit`, which reopens the
  form of the failed change prefilled with what the person typed (an event or task list form; for something deleted
  elsewhere it is the new-entry form); the button exists only where the person typed something (not for a tick), "the notice
  offers no Edit again": the notice is visible and has no `save-failed-edit`.
- Sign out with unsent changes: "they ask to sign out in the settings" presses `settings-signout` (Account) and stops at
  the question (`unsent-changes-dialog`); "stay signed in" presses its Cancel, "sign out anyway" its confirm.

## Mobile

```
the page has no horizontal scroll
the view switcher is at the bottom of the screen
the create button is at the bottom of the screen
the navigation, view switcher and create buttons are at least {int} by {int} pixels
I swipe left on the calendar
I swipe right on the calendar
I swipe right from the left edge of the screen
I swipe up on the calendar
I start swiping left on the calendar by a quarter of the width
I start swiping left on the calendar by half the width
the week of {date} is shown beside the current one
no neighbouring period is shown beside the current one
I let go
I pinch out on the time grid to twice the size
one hour of the time grid has its default height
one hour of the time grid is about twice as tall as before
one hour of the time grid is still about twice as tall as at the start
the task list {string} is drawn a quarter as tall as the event {string}
the viewport meta tag contains {string}
the bottom bar reserves the safe-area inset at the bottom
the page does not bounce when pulled
nothing on the calendar screen can be selected by a long press
the text fields of the open form can be selected
the text in the open dialog can be selected by a long press
the text on the page can be selected by a long press
```

- "no neighbouring period is shown beside the current one": 200 ms after the last move, no `swipe-neighbour` is visible.
- "one hour of the time grid has its default height": within 10 % of the hour height measured before the scenario's
  first pinch.
- No horizontal scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
- "the page does not bounce when pulled": the computed `overscroll-behavior-y` of `<html>` is `none` (WebKit takes the
  page's overscroll behaviour from the root element only, `LocalFrameView::verticalOverscrollBehavior`; on `<body>` it
  is ignored there). A real pull cannot be made in the test browsers.
- "nothing on the calendar screen can be selected by a long press" (no dialog open): at every point of a 24 px grid over the viewport the topmost
  element (`elementFromPoint`) that is not a text field (`input`, `textarea`, `select`, `[contenteditable]`) has a
  computed `-webkit-user-select` (or `user-select`) of `none`; the failure lists the offending elements. (iOS starts its
  text selection only where the touched point is selectable; a long press itself cannot be made in the test browsers.)
- "the text in the open dialog / on the page can be selected by a long press": at every point of a 16 px grid over the
  open dialog (last `role=dialog`) or `section.page`, the topmost element that holds text of its own and is not a
  button (`button`, `[role=button]`) has a computed `-webkit-user-select` (or `user-select`) other than `none`; at least
  one such element is found. The grid is probed once the area's finite animations have finished (`getAnimations`,
  subtree): a phone sheet counts as visible while it still sits below the screen, sliding in.
- "the text fields of the open form can be selected": every visible `input`/`textarea` in the open dialog has a computed
  `-webkit-user-select` (or `user-select`) other than `none` (iOS refuses to edit such fields).
- "at the bottom of the screen": element's bottom edge is within the lowest 120 px of the viewport.
- Swipes dispatch `touchstart`/`touchmove`/`touchend` on `calendar-swipe-area` (CDP `Input.dispatchTouchEvent`):
  horizontal 200 px over 150 ms for left/right; vertical 300 px for up.
- "I swipe right from the left edge of the screen": touch at x = 3 px, 200 px to the right in 150 ms (what iOS delivers during
  its back gesture), then waits 800 ms.
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
the calendar contains a busy month around {month}
the phone's processor is {int} times slower
I start measuring long tasks
no task blocked the page for more than {int} ms
the long tasks took at most {int} ms together
the browser uses at most {int} ms of processor time in {int} seconds
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
- "busy month around YYYY-MM": through the public API (no plant bookkeeping), the same every run (seeded random) over the
  42 days of the month grid (from the Monday on or before the 1st): 6 to 15 timed events a day (07:00-20:00, 15-90 min),
  a task list with 2 to 6 items every other day, an all-day "Holiday" every fifth day, six multi-day all-day events
  and six birthdays in the Birthdays calendar (about 500 entries).
- "the browser uses at most M ms of processor time in N seconds": waits 1 s, then sums the CPU time of the renderer and
  GPU processes (`SystemInfo.getProcessInfo`, browser DevTools session) before and after N seconds of real time; the
  difference is reported as an annotation. Not combined with "the phone's processor is N times slower": Chromium's
  CPU throttling itself burns renderer CPU time.
- "the phone's processor is N times slower": `Emulation.setCPUThrottlingRate` on a DevTools session kept attached for
  the rest of the scenario.
- "long tasks": a `PerformanceObserver` for `longtask` entries (main-thread tasks over 50 ms) started by "I start
  measuring long tasks"; the checks wait 1.5 s for the page to settle, then judge the longest task or their sum.
- "phone performance audit": Lighthouse (mobile preset, simulated throttling) against the base URL; score = performance
  category × 100, run N times one after the other; the scenario judges the median (feature resource-efficiency). Runs in the Playwright container on Chromium with `--remote-debugging-port`.
- "I request "METHOD /path" on a fresh server": starts its own server process (`node --expose-gc server/dist/index.js`, the
  same `TEST_MODE` env as `e2e/run.sh`: `PROVIDER=mock`, `SEED=false`, `POLL_INTERVAL_MS=30000`, `NODE_ENV=production`, but a free
  loopback port and an empty temporary `DATA_DIR`), waits for `GET /api/health`, performs the request there (stored as the
  last response like `I request {string}`), then stops the process and deletes its data directory (feature resource-efficiency).
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
the settings page has no theme mode or seed colour controls
the server reports the build version {string}
the settings show the version {string}
the server offers an app signed with the certificate {string}
the settings show the app certificate {string}
the corner shows the version {string}
the settings screen is shown
the screen is {int} pixels wide
I open the settings page {string}
the page cannot be scrolled sideways
no settings row is wider than the screen
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
I switch to another device
the settings are changed elsewhere to the theme mode {string}
```

- `I open the settings` clicks `settings-button` in the top app bar; `I leave the settings` clicks `settings-back`
  (returns to the previous calendar URL, or `/` if none).
- Every "I choose ..." / "I enter ..." step waits for the `PUT /api/settings` response (status 200) before continuing,
  except the seed colour steps (`I choose the seed color preset`, `I enter the custom seed color`): the seed colour is
  fine-tuning of the chosen theme, so these wait for the `PATCH /api/prefs/theme` response (status 200) instead
  (feature theme-menu, owner 2026-10-13). A rejected custom color does not send a request.
- Theme modes are the labels `System`, `Light`, `Dark`. Seed presets are the labels `Blue`, `Purple`, `Teal`, `Green`,
  `Orange`, `Red`, `Pink`, `Slate`; a custom color is shown as `Custom`.
- Hue check: computes the HCT hue (Material color science) of the computed `--md-sys-color-<role>` and of the hex value
  and compares the circular difference (implementations may import the reference color utilities in the test code).
- `I switch to another device` creates a new browser context with the same project options (no shared storage) and
  a new page; all following steps act on it.
- `the settings are changed elsewhere to ...` sends `PATCH /api/settings` directly through the API.

### Settings groups and search (`@settings-groups`, `@settings-search`)

```
the settings groups are {string}
the settings home shows the search bar
the settings home is shown
I open the settings group {string}
the settings group page {string} is shown
I go back in the settings
the settings page shows the setting {string}
the settings page does not show the setting {string}
I turn off {string} in the settings
I open the calendar {string} in the settings
I choose the plan {string} in the settings
I pick the plan days {string} in the settings
the settings show the plan {string} for the calendar {string}
I choose {string} for {string} in the settings
{string} is chosen for {string} in the settings
every settings row shows its name first and its control at the end
I open the setting {string}
the time picker is shown
I search the settings for {string}
the settings search shows {string} in {string}
the settings search shows {string}
the settings search shows {int} result(s)
the settings search says nothing matches {string}
I clear the settings search
I choose the search result {string}
the setting {string} is highlighted
```

- Hooks: the home is `settings-home` with one `settings-group` per group (`data-group` = its visible name, in order;
  `data-group-id` = its route name); the search bar is `settings-search` (an input) with `settings-search-clear`; a
  group page is `settings-group-page` with `data-group` (its title) and `data-group-id` (`views`, `focus/bedtime`, …);
  each setting is a `settings-row` with `data-setting` = its visible name and `data-setting-id`; Back is
  `settings-back`. Every settings page keeps `settings-view` as its root.
- Steps of other features that use a settings control by its test id open the page that holds it first
  (`settingControl` in `support/settings.ts`, a test id → page table), and leave the settings with Back until no
  settings page is shown. `I turn on S in the settings` and `the S switch in the settings is off` reach row S through
  the settings search.
- `the settings groups are L` reads the `data-group` of the home's groups in order; from a group page it goes Back to
  the home first (inside the app, no reload).
- `the settings page shows the setting S` = a visible `settings-row` with `data-setting` S on the open group page.
- `I turn on|off S in the settings` toggles the switch inside the `settings-row` S and waits for the save response.
- A search result is `settings-search-result` with `data-setting` (name) and `data-path` (group, or
  `group › subgroup`); "shows N result(s)" counts them; "nothing matches Q" = no result and `settings-search-empty`
  contains Q.
- "is highlighted": the `settings-row` S carries `data-flash` and is inside the viewport.
- `I choose X for S in the settings` picks option X in the segmented button or menu of row S; `X is chosen for S`
  reads the selected option.
- "name first, control at the end": in every `settings-row` the label's left edge is left of the control's left edge
  (mirrored in left-handed mode is out of scope of this step).
- The calendar page: `I open the calendar C in the settings` taps the `settings-row` C on the Calendars page; the plan
  steps use the plan choice and the weekday chips (labels `Mon`…`Sun`) of that page; "shows the plan P for the
  calendar C" reads the supporting text of row C on the Calendars page.
- `the time picker is shown`: the M3 time picker sheet `time-picker` is open.

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
- The existing `the settings groups are`, `the period title is` and `the weekday headers are` steps are reused.

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
task categories are off
I open the Labs view {string} for {date}
the Labs view draws {string} in the colour of its calendar, never of its category
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
- "task categories are off": `PATCH /api/prefs { "taskCategories": false }` through the API before the page is opened.
- "I open the Labs view V for D": opens the Labs view by its path (`clock` = `/clock/D`, `timeline` = `/timeline`,
  `strip` = `/strip/D`, `zoom month` = `/zoom/D`, `horizontal` = `/horizontal/D`; Labs views are always routable) and
  waits for its root (`clock-view`, `timeline-view`, `strip-view`, `zoom-view`, `htime-view`).
- "the Labs view draws L in the colour of its calendar, never of its category": takes L's `color` (category) and
  `calendarColor` from `GET /api/tasklists/all-open`; inside the view root, the colours each element is drawn with (computed
  `color`, `background-color`, the border and outline colours, SVG `fill` and `stroke`, and the `--c` item colour) include
  the calendar colour and never the category colour (compared as sRGB; polled).

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
{int} seconds pass
```

- `the time is D T and the clock is running`: `POST /api/__test/clock { now, frozen: false }` **and** install a fake
  browser clock at the same instant before the page opens (Playwright `page.clock.install({ time })`), so app timers
  only advance when the test says so.
- `N minutes pass`: `page.clock.runFor(N * 60_000)` and `POST /api/__test/clock { now: previous + N min, frozen: false }`
  so server and browser stay in step. `N seconds pass`: the same with N * 1 000 ms.

## Timeline and Now card

```
the event {string} is about {int} times as tall as the event {string}
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
the open tasks tray is expanded
I collapse the open tasks tray
the open tasks tray is at most {int} px wide
the task list {string} is highlighted in the open tasks tray
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
the task list {string} in the open tasks tray shows no done count
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
- "I collapse the open tasks tray": clicks `task-tray-toggle` when the tray is expanded (desktop side panel or phone bar).
  "is expanded"/"is collapsed" = `data-expanded` of `task-tray` is `true`/`false` (on the desktop the persisted collapsed state).
- "is at most N px wide": polls the tray's box width and the `--tray-w` on :root (the FAB's clearance) until both are <= N.
- "the task list L is highlighted in the open tasks tray": the `task-tray-item` of L gets `data-flash` (within the
  default timeout; it clears after about a second) and no `tasklist-expanded` list sheet is open.
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
I slowly drag left with the mouse in the month picker
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
- "I slowly drag left with the mouse in the month picker": a mouse drag of 200 px to the left across the picker that
  takes 900 ms from press to release (half the way, a pause, the rest).
- "the page is not scrolled": `document.scrollingElement.scrollTop === 0` and `scrollHeight <= innerHeight`.
- "the bottom bar ends at the bottom of the viewport": `bottom-bar` bottom edge equals `innerHeight` (±1 px).

## ADHD support, settings additions

```
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
  timer helper; feature resource-efficiency).
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
I drag the bar {string} by its day {date} to {date}
I drag the task list {string} to {date} at {time}
I drag the event {string} back and forth {int} times
I pick up the event {string}
I pick up the event {string} in the {view} view for {date}
I release the event without moving it
the event {string} is lifted
the finger is on the event {string}
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
I tap the event {string} right beside the bottom handle of {string}
I hold the event {string} over {date}
the dragged event is drawn visibly in the day under the finger
I swipe up quickly starting on the event {string}
the time grid has scrolled down
I drag the event {string} to {date} with a finger held perfectly still
the browser did not take the touch over for scrolling
```

- Desktop project: mouse (`mouse.down` on the chip centre, move in 10 steps to the target, `mouse.up`). The target is
  the `time-slot` of the date/hour plus the minute offset (quarter-hour precision), or the `month-cell` /
  `week-allday-cell` of the date.
- Mobile project: CDP touch events: `touchStart`, hold 500 ms (long press), `touchMove` in 10 steps, `touchEnd`.
- iPhone project (`iphone`, WebKit with the iPhone 13 profile; runs only scenarios tagged `@iphone`): Playwright has no
  touch moves for WebKit, so the finger is a model of iOS WebKit (`e2e/steps/support/iosTouch.ts`) that dispatches
  `pointerdown`/`touchstart`, `pointermove`/`touchmove`, `pointerup`/`touchend` (pointer events first) at the element
  under the finger, with these WebKit rules (UIProcess sources, WebKit bugs 184250/185656):
  - touch moves are cancelable only when a non-passive `touchmove` listener was on the touched element's path (element,
    ancestors, document, window) at `touchstart`; listeners on window/document/body without `passive` count as passive.
  - the native pan may be stopped only by the first `touchmove` of the touch: when that one is not default-prevented,
    the pan starts at the first move more than 10 px from the start; it then sends `pointercancel` when the move has a
    vertical part (the calendar area is `touch-action: pan-y`), no more pointer events follow, later touch moves are not
    cancelable, and the nearest ancestor whose computed `overflow-y` is `auto`/`scroll` scrolls with the finger.
  - a real finger is never still: the long press (500 ms) has two moves of 1 and 2 px in it.
  Because of these small moves the model always starts its pan once the lifted card moves, so the ordinary drags test
  the drag's way through `pointercancel`; only "with a finger held perfectly still" (no small moves) tests that the
  card's own touch listener lets the drag stop the pan.
- "I drag the event X to D with a finger held perfectly still": as "I drag the event X to D", but the iPhone model's long
  press has no small moves (CDP touch has none anyway). Every `pointercancel` from then on is counted; "the browser did
  not take the touch over for scrolling" = none was sent.
- "I hold the event X over D": long press X and move the finger to the centre of D's `month-cell` in 10 steps, finger
  kept down (released by the scenario's cleanup). "the dragged event is drawn visibly in the day under the finger": the lifted
  chip's centre lies in the `month-cell` under the finger (it snaps to the cell's top), and the topmost element there
  (`elementFromPoint`, which honours clipping) is the chip or inside it.
- "I swipe up quickly starting on the event X": finger down 5 minutes below X's top, 240 px up in 8 moves over 150 ms
  (no long press), up. The time grid's scroll position is noted first; "the time grid has scrolled down" = the
  `time-grid`'s scroll container `scrollTop` grew by at least 40 px.
- After a drop the step waits for the `PATCH` response (or failure) and for the chip to settle (`data-dragging` absent).
- "lifted": `data-dragging="true"` on the chip (the app sets it on pick-up). "pick up" = scroll the chip into view, press and hold 500 ms
  without moving; "release without moving" = mouse up / touch end.
- "I pick up the event X in the week/day view for D" opens that view (as "I open the ... view") and then picks X up; any other
  view is an error (it needs a time grid).
- "the finger is on the event X" (after "I pick up"): X is lifted, narrower than 90 % of its day column (side by side),
  and, once the card has settled (its box unchanged over 150 ms, at most 3 s), the point where it was pressed lies
  inside X's chip box.
- "haptic tick": an init script wraps `navigator.vibrate` and records calls; at least one call with a duration ≤ 30 ms.
- "back and forth N times": N moves of +1 day and −1 day alternately (each persisted).
- "X shows resize handles in the day/week view for D" (Given): opens that view, picks X up and releases it without
  moving, then checks the handles are shown. "shows resize handles" = both `resize-handle-top` and
  `resize-handle-bottom` of X are visible; "shows no resize handles" = neither is.
- "I tap the event X right beside the bottom handle of Y": tap (touch on the phone, click on desktop) inside X's chip
  box 3 px from its left edge, at the vertical centre of Y's `resize-handle-bottom`; the point must lie inside X and
  within 22 px of Y's horizontal centre (a centred 44 px handle on Y would have covered it).
- "I drag the top/bottom handle of X up/down by N minutes": press on the handle centre (mouse; touch without the
  long press) and move N minutes of grid height in 10 steps, release; then wait for the save as after a drop.

- On a phone the day view has a single column, so the "back and forth N times" step first switches client-side (no
  reload) to the week view.
- "I tap beside the dialog": clicks `sheet-scrim` at a point outside the open dialog's panel.

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
the streak is set to {string}
I choose {string} for the streak
the streak choice {string} is selected
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

- Streak choice (person pref `streak`: `Off` = `off`, the default; `Flame` = `flame`; `Plant` = `plant`). `the streak is
  set to X` (Given) sends `PATCH /api/prefs { streak }` through the API before the page is opened. `I choose X for the
  streak` picks the option labelled X in `settings-streak` (a segmented button in Focus & motivation; the settings are
  open) and waits for the `PATCH /api/prefs` response (200); `the streak choice X is selected` = that option has
  `aria-pressed="true"`. The steps `I see / do not see the streak flame` and `I see / do not see the plant` check
  `streak-flame` and `plant-button` in the top bar. `I choose X for the sunflowers` picks the option with that
  label in `settings-sunflowers` (`Grow with points` = `grow`, `Full field` = `full`); `the sunflowers are set to X`
  (Given) does it with `PATCH /api/settings { sunflowers }`. `the scene is X` (Given) sets the person's scene with
  `PATCH /api/prefs/theme { overrides: { scene } }`; X is `Sunflower field`, `Mordor` or `None`, or (feature header-layout) any
  season or holiday scene by its theme name: `Halloween`, `Spring`, `Summer`, `Fall`, `Winter`, `Easter`, `Summer holidays`,
  `Christmas`, `New Year's Eve`, `New Year` (the seasons and holidays are switched off in the same request, so the
  chosen scene stays).
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
they sign in with Google again
{string} is also signed in on another device
they sign out everywhere in the settings
the other device is signed out too
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
another app exchanges the code
the app is asked to sign in again
```

- Google is the mock provider with one calendar per person (`TEST_MODE`); "signs in with Google" completes the OAuth
  round trip through the test double, no real Google. "they" is the person of the last sign-in step.
  It opens the week view first; signed out, the app may leave it for `/signin` with a full page load before it has
  loaded (after a sign-out on this page), which the step takes as the way to the sign-in page.
- "may use the calendar": the allow-list of sign-in addresses for the scenario.
- "cannot be read without signing in": a request to the events API without a session is refused as unauthenticated.
- "is also signed in on another device": a second browser context of its own (not the page) signs the person in through the OAuth
  round trip, so the person has two sessions. "they sign out everywhere in the settings": opens Settings and presses
  `settings-signout-all` (Account); the page ends on the sign-in page. "the other device is signed out too": that second
  context's `GET /api/auth/me` answers 401.
- "their session expires": the browser loses the session cookie (all cookies of the page's context are cleared), so the
  next request is refused as unauthenticated; a page that is already open keeps its old state (the stale shell).
- "they sign in with Google again": on the sign-in page that is already shown, presses `signin-google` as the person of
  the last sign-in step (no page is opened first, so the page the person was sent away from stays the place to return
  to) and waits for the calendar.
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
- "every entry in the month cell of D can be seen at least in part": the `month-cell-entries` box counts the entries it
  left out (`data-more` > 0), every entry still in it (`[data-title]` child) starts above the box's bottom edge, and the
  first left-out entry (2 px below the last built one) would start at or below that edge (0.5 px tolerance).
  "leaves out the entry T": no element with `data-title` T inside the month cell of D.
- "stay unchanged for N seconds": a `MutationObserver` on `month-view` sees no childList change and no real change of a
  `data-*` attribute (`data-tier`, `data-fit`, `data-fade`) for N seconds: layout tiers settle instead of flipping.
- "the browser window is W by H pixels wide and high" resizes the viewport (use before opening a view).


## Calendar off by a plan (`@id:calendar-off-plan`, @backlog)

```
I long-press the calendar chip {string}
I tap the calendar chip {string}
I choose {string} in the calendar sheet
I pick the date {date} in the calendar sheet
I pick the days {string} in the calendar sheet
the calendar {string} is on only on {string}
the calendar {string} is off until {date}
the calendar chip {string} is on
the calendar chip {string} is off
the calendar chip {string} shows {string}
the calendar chip {string} shows that it switches by itself
the calendar chip {string} does not show that it switches by itself
```

- The chip is `filter-chip-calendar` with that `data-name` (shown first with "I show the filters"). "long-press": touch
  (mobile) or mouse held 500 ms without moving; it opens `calendar-plan-sheet` (an `AdaptiveSheet`). "tap" = a click.
- "I choose X in the calendar sheet": the button or radio with the visible label X inside `calendar-plan-sheet`
  ("Always on", "Off for a while", "Only on some days", "Done"); "Done" waits for the saved plan (`PATCH` of the
  calendar, 200) and the sheet to close. "I pick the date D": the date field `calendar-plan-until` set to D (the day
  the calendar is back on). "I pick the days S": the weekday toggles `calendar-plan-day` (`data-day` `Mon`..`Sun`)
  end up pressed exactly for the space-separated short names in S.
- Givens set the plan through the API as the app would (`plan: { kind: "days", days: [...] }` / `{ kind: "until",
  date }`, exact shape in `spec/API.md` when built).
- "is on / off": `aria-pressed` of the chip. "shows X": the chip's visible text contains X. "shows that it switches by
  itself": the chip contains `calendar-plan-mark`; "does not": no such element.
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

Birthdays made in Google Calendar (`@google-birthdays`):

```
the calendar {string} has a birthday {string} on {date}
the calendar {string} has a birthday {string} on {date} linked to a contact
I choose {string} in the create menu
I enter the birthday name {string}
I change the birthday name to {string}
I set the birthday date to {date}
I save the birthday
the birthday date cannot be changed
the birthday name can be changed
the event {string} is shown on {date}
Google has a birthday {string} repeating every year from {date}
Google has the birthday {string} with the rule {string}
Google has no birthday {string}
```

- "the calendar C has a birthday ...": inserts into the calendar named C (as another Google client) a yearly all-day event
  with `eventType` birthday, `birthdayProperties.type` birthday (plus `contact` for "linked to a contact"), private and
  transparent.
- "I choose X in the create menu": clicks `create-button`, then the segment of the "new" dialog's switch (Event
  `new-kind-event`, Task list `new-kind-tasklist`, Birthday `create-birthday`; the app has no separate menu), and for
  Birthday waits for `birthday-dialog`.
- The birthday dialog is the event dialog in birthday mode: `birthday-dialog` (instead of `event-dialog`), name
  `birthday-name`, date `birthday-date`, colour `event-color`, `birthday-save`, `event-delete`, `event-cancel`;
  `birthday-date-locked` is the hint shown (with `birthday-date` disabled) for a birthday linked to a contact. "I open the
  event" and "I delete the event" work in both dialogs. "I save the birthday" waits for the dialog to close.
- "the event is shown on D": opens the month view of D and expects a visible chip of the event on D.
- "Google has a birthday T repeating every year from D": the mock Google holds exactly one live series named T with
  `eventType` birthday, start date D and `RRULE:FREQ=YEARLY`; "with the rule R" compares its `recurrence`; "has no
  birthday": after the pending delete was sent (undo time over), none is left.

- "the Birthdays calendar has ...": adds Google's contacts calendar (`addressbook#contacts@group.v.calendar.google.com`,
  read-only, colour `#9fc6e7`) on first use and inserts a yearly all-day entry with `eventType` birthday and
  `birthdayProperties.type` birthday / anniversary, as Google makes it from a contact.
- "is marked as a birthday / an anniversary": the first visible chip of the event has `data-special` birthday /
  anniversary and a marker (`event-marker`) 🎂 / 💍; "is not marked": no `data-special` and no marker.
- "the event dialog is read-only": the details view (`event-readonly`) is shown instead of the form; "no save or delete
  button": neither `event-save` nor `event-delete` exists.

## Only own events are editable (`@events-readonly`)

```
the calendar contains an event {string} on {date} from {time} to {time} organised by {string}
the calendar contains an event {string} on {date} from {time} to {time} organised by {string} with guests allowed to edit
a calendar {string} shared with me with edit rights by {string}
a calendar {string} shared with me read-only by {string}
the calendar {string} contains an event {string} on {date} from {time} to {time}
I start a new event
I try to rename the event {string} through the API
the API answers {int}
the event dialog is editable
the read-only reason says {string}
the calendar picker does not offer {string}
```

- "organised by E": inserts the event into Google (primary calendar) with `organizer: { email: E }` (not `self`);
  "with guests allowed to edit" adds `guestsCanModify: true`.
- "a calendar C shared with me with edit rights by E": adds a calendar to the mock account's list with id E (another
  person's primary calendar), `accessRole` writer and owner address E (`POST /api/__test/remote/calendars` with
  `accessRole`, `ownerEmail`).
- "a calendar C shared with me read-only by E": the same with `accessRole` reader.
- "the calendar C contains an event ...": inserts into the calendar named C as another Google client would.
- "I start a new event": opens the week view and the "new event" dialog (`create-button`, `new-kind-event`).
- "I try to rename the event T through the API": `PATCH /api/events/:id` with a new title, without the UI; "the API
  answers N" compares the status of that call.
- "the event dialog is editable": `event-save` is visible and `event-readonly` does not exist. "the read-only reason
  says R": `event-readonly-reason` has exactly that text. "the calendar picker does not offer C": once the own
  calendars are loaded (the picker `event-calendar` lists "Work"), no option is named C.

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
the arcs of {string} are on different rings
the arcs of {string} and {string} are on the same ring with a gap between them
no two arcs on the clock cover each other
the calendar contains these events on {date}:
every arc on the clock is named on the dial or next to it
no two names on the clock overlap
I open the rings clock for {date}
no name on the clock is upside down
the clock lists {string} next to the dial
I tap {string} in the list next to the clock
I tap the arc of {string}
I turn the arc of {string} to {time}
I select the arc of {string}
I drag the start handle of {string} to {time}
I drag the end handle of {string} to {time}
I tap the clock at {time}
the middle of the clock says {string}
the middle of the clock says {string} over {string}
the first line in the middle of the clock is {string} cut short with {string}
the second line in the middle of the clock is {string}
the clock shades no time
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
the approach bar shows its entries in {int} rows
no bar of the approach track lies on top of the month picker
the approach bar shows {int} entries
on the approach bar no title is covered by another bar
on the approach bar {string} is {int} times as long as {string}
the title of {string} is shown next to its block
on the approach bar {string} starts at now and shows {int} minutes
I open the timeline view
{string} comes before {string} on the timeline
the now marker is before {string} on the timeline
on the timeline {string} and {string} are side by side
on the timeline {string} is farther from {string} than {string} is from the now marker
on the timeline {string} is about {int} times as long as {string}
{string} is in the all-day band above the timed entries
the timeline runs from top to bottom
the title of {string} on the timeline reads left to right in one line
I scroll the timeline {int} days ahead
I scroll the timeline {int} days back
{string} is visible on the timeline
I open the strip view for {date}
I see the event {string} in the strip column of {date}
I scroll the strip one day to the right
the strip column of {date} is in front
the page did not reload
in the strip {string} is about {int} times as tall as {string}
{string} is in the strip's all-day band
the hour lines of the strip columns of {date} and {date} are at the same height
the all-day bands of the strip columns of {date} and {date} are equally tall
I open the Now view
the Now card shows {string} with {string}
the time bar of the Now card is {int} % full
I tap the Now card
the Next card shows {string} in {string} at {time}
the Now card shows the task list {string} with its next task {string}
the Now card says {string}
the Later card says {string}
I unfold the Later card
the Later card lists {string}
the Now card says that {string} is also running
the top bar has no date navigation
the top bar shows no date
the top bar names the view {string}
I open the zoom month for {date}
the zoom month shows {string}
the zoom month shows the whole month
the zoom month cell of {date} has {int} entries
the zoom month shows no start times
I zoom the zoom month in until the start times show
I zoom the zoom month in until the task list items show
I zoom the zoom month in until three and a half day columns fit across the screen
the zoom month cells of {date} and {date} both show the timeline
no visible zoom month cell shows chips
the timelines of {date} and {date} start at the same hour
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
I open the runway
the runway reads {string}
the runway says {string}
{string} is above {string} on the runway
I tap {string} on the runway
on the runway {string} is about {int} times as tall as {string}
I note the height of {string} on the runway
{string} is taller on the runway than noted
```

- Zoom switch (feature zoom-month): "until three and a half day columns fit across the screen"
  zooms in (Ctrl+wheel at the cell of the opened date) until a zoom month day cell's width is at most viewport width / 3.5
  and waits for the gesture to settle. "both show the timeline": each cell contains a visible `zoom-timeline`. "no
  visible zoom month cell shows chips": no cell intersecting the viewport shows its compact chip list (opacity > 0.5).
  "start at the same hour": the first hour label (or `data-start-hour`) of both cells' `zoom-timeline` is equal.

- Clock: `clock-arc` per event and per timed task list (`data-title`, `data-start`, `data-end` as HH:MM, `data-kind`
  `event|tasklist`), `clock-hand` (`data-time` HH:MM). "lists X without a time": a `clock-untimed` chip with that text (next to the dial).
  "fills the available space": the dial's diameter is ≥ 90 % of the smaller side of the view's content area.
- Clock gestures: points on the dial are computed from the minute and the arc's `data-r` (viewBox radius) through the
  dial's screen matrix. "tap the arc" = a tap/click on the middle of the arc; "turn the arc of X to T" = press 5 minutes
  after its start, hold 500 ms (long press), move round the dial in 5-minute steps the short way to T (+ the same offset)
  and release; "select" = a long press released in place (the arc gets `data-selected="true"` and `clock-handle`s with
  `data-edge` `start|end`); "drag the start|end handle" = press the handle and move round to T; "tap the clock at T" =
  a tap on the plate at radius 120. Touch projects use CDP touch events, others the mouse.
- Clock rings (owner 2026-10-23): each `clock-arc` path is measured as rendered: its radius is the mean distance from
  the dial's centre (viewBox 220, 220) of 33 points along it (`getPointAtLength`), its drawn span the unwrapped minutes
  of those points, its band the rendered stroke width (`data-r` / `data-w` / `data-draw-*` carry the intended values
  for debugging). "on different rings": pairwise different radii (rounded). "cover each other":
  two arcs whose bands overlap radially (|r1 − r2| < (w1 + w2) / 2) and whose drawn spans overlap. "the same ring with
  a gap": equal radii and the first one's drawn end lies before the second one's drawn start. "is not covered by":
  the two do not cover each other. "these events on D:" a table `title | from | to`, created like the single-event
  step. "named on the dial or next to it": each arc's title has a visible `clock-label` or a visible
  `clock-overflow` chip (`data-title`, text "HH:MM title"), and at least half of the arcs are named on the dial. "no
  two names overlap": no character box (SVG extent of each character, on screen) of one `clock-label` overlaps one
  of another or of `clock-time` / `clock-now-line` / `clock-now-when` (the middle), by more than 1 px. "I open the rings clock for D" opens `/clock-rings/D`
  (`clock-view` with `data-variant="rings"`). "upside down": a `clock-label`'s first character lies right of its last
  one by more than the text's vertical run (its reading direction points into the left half-plane).
- "the clock lists T next to the dial": a visible `clock-overflow` chip with exactly the text T ("HH:MM title"); "I tap
  X in the list next to the clock" clicks the `clock-overflow` chip with `data-title` X. Entries on rings beyond the
  narrowest band (6 on the clock, 4 on the rings clock) have no arc and are only listed.
- Labs labels to ids: a Labs view label is turned into its id by lower-casing it and joining its words with "-"
  ("Clock: rings" → `clock-rings`).
- Both "the middle of the clock says" steps first wait for `clock-view` `data-tomorrow-loaded="true"` (today's clock
  sets it once a cached range holds tomorrow, whose first entry the middle may name).
- "the middle of the clock says X": exactly one line, `clock-now-line` text X, and no `clock-now-when`. "says X over
  Y": `clock-now-line` text X and `clock-now-when` text Y, the second below the first. "the first line ... is T cut
  short with E": `clock-now-line` text ends with E, is shorter than T, and without E is the start of T; "the second
  line ... is Y": `clock-now-when` text Y. "shades the time until T": `clock-wedge` `data-to`; "shades no time": no
  `clock-wedge`. All-day events: `clock-allday` (`data-title`).
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
- Timeline Today (`@id:labs-timeline`, owner 2026-11-01): "I scroll the timeline N days ahead / back" sets the
  `timeline-scroll` `scrollTop` by N times the height of one `timeline-day` (waiting for the range to extend at the
  edges), then waits for the scroll to settle. "X is visible on the timeline": its `timeline-item` lies inside the
  scroller's box. "I go to today", "the now marker is visible on screen" and "I do not see the now marker" are the
  shared steps; on the timeline the marker is `timeline-now`, and "I do not see" means it lies outside the
  `timeline-scroll` box (the timeline keeps it in the page). The timeline top bar has `nav-today` but no `nav-prev` /
  `nav-next`; "the top bar shows no date": `view-title` is visible and there is no `period-title`.
- Timeline (owner): vertical axis on every device (`timeline` has `data-orientation="vertical"`, later items have larger y);
  "reads left to right in one line": the item's title is not rotated and its text box is wider than tall.
- Date-less Labs views (Now, Timeline): the top bar title is the heading `view-title` with the view's name (no
  `period-title`); "has no date navigation" = no `period-title`, `nav-prev`, `nav-next`, `nav-today` in `top-bar`. "says that X is also running": `nownext-also` lists the other
  running events, its `data-titles` = the titles joined with ", ".
- Now view (`@now-next`): "I open the Now view" goes to `/now` and waits for `nownext-view` with `data-loaded="true"`.
  Cards: `nownext-now` (`data-kind` `running|tasks|free`, `data-title`), its `nownext-now-left` text and
  `nownext-bar` (progressbar, `aria-valuenow` = % of the event still left, "N % full" allows ±1);
  `nownext-task` (first unticked item); `nownext-next` (`data-title`) with `nownext-next-in` ("in …" text, compared
  as "in <duration>") and `nownext-next-time`; `nownext-later` with `nownext-later-toggle` (`aria-expanded`) holding
  `nownext-later-more` ("N more") and, unfolded, `nownext-later-item` rows (`data-time`, `data-title`), listed as
  "HH:MM Title". "the Now card says" compares its main line `nownext-now-line` exactly, "the Later card says"
  `nownext-later-more`. "the task list X with its next task Y": `data-kind="tasks"`, `data-title` X, `nownext-task`
  `data-task` Y.

- Labs switches: `settings-labs` (master), `settings-labs-view-<id>` per registry view (`clock`, `timeline`, `strip`,
  `zoom`, `horizontal`, `runway`). The view switcher's Labs tabs are `view-switch-<id>` with `data-experimental="true"`.
- Labs switches: `settings-labs` (master), `settings-labs-view-<id>` per registry view (`clock`, `clock-rings`,
  `timeline`, `strip`, `zoom`, `horizontal`). The view switcher's Labs tabs are `view-switch-<id>` with `data-experimental="true"`.
  `zoom`, `horizontal`, `now`). The view switcher's Labs tabs are `view-switch-<id>` with `data-experimental="true"`.
  "no bar of the approach track lies on top of the month picker": every `approach-block` whose centre lies inside the open
  `month-picker` box must hit-test (`elementFromPoint`) to the picker (at least one `approach-item` is shown).
  "on the approach bar no title is covered by another bar": the text of every `approach-item` (the title inside its block or
  `approach-title` beside it) hit-tests at its centre (`elementFromPoint`) to that same item.
  "the approach bar shows its entries in N rows": the `approach-item` chips occupy exactly N distinct vertical
  positions. "on the timeline A and B are side by side": the two `timeline-item`s overlap vertically and not
  horizontally.
- Runway (feature labs-bedtime-runway): "I open the runway" opens `/runway` and waits for `runway-view`. "reads" is the
  exact text of `runway-header`; "says" the exact text of `runway-message` (the off / after-bedtime state). Entries are
  `runway-entry` (`data-title`) inside `runway-bar`; "above" compares their top edges, "about N times as tall" is a
  ±15 % ratio of their heights, "taller than noted" compares with the height noted before. "I tap X on the runway"
  clicks the middle of its entry.

## App updates

```
a new version of the app is deployed
the app syncs
I am told a new version is available
I am not told a new version is available
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
  the visible `undo-snackbar` message (`snackbar-text`). "a snackbar says" = any visible snackbar message
  (`snackbar-text`) with exactly that text (e.g. "Saved as template").

## Theme menu (`@themes`)

```
I open the theme menu
I choose the theme {string}
I chose the theme {string}
I export the theme {string}
the theme file {string} is downloaded
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
the seasons and holidays follow the calendar
the seasons and holidays are set to {string}
the advent timeline shows {int} lit candle(s)
the Christmas tree lights are on
the Christmas tree lights are off
the preview event is drawn as an outline
the event {string} is drawn as an outline
the event {string} glows
the event {string} does not glow
{string} may use the calendar
{string} may no longer use the calendar
I set the {string} slider to {int}
the {string} slider shows {string}
the {string} slider is disabled
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
  `cal_session` cookie. The start carries the app's challenge (`challenge=base64url(SHA-256(verifier))`). "exchanges the code" = the page opens `/api/auth/app-exchange?code=...&verifier=...` (the deep link's effect plus the verifier the app kept); "another app exchanges the code" = the same without the verifier;
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
  "the seasons and holidays follow the calendar" (Given): the same with `seasonal: 'all'`, the default of a new person, for a scenario whose Background turned them off;
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
the top bar scene is moving
the top bar scene is still
the scene's cat is moving
a visitor passes through the top bar scene
the visitor flies across the top bar scene
the top bar scene shows the {string}
the top bar scene shows {int} {string} at rest
the {string} of the top bar scene glide to their resting spots within {int} second(s)
the {string} of the top bar scene runs the full width of the bar
the {string} of the top bar scene is drawn at its full size
the {string} of the top bar scene are spread over the whole bar
the top bar scene is drawn mirrored
the support cat comes by on the next finished list
the support cat is set to {string} in the settings
the support cat appears and is gone within {int} ms
the support cat does not appear
I finish the task list {string} on {date}
the title of the task list {string} is not struck through
the title of the task list {string} is struck through
I pick up the event {string} and move it down by {int} hours
the support cat pushes the card from above
I hold the dragged card still for {int} second(s)
the support cat sits beside the card with a paw on it
the support cat is gone within {int} ms
```

- "the top bar scene is moving": at least one CSS animation (`document.getAnimations()`) whose target is inside
  `top-bar-scene` has `playState` `running`. "is still": none is running and there is no `butterfly`, `bat` or `ghost`
  part; `html[data-scenes]` is `still`. Both first wait until the scene has drawn a `data-part` (the lazy chunk has
  rendered), then poll up to 5 s. "the scene's cat is moving": the same as "is moving", counting only animations
  inside the scene's `cat` part (the living layer, not the backdrop). "a visitor passes through": a `butterfly`, `bat` or
  `ghost` part is visible in the top bar scene (the fake clock holds the visit while the step looks).
  "the visitor flies across": the visitor's flight animation (Web Animations API, the one that is not the wing flap)
  is paused and sought to 5 %, 10 % ... 95 % of its duration; at each point the visitor's box is read. Its horizontal
  centre must reach the scene's left quarter and its right quarter, and from 20 % to 80 % its box lies fully inside
  the scene's box. A visitor without a flight animation fails.
- A seasonal scene's visitor passes once at the start of each moving window (Mordor keeps its rhythm: first after
  20-60 s, then every 3-5 min). The scene step sets `window.__butterflyNow = true` before loading so the "butterfly"
  part is present for the check at once (at Halloween it makes the visitor the bat, not the ghost).
- Scene parts are elements in the top bar scene with `data-part` (e.g. `sprouting-tree`, `lily-of-the-valley`,
  `sunflower`, `sun`, `butterfly`, `cat`, `jack-o-lantern`, `bat`, `moon`, `ghost`; the holiday scenes have `easter-egg`,
  `hare`, `first-flower`, `sea`, `beach-umbrella`, `advent-candle`, `xmas-tree`, `snow`, `firework`, `skyline`,
  `star`, `sunrise`, `confetti`, `hill`; the sunflower field scene also has
  `sky`, `hills`, `cloud` and `bee`); the step lowercases and
  hyphenates the names (and drops apostrophes). Bats use the butterfly hook (`window.__butterflyNow`). "I choose the theme" without
  a prior "I open the theme menu" opens it from the week view for today first.
- Fall and Winter props and still picture (rules at the end of theme-scenes.feature, round 3): the props are parts
  `autumn-tree`, `leaf-pile`, `kite` (Fall), `snowy-tree`, `snowman`, `sledge` (Winter); the ground is `leaf-litter`
  (Fall) and `snow-drift` (Winter); the visitors are `bird-flock` (Fall) and `robin` (Winter). Part names are the
  label lowercased and hyphenated. "leaves" are the nine particles of the Fall scene (`.season.fall .p`),
  "snowflakes" those of the Winter or Christmas scene (`.season.winter .p`, `.season.christmas .p`). A part counts
  as shown when it is visible (not `display: none`, not `visibility: hidden`).
  A part the scene left out because it would be under a control carries `data-hidden` (and is hidden); another part
  of its kind may still show. "the top bar scene shows the X": a visible part X without `data-hidden` lies at least
  1 px inside the `top-bar` box (a visitor: waits up to the step timeout for it to come in). The four-part step "the
  top bar scene shows A, B, C and D" also skips parts with `data-hidden`. "does not show the X": no visible element for part X in the scene.
  "the X of the top bar scene is drawn at its full size": every visible element of part X is at least its full
  height (trees 43 px, snowman 42, leaf pile 13, sledge 13, kite 20) and its bottom edge lies between 1 px above and
  2.5 px below the bottom of the `top-bar` box (the kite: it hangs from the bar's top; its top lies inside the bar).
  "the X of the top bar scene runs the full width of the bar": part X spans the `top-bar` box from its left to its
  right edge (within 1 px) and sits on its bottom edge.
  "the top bar scene shows N X at rest": exactly N particles of kind X, each visible, fully inside the `top-bar` box
  and at least 1 px from its top edge, none with a running animation or transition; read twice 500 ms apart, each
  particle's box is unchanged. "the X of the top bar scene are spread over the whole bar": the leftmost particle's
  left edge is in the left quarter of the bar and the rightmost particle's right edge in its right quarter.
  "the X of the top bar scene glide to their resting spots within N second(s)": waits until `html[data-scenes]` turns
  `still` (the end of the 10 s moving window), then reads each particle's glide (a Web Animation, not a CSS one):
  every particle has one lasting at most N s, and for at least 7 of the 9 its first keyframe is translated more than
  0.5 px away from the spot; within N s more (real time: the glide runs on the page's animation timeline, which the
  fake clock does not drive) nothing runs any more and every particle stays where it is. "spread over the whole bar"
  counts only shown particles. The owner's glide is 1 s (2026-10-26), so the
  "still after 11 s" checks hold.
  "the top bar scene is drawn mirrored": the computed `transform` of the scene layer (`top-bar-scene`) is a matrix
  whose first value is -1 (`scaleX(-1)`), so the scene layer is drawn mirrored. In left-handed mode the Fall and Winter
  scenes are flipped on a touch screen (`html[data-hand='left'][data-touch]`).
- The `"top bar"` region of "the {string} still looks like {string}" is `top-bar` (the whole bar with its scene).
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
bedtime mode is on with fixed times {time} and {time}, and {time} and {time} on weekends
this device has already shown tonight's bedtime reminder
bedtime mode is on based on my first appointment with {int} hours of sleep and {int} minutes of lead time
the night bands of {date} are {string}
the night band runs from {date} {time} to {date} {time}
no night band is shown
the bedtime moons of {date} are {string}
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
- Moons: every bedtime moon in a day column or on the Clock has `data-testid="bedtime-moon"` with `data-date` (the day it
  is drawn on) and `data-at` (`HH:MM` within that day; `24:00` for a bedtime at midnight, which is drawn at the end of
  the evening before, not at 00:00 of the next day). "the bedtime moons of D are S" joins `data-at` of the moons with
  `data-date` D (document order) with `", "`. The weekend setup step also sends `weekendDifferent: true`,
  `weekendBedtime` and `weekendWake`.
- Approach bar: "shows a night band" = a `bedtime-track-band` inside `approach-bar`.
- Reminder: a snackbar with `data-testid="bedtime-reminder"`; "I see" compares its text exactly.

## Left-handed mode (`@left-hand`)

```
left-handed mode is on
the {string} is on the {string} side of the screen
the create button sits right of the open tasks tray
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
  `Today button` = `nav-today`, `period title` = `period-title`, `undo action` = `undo-action`, `time axis` = `time-axis` (the hour labels column of
  `time-grid`), `open tasks tray` = `task-tray` (the side panel on a tablet or desktop).
- "the create button sits right of the open tasks tray": the left edge of `create-button` is at or right of the right
  edge of `task-tray` (polled: the tray animates its width).
- "the switches in the settings are on …": every `role=switch` inside `settings-view` (at least one) has its centre on that side.
- "the support cat walks in from the S": the visible `support-cat` element has `data-from` = `left` | `right` (the
  side it enters from; the drag helper cat keeps `data-side` for the side it stands on). Polled while the cat is shown.

## Theme import (`@theme-import`)

```
the AI theme prompt is turned on in Labs
I turn on the AI theme prompt in the settings
the theme menu has no AI prompt
the theme menu has an AI prompt
the theme menu has the import block
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
- "the AI theme prompt is turned on in Labs" sets `labs` and `labsOwnThemes` through `PATCH /api/prefs` for the person
  who is using the app at that moment (before sign-in: the signed-out person); "I turn on the AI theme prompt in the
  settings" opens the settings and flips `settings-labs` and then `settings-labs-own-themes` (waits for each save), as
  the Labs steps do. The block with the import (always there) is `theme-own` (with the paste field
  `theme-import-text`); the AI prompt button inside it is `theme-ai`.
- "Create with AI" = `theme-ai` button; the prompt is `theme-ai-prompt` (contains the schema id); "copy" clicks
  `theme-ai-copy` and checks the clipboard (granted permission) equals the prompt text. "copy the repair prompt"
  clicks `theme-repair-copy` and checks the clipboard equals `theme-repair-prompt`.
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

## Tasks view (`@tasks-view`)

```
the calendar contains an undated task list {string} with items:
I open the Tasks view
I create the task list {string} in the Tasks view
I remove the date of the task list {string} in the Tasks view
I give the task list {string} the date {date} in the Tasks view
I group the Tasks view by {string}
I sort the Tasks view by {string}
I sort the Tasks view by {string} in reversed order
I tick the item {string} of the task list {string} in the Tasks view
I drag the item {string} above the item {string} of the task list {string} in the Tasks view
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
the Add item button of the task list {string} in the Tasks view is the only button of the card footer
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
  "collapse/expand all" clicks `tasks-collapse-all` until every card shows the wanted state. "is the only button of
  the card footer": the card's `footer` holds exactly one button, `tasklist-add` (Edit, Delete and the rest are in the
  overflow menu `tasklist-overflow`). "the add field is hidden / shown" = `tasklist-new-item` not visible / visible; "I tap Add item" clicks
  `tasklist-add`.
- "undated task list" fixture: `POST /api/tasklists` with `date: null`; items table as usual.
- "I create the task list T in the Tasks view": `create-button` (in the Tasks view it opens the task list dialog
  without a date), type T into `tasklist-title`, `tasklist-save`.
- "I remove the date of the task list L": taps `tasklist-expanded-title` of L's `tasks-item` (opens the task list
  dialog), clicks `tasklist-date-clear`, `tasklist-save`.
- "I give the task list L the date D": opens L's dialog the same way, fills `tasklist-date` with D (the field is
  never disabled, also on an undated list), `tasklist-save`, waits for the `PATCH` (200).
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
- "I choose Copy for the task list L": clicks `tasks-archive-duplicate` in L's `tasks-archive-item` and
  waits for the `POST /api/tasklists` response. "I choose Save as template for the task list L" (`@templates`): clicks
  `tasklist-save-template` in L's `tasks-archive-item`, which opens the `template-save-dialog`.
- "the open task list L has no date and N open item(s)": opens the Open tab; the `tasks-item` L has an empty
  `data-date` and N `tasklist-item` rows with `data-done="false"` (and no done ones).

## Task list templates (`@templates`)

```
I have the template {string} with the items {string}
I have the template {string} with the items {string}, the estimate {int} minutes and the category {string}
{string} has the template {string} with the items {string}
the calendar contains a task list {string} in the category {string} on {date} at {time} for {int} minutes with items:
I save the task list as a template
the footer of the expanded task list shows {string}
the overflow menu of the expanded task list lists {string}
the template dialog previews the items {string}
the task list {string} in the Archive offers {string} and {string}
the template name field shows {string}
I enter the template name {string}
I confirm the template
I turn on {string} in the task list form
I open the template picker
I choose the template {string}
I choose {string} in the template picker
the template pill shows {string}
the template menu has grown out of the template pill
the template menu shows:
the template menu ends with {string} below a divider
the template picker says {string}
I create a task list from the template {string} on {date}
I open the templates in the settings
the settings page {string} is shown
the templates page lists {string}
the templates page says {string}
the templates page offers {string}
I start a new template
the template sheet is titled {string}
I open the template {string}
I fill in the template form with:
I save the template
I cancel the template dialog
I delete the template {string}
the template form shows:
the template form has no date, time, repeat or reminder fields
the template dialog shows the error {string}
my templates are {string}
the template {string} has the items {string}
I have no templates
```

- Store: templates are per person on the app server, `GET/POST /api/templates`, `PUT/DELETE /api/templates/:id`
  (`users/<sub>/templates.json`). A template is `{ id, name, items: [{ title }], estimateMinutes, categoryId }`.
- "P has the template T with the items "A, B"" (`@signin`): the same `POST /api/templates`, sent with the page's own
  session, which must be signed in as P (checked with `GET /api/auth/me`).
- "I have the template T with the items "A, B"[, the estimate N minutes and the category C]": `POST /api/templates`
  before the page opens (items split on `", "`, C resolved by name from `GET /api/settings`).
- "the calendar contains a task list … in the category C on D at T for N minutes with items:": `POST /api/tasklists`
  with `categoryId`, `time`, `estimateMinutes` and the items table (ticks included).
- "I save the task list as a template": in the open list sheet (`tasklist-expanded`; "I expand the task list" opens
  it) opens the overflow menu `tasklist-overflow` and presses `tasklist-save-template`; `template-save-dialog` opens with
  `template-save-name` prefilled with the list's title. "the template name field shows N" = value of
  `template-save-name`; "I enter the template name N" replaces it; "I confirm the template" clicks
  `template-save-confirm` and, when no error shows, waits for the `POST /api/templates` response (201).
  "the footer of the expanded task list shows "A, B"" = the texts of the buttons in the `footer` of `tasklist-expanded`
  (only Add item since the overflow menu, ADR 0032). "the overflow menu of the expanded task list lists "A, B"" opens
  `tasklist-overflow`, joins the `menuitem` texts of the open `menu` and closes it with Escape.
  "the template dialog previews the items "A, B"" = the `template-save-item` texts in `template-save-dialog`, joined.
- "the task list L in the Archive offers A and B": L's `tasks-archive-item` shows `tasks-archive-duplicate` with text
  A and `tasklist-save-template` with text B (the Archive keeps its one-off copy, renamed "Copy", owner 2026-10-25).
- "I turn on S in the task list form": S = `Also save as template` → `tasklist-save-as-template` (create mode only; a
  switch row right above Cancel and Save) set to `aria-checked="true"`.
- "I open the template picker": clicks the pill `tasklist-from-template` next to the heading of the open
  `tasklist-dialog` (create mode); the pill grows in place into the menu `template-picker`. "the template pill shows
  T" = the pill's label without the `▾` (`From template` before a pick, the template's name after). "the template
  menu has grown out of the template pill": once the menu is at rest (no running animation) its top edge and its right
  edge are within 4 px of where the pill's were before the tap (the pill sits at the right end of the heading row, so
  the menu opens from its top-right corner), it is taller than the pill, its first row is the header pill
  `template-picker-header` standing where the pill was (top and right edge within 4 px, the same height within 2 px,
  owner's canvas variant 4D), and the pill itself is hidden meanwhile. "I choose the template T"
  opens the menu if needed and clicks its `template-picker-item` with `data-name` T; the menu shrinks back into the
  pill and the form is filled. "I choose Manage templates in the template picker" clicks `template-picker-manage`.
  "the template menu shows:" = two-column table, one row per `template-picker-item` in DOM order (by name): its
  `template-picker-name` and `template-picker-details` texts. Details are `N item(s)`, then `~M min` when there is
  an estimate, then the category name when there is one, joined by ` · `. "ends with M below a divider": the last
  child of `template-picker` is `template-picker-manage` with text M, directly after a `template-picker-divider`.
  "says" = text of `template-picker-empty` (inside the open menu, above the divider and "Manage templates").
- "I create a task list from the template T on D": the day view of D, "I start creating a task list", "I choose the
  template T", "I save the task list" (waits for `POST /api/tasklists`).
- "I open the templates in the settings": opens the settings (from the day view of the Background date if no page
  is open yet), then the row `settings-templates` in the Task lists card (next to categories, carried-over,
  finished-list and tap options), which opens the Templates sub page; waits for `templates-page`.
  "the settings page Templates is shown": `templates-page` is visible at `/settings/templates`.
- "the templates page lists "A, B"" = `data-name` of every `template-row` in DOM order (by name); "says" = text of
  `templates-empty`.
- "the templates page offers New template": `templates-new` (a button on top of the list, also in the empty state)
  is visible with that text. "I start a new template" clicks it; the `template-dialog` opens empty. "the template sheet
  is titled T" = text of `template-dialog-title` ("New template" / "Edit template"). Saving a new template waits for
  `POST /api/templates` (201) instead of the `PUT`.
- "I open the template T": on the templates page clicks the `template-row` T; `template-dialog` opens.
  "I fill in the template form with:" fills `template-name`, `template-items` (one per line, as the task list form;
  reordering, adding, removing and retitling are all done by the lines), `template-estimate`, `template-category`.
  "I save the template" clicks `template-save` and, when no error shows, waits for `PUT /api/templates/:id` (200);
  "I cancel the template dialog" clicks `template-cancel`. "the template form shows:" compares the listed fields.
  "has no date, time, repeat or reminder fields": the `template-dialog` holds no `tasklist-date`, `tasklist-time`,
  `tasklist-repeat` or reminder editor.
- "I delete the template T": clicks `template-delete` of the `template-row` T; the row goes at once and an undo
  snackbar shows (as other deletes; "I undo the deletion" and "the undo time is over" are reused). The
  `DELETE /api/templates/:id` is sent when the undo time is over.
- "the template dialog shows the error E": text of `template-error` in the open `template-save-dialog` or
  `template-dialog`.
- "my templates are "A, B"" / "the template T has the items "A, B"" / "I have no templates": `GET /api/templates` as
  the signed-in person: names sorted, joined `", "`; T's item titles in order, joined `", "`; an empty list.

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
I drag the item {string} above the item {string} of the note {string} on the Canvas
the note {string} on the Canvas shows the items {string}
the page is a little taller than the screen
I add an area on the Canvas
the add button covers no control of the {string}
I create the area {string} on the Canvas
I delete the area {string} on the Canvas
the Canvas has the area {string} with the note {string} in it
the note {string} is in no area
I long-press the area {string} and drag it by {int}, {int} pixels
the area {string} has moved by {int}, {int} on the Canvas
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
  equals the text. "does not show the note T": none has that title.
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
- "the Canvas has the area A with the note T in it" (fixture): `PUT /api/canvas` adds the area A (x 300, y 200, 480 x 360)
  to the saved ones, and `PATCH /api/tasklists/:id { canvas: { x: 320, y: 256 } }` places T 20, 56 inside it.
- "I delete the area A on the Canvas": opens the Canvas, clicks A's `canvas-area-header` (opens the editor), clicks
  `canvas-area-delete` (first checking that a note lies in A: `data-area` A), then waits until A is gone from the page and from `GET /api/canvas`. "the note T is in no area":
  T is visible and has no (or an empty) `data-area`.
- "I long-press the area A and drag it by DX, DY pixels": notes A's `data-x`/`data-y`, then a finger on the body of A
  (as "release without moving"), held 500 ms, moved by DX, DY in 10 steps and lifted. "the area A has moved by DX, DY":
  `data-x`/`data-y` and the saved area are the noted place + (DX, DY) / `data-zoom` of `canvas-viewport` (± 1).
- "I drag the item I above the item J of the note T on the Canvas": item drag by the item's `tasklist-item-grip` (a finger long-presses it; the Canvas picks the note up from anywhere else), waits for the saved order, and expects the note's `data-x`/`data-y` unchanged. "the note T on the Canvas shows the items" = the `tasklist-item` `data-title`s of that note joined by ", ".
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
I back up now {int} times
{string} has signed in but not opened the calendar yet
I chose the theme {string} and backed it up
{string} is signed in with the theme {string} backed up
I restore from the backup and confirm
I restore from the backup and confirm, twice
{string} adds the category {string}
the category {string} still exists
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
  (feature drive-backup), so scenarios first change a setting.
- Google Drive is `MockDrive` (`TEST_MODE`, feature drive-backup): the hidden app folder in `DATA_DIR/mock-drive.json`,
  one folder per person. "is signed in" and "signs in with Google" grant the Drive permission (the test double's
  consent returns the `drive.appdata` scope); "signs in without the Drive permission" signs in with a consent that
  leaves it out (`POST /api/__test/oauth/account { email, driveScope: false }`, then the usual consent).
- "the quiet period of the backup has passed": `POST /api/__test/backup/flush` (the debounce timer fires now, as if two
  quiet minutes had passed) and waits for it to finish. "a day passes on the server": sets the test clock 24 hours later
  (frozen) and calls `POST /api/__test/backup/tick` (the daily check, once).
- "P has signed in but not opened the calendar yet": the OAuth round trip as P (`GET /api/auth/google/start` in the page's own
  session) without loading the app, which would save P's prefs. Only files under `users/<sub>/` make a person "have data of their
  own"; the server-wide files (settings, people, motivation) do not count.
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
the task list {string} in the Tasks view shows the category {string}
{string} edits the shared task list {string}
{string} is not offered to change the category
I delete the shared task list {string}
{string} is offered to leave the list, not to delete it
{string} has never signed in
I open "Share with" for the task list {string}
I can share only with {string}
```

- "A, B and C may use the calendar": a three-address allow-list; TEST_MODE also records every address as a known person
  (as if they had signed in once), so they can be picked as members (feature shared-lists).
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
the open tasks row is inside the bottom bar
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

## Month view scrolling up and down (`@id:month-vertical`; setting `settings-month-scroll`, pref `monthScroll`)

```
the month view scrolls up and down
the month view scrolls up and down one month at a time
the month view scrolls sideways
I choose {string} as the month scrolling
{string} is selected as the month scrolling
the month view shows only the month of {month}
the month header {string} is shown
the month header {string} is shown below the month {month}
the month {month} is below the month {month}
the month {month} is the month most in view
the day {date} is in view
the weekday row is pinned at the top of the calendar
the date {date} appears exactly once in the month view
the day {date} is empty in the month {month}
no day is greyed in the month view
the day {date} is greyed in the month {month}
I tap the day {date} in the month {month}
every week of the month view is {int} pixels tall
I note the scroll position of the calendar
the calendar is at the noted scroll position
I flick the calendar up
I flick the calendar down
the month header {string} is at the top of the calendar
the month header {string} is not at the top of the calendar
I scroll the calendar to the month {month}
I scroll the mouse wheel down by {int} pixels over the calendar
at most {int} months are built in the month view
the month {month} is not built in the month view
```

- "the month view scrolls up and down" (Given) / "... sideways": `PATCH /api/prefs { monthScroll: "vertical" | "vertical-snap" | "sideways" }` as that
  person before the view opens; as a Then step it checks `month-view[data-scroll="vertical" | "vertical-snap" | "sideways"]`. "I choose X as the month scrolling"
  (X = `Sideways` | `Up and down` | `Up and down, one month at a time`) picks that option of the select `settings-month-scroll` and waits for the `PATCH /api/prefs` 200.
- Up and down, `month-view` holds one `month-block` per built month (`data-month` = `YYYY-MM`), each with a `month-block-header`
  (its text is the month name and year) above its `month-cell`s; there is one `month-weekday-header` row, `position: sticky` at
  the top of `calendar-swipe-area`'s scroller. "shows only the month of M" = exactly one `month-block`, M (sideways, which has no blocks: `month-view[data-month]` names M, e.g. "October 2026"); `month-view[data-scroll]` is `sideways` there too.
- "the month M is below the month N": the top of `month-block` M is at or below the bottom of `month-block` N. "the month header H is shown
  below the month M": the header is visible in the viewport and its top is at or below the bottom of that month's last week.
  "the month header H is shown": visible in the viewport.
- "the month M is the month most in view": M's block has the largest visible height in the scroller; the URL path and period title are
  checked by the existing steps. "the day D is in view": its `month-cell` is fully inside the scroller's visible area. "the weekday row is
  pinned": its top equals the scroller's top after scrolling.
- "the date D appears exactly once": exactly one `month-cell` with `data-date` D in the whole list (continuous mode: a neighbouring month's
  cells in a month's first/last week are empty placeholders without `data-date`). "the day D is empty in the month M": `month-block` M
  has an empty placeholder (`data-empty="true"`) where D would be. "no day is greyed": no `month-cell` has `data-outside-month`.
  Snap mode keeps `data-outside-month="true"` (greyed) on neighbouring-month days: "the day D is greyed in the month M" = the cell D
  inside `month-block` M has it. "I tap the day D in the month M" taps that cell's day number. "every week of the month view is N
  pixels tall": all week rows of the built months are N px (1 px); N = 96 on a phone.
- "I note the scroll position of the calendar" stores the scroller's `scrollTop`; "the calendar is at the noted scroll position" compares
  it after going back, with 0 px tolerance (the position is saved when a day is tapped and restored on return, pixel-exact).
- "I flick the calendar up / down": a touch flick (fast 300 px swipe up / down) on the scroller, then waits until it has settled. "the month
  header H is at the top of the calendar": the header's top is within 1 px of the bottom of the pinned weekday row (snap mode: after
  settling). "... is not at the top": the opposite.
- "I scroll the calendar to the month M": sets the scroller's `scrollTop` so M's header is at the top, as a person's swipe or flick would
  end, then waits until the URL path and period title have settled. "I scroll the calendar down / up by N pixels": a touch or wheel scroll
  of the scroller by N px (shared with feature nav-expressive: input counts as the person's own, so the bottom bar reacts). "I scroll the
  mouse wheel down by N pixels over the calendar": `mouse.wheel` over the scroller. "the bottom bar is hidden" = `bottom-bar[data-hidden="true"]`
  and moved out of the viewport, "shown" = fully inside it; "the create button is shown" = `create-button` fully inside it.
- "at most N months are built": the number of `month-block`s (month cells present in the DOM) is at most N. "the month M is not built":
  no `month-block` M.


## Month zoom (`@id:month-zoom`, @backlog)

```
I note the height of the week rows of the month view
I pinch out on the month view to twice the size
I pinch in on the month view to half the size
I zoom the month view in with Ctrl+wheel
I scroll the month view down to {date}
I note the height of the top bar
the week rows of the month view are about twice as tall as noted
the week rows of the month view are taller than noted
the week rows of the month view have their default height
the month view shows {int} day columns across the screen
the top bar is as tall as noted
the page itself is not zoomed
```

- Week row height = the height of the `month-cell` of the first day of the month (all rows share it). "about twice":
  within 10 %. "default height": the height of a fresh device (sideways: the month fills the screen; month list: the
  fixed week height of ADR 0034), within 2 px.
- Pinch: two CDP touch points (`Input.dispatchTouchEvent`) around the centre of `calendar-swipe-area`, moving apart
  vertically from 80 to 160 px (out) or together from 160 to 80 px (in), then wait until the gesture settled (no
  `[data-month-zooming="true"]`). Ctrl+wheel: one wheel event with Ctrl held (deltaY -300) over the month grid.
  Sideways, the weeks sit in the scroller `month-scroll`; "default height" there is its height shared by the week rows.
- "I scroll the month view down to D": scrolls the month's scroller until the `month-cell` of D is inside it.
- "N day columns across the screen": N `month-cell`s in the first week row, together as wide as the viewport (2 px).
- "the page itself is not zoomed": `visualViewport.scale` is 1, and the wheel / touch events of the gesture were
  `defaultPrevented` (the browser zooms nothing). "the top bar is as tall as noted": `top-bar` height within 1 px.
## Reminders

```
the calendar {string} has the default reminders {string}
the calendar {string} has the default reminders {string} in Google
the event {string} has its own reminders {string} in Google
the event {string} has its own reminders {string} and the email reminder {string} in Google
the task list {string} has its own reminders {string} in Google
the event reminders show the calendar default {string}
the event reminders are {string}
I add the reminder {string}
I remove the reminder {string}
I choose the calendar default reminders
I cannot add another reminder
the event {string} has the reminders {string} in Google
the event {string} does not use the calendar default in Google
the event {string} uses the calendar default in Google
the event {string} still has the email reminder {string} in Google
the event {string} in Google is still {string} on {date} from {time} to {time}
the app keeps the reminders {string} for the event {string}
I open the reminder settings
I open the reminders settings
the reminder settings show {string} for the calendar {string}
I add the default reminder {string} for the calendar {string}
I switch on reminders for task lists
I switch on reminders in this browser
this browser has no push subscription on the server
this browser has a push subscription on the server
the server has {int} planned pushes for this browser
the push {string} saying {string} was sent once
the push {string} was sent once with the {string} icon
the server plans the push {string} saying {string} for {date} {time}
```

- Minutes lists are comma-separated integers (`"90, 30, 15"`, `""` = none); labels use the app's duration format
  (`"1 h 30 min"`, `"30 min"`). Setup steps write the mock Google provider through `__test` routes: a calendar's
  `defaultReminders` (popup), an event's `reminders` (`useDefault: false`, popup overrides, plus an email override).
  "in Google" assertions read the mock provider's stored event or calendar list entry (popup minutes in order; email
  overrides separately; `useDefault`).
- Event dialog: `event-reminders` row; "show the calendar default X": the row says it uses the calendar default and lists
  X; "are X": the `event-reminder` chips' labels in order; "add R": `event-reminder-add`, pick R; "remove R": the
  `event-reminder-remove` of chip R; "choose the calendar default": `event-reminders-default`; "cannot add another":
  `event-reminder-add` is disabled.
- Read-only events (feature reminders): the app keeps their reminders itself and never asks Google, so there is no
  Google policy step. "the event T in Google is still S on D from A to B": the stored Google event has that title and
  those start/end instants. "the app keeps the reminders L for the event T": `GET /api/events/:id` shows exactly those
  popup minutes. The reminder steps above work in the read-only dialog too (no save: each change is sent at once). A
  read-only calendar's default reminders go to Google like any calendar's (`calendarList.patch`).
- "I open the reminder settings": `/settings` → `settings-reminders` → `reminders-settings` visible. "show X for the calendar
  C": the `reminders-calendar` named C lists X; "add the default reminder R for C": its add button, pick R (saves at once).
  "switch on reminders for task lists": `reminders-tasklists` on.
- Web Push: "I open the reminders settings" is the same as "I open the reminder settings". "I switch on reminders in this
  browser" replaces the browser's permission and subscription with a fake (headless Chromium has no push service:
  `Notification.requestPermission` → `granted`, `PushManager.prototype.subscribe` / `getSubscription` → a fake subscription with a
  unique `https://push.example.test/...` endpoint kept in `window.__e2ePushEndpoint`), then turns `reminders-push` on (`aria-checked`).
  The server side is read from the TEST_MODE routes `GET /api/__test/push-subscriptions` ("has a push subscription": one with this
  endpoint exists; "N planned pushes": its plan has N entries) and `GET /api/__test/pushes` (the recorder that replaces the push
  service; "T saying B was sent once": exactly one recorded push with title T and body B for this endpoint; "was sent once with
  the I icon": exactly one recorded push with this title whose `kind` is the one of icon I — "calendar page" = `event`,
  "checklist" = `tasklist`, "sunrise" = `summary`, "moon" = `bedtime` (the service worker picks the icon files by `kind`;
  its unit test covers that mapping). "the server plans the push T saying B for D T": this browser's plan holds an entry
  with that title and body at that app time). `POST /api/__test/clock` (the step "the
  time is D T") runs the server's push loop once on the new app time, so a push that became due is sent before the step returns.
- Warnings reuse "I see the transition warning X" / "I do not see a transition warning" / "N minutes pass".

## Two-row week overview (`@two-row`)

```
the two-row week overview is on
tapping a task list grows it in place
tapping a task list opens the list sheet
the split is set to three days on top
I open the week of {date} on a phone
all seven days are laid out in two rows
I see both {string} and {string} without scrolling
Monday to Thursday are on the top row
Friday to Sunday are on the bottom row
Monday to Wednesday are on the top row
Thursday to Sunday are on the bottom row
{string} is about {int} times as tall as {string}
every day spans the same hours, from the week's earliest entry to its latest
no empty hours are shown before {string} or after {string}
I see {string}
I tap {string}
the event {string} opens
{string} expands in place and shows {string}
the week is still shown behind it, not replaced by a separate sheet
I tap the empty area of {date}
the day view for {date} opens
{string} is in the all-day band of {date}, above the timed entries
the seven days are side by side in a single row
```

- The overview is switched on through `PATCH /api/prefs` (`weekTwoRow`, `weekTwoRowTop`); the Labs master switch is not needed.
  "on a phone" sets the viewport to 375 x 812 before opening `/week/{date}`, so it also holds in the desktop project.
- The overview reuses `TimeGrid`: test ids `week-view` (root), `week-overview-row` (`data-row` 0 top, 1 bottom, one TimeGrid each),
  `week-day-column`, `week-allday-cell`, `week-header` (`data-date`), `time-axis` (hour labels).
- "without scrolling": both entries lie inside the viewport. "about N times as tall": heights within 15 %.
  "every day spans the same hours": the `time-axis` hour labels of both rows are identical; "no empty hours": the earliest entry starts at
  the top of row 0's visible `.scroll` area and the latest ends at the bottom of row 1's (within 6 px). "the empty area of D": the last
  `time-slot` of D's `week-day-column`. "single row": the seven `week-header` cells share one top.

## Visual states (`@visual`)

Rules that need no reference picture, plus `toHaveScreenshot` regression pictures (baselines in `e2e/snapshots/<project>/`,
written on the first run; re-baseline only for an intended change, after looking at the picture). Regions: `week overview`
(`week-view`), `expanded task list` (`tasklist-expanded`), `all-day band` (row 0's band), `day column of {date}`
(`week-day-column[data-date]`), `day column` (the day view's `day-column`), `top row` (`week-overview-row[data-row="0"]`),
`list form` (`tasklist-dialog`), `clock` (the dial `svg.face` inside `clock-view`), `template save sheet`
(`template-save-dialog`), `templates page` (`templates-page`), `top bar` (`top-bar`; the check-in message
`streak-message` is hidden for its picture). The `now-marker` is masked.
`list form` (`tasklist-dialog`), `clock` (the dial `svg.face` inside `clock-view`), `time grid` (the time grid's scroll area `[data-scroll-area]`, as far as
it is on screen; the floating "+" button is hidden for its picture). "I scroll the time grid to the end of the day" sets that area's `scrollTop` to its end. The `now-marker` is masked.

```
no text in the {string} is clipped
the head row and the items of the expanded task list do not overlap
the pill of the expanded task list covers the card {string} it grew from
the {string} still looks like {string}
I scroll the time grid to the end of the day
the pill of the expanded task list shows the count {string}
the band's lists are one-line pills
I tap the band's section switch
I tap the band's section switch twice
no day in the band shows a task count instead of its lists
the band's lists show their items
the list of the expanded task list stands out from the grid behind it
the time grid is zoomed to {int} pixels per hour
no title in the {string} is covered by another entry
```

- "no text in the {string} is clipped": every text lies inside its nearest clipping box (1.5 px slack). Clipped on
  purpose and exempt: the time grid's scroller, the all-day band, a card's faded item rows, and the item names that run
  next to the title of a short block (they fade out at the right edge).
- "the time grid is zoomed to N pixels per hour": the remembered hour height (`cal.hourHeight` in local storage) is N
  before the app loads, as if the person had pinched to that zoom.
- "no title in the {string} is covered by another entry": every entry's title (`.tx`, `.lead`, `event-chip-title`)
  in the region, scrolled into view, is topmost at its left end near its top and its bottom edge (2 px in): no other
  entry card is drawn over any part of a title line. Other overlays (the "+" button, the now line) do not count.

- "the band's lists are one-line pills": in the first grid the band's section toggle (`tasks-section-toggle`) is
  enabled, shows its chevron and is in `titles` mode, and every task-list card in the band is at most 30 px tall with
  none of its items visible.
- "I tap the band's section switch": taps the first grid's `tasks-section-toggle` and waits until its `data-mode`
  changed. The switch has two levels, `titles` and `full`, so two taps come back to the start.
- "I tap the band's section switch twice": the step above, two times. "no day in the band shows a task count instead
  of its lists": the first grid's band shows task-list cards, and no text holding a digit is visible in the band outside
  the cards and the switch (whose own total is not a day's count).
- "the band's lists show their items": the first grid's toggle is in `full` mode and every task-list card in its band
  shows at least one item.
- "the list of the expanded task list stands out from the grid behind it": the grown card's extension layer
  (`tasklist-grown-ext`) has an opaque background whose RGB distance from the first opaque background behind the day
  column is at least 24, in the current colour scheme — the list reads as a box, also in the dark theme.

## Minimum event length (`@id:min-event-length`; setting `settings-min-event-length`, pref `minEventMinutes`)

```
the minimum event length is {int} minutes
I am on the settings screen
I choose a minimum event length of {int} minutes
the event {string} is positioned from {time} to {time} in the day view for {date}
the task list {string} and the event {string} are laid out as overlapping
the calendar contains a task list {string} on {date} at {time} for {int} minutes
I hold the end handle of {string} at {time}
I drag the end handle of {string} to {time} in the day view
I look at {date} in the day view
I look at {date} in the week view
I look at {date} in the two-row week overview
I look at {date} in the Labs strip
I look at {date} in the Labs timeline
I look at {date} in the zoom month
I look at {date} in the Labs horizontal view
I look at {date} in the phone widget
the events {string} and {string} are laid out as overlapping
opening the event {string} shows the time {string}
```

- "the minimum event length is {int} minutes": patches the pref `minEventMinutes` (0, 15 or 30) through the API.
- "the event {string} is positioned from {time} to {time}" checks where the block is **drawn** (start attribute and
  geometry); under a minimum the drawn end lies past the real end, so the end attribute is not checked.
- "I hold the end handle of {string} at {time}": drags the bottom resize handle (shown by "shows resize handles") so the
  end would be `{time}`, and keeps the finger / mouse button down: the live preview stays on screen.
- "I drag the end handle of {string} to {time} in the day view": the same, released; waits for the save.
- "I look at {date} in the {view}": opens that view on the date (the two-row overview: turns it on, phone size). The
  phone widget is native and cannot be driven from a browser: its examples are `@backlog`, proven by the widget's
  JUnit tests (`WeekLayoutTest`).
- "… are laid out as overlapping" (two events, or a task list and an event): the two blocks overlap along the time axis
  (down; across in the horizontal view) and are laid out as an overlap by the usual rule — side by side, or the later one
  cascaded over the earlier one — so neither title is hidden: the middle of each block's first title line is topmost in
  its own block.
- "opening the event {string} shows the time {string}": opens the event (its dialog) and checks that its start and end
  time fields hold the two times of `HH:MM–HH:MM`: the real times, whatever length the block is drawn.

## Turning the day or week while dragging (`@dnd`, owner 2026-10-25)

```
I hold the event {string} at the right edge of the time grid for {int} ms
I hold the event {string} at the left edge of the time grid for {int} ms
I hold the task list {string} at the right edge of the time grid for {int} ms
I keep holding the dragged item for {int} ms
the edge band says {string}
I see no edge band
{string} is still being dragged
I drop the dragged item on {date} at {time}
I hold the all-day event {string} at the right edge of the all-day row for {int} ms
I hold the event {string} over {date} at {time} for {int} ms
I hold the event {string} at the right edge of the time grid until the view turns
I drop the dragged item in the all-day row on {date}
```

- "I hold X at the right/left edge of the time grid for N ms": picks X up as in "I pick up" (mouse press; finger long
  press), moves in 10 steps sideways at the same height to 6 px inside the right/left side of the day columns area
  (`time-grid` minus the hour labels), i.e. inside the 24 px edge zone, and keeps the pointer there for N ms. The pointer
  stays down; the world's cleanup releases it. "I keep holding the dragged item for N ms" waits N ms more without moving.
  Before a hold the card is scrolled to the middle of the grid (a pointer resting near its top or bottom would start the
  auto-scroll); an edge hold stops 40 px short of the zone and then enters it in one move, so the time counts from there.
- "I hold the event X at the right edge of the time grid until the view turns": the same hold, kept until the URL path
  changes (polled every 50 ms, at most 5 s), then the pointer moves at once to the middle of the grid (no second turn on
  a slow device: the iPhone model is too slow for timed holds).
- "the edge band says T": the visible `drag-edge-band` (`data-side` `left|right`) has the text T. "I see no edge band":
  no `drag-edge-band` is visible.
- "X is still being dragged": a card with `data-title` X and `data-dragging="true"` is visible (the drag goes on after
  the view turned).
- "I drop the dragged item on D at T": moves the pointer in 10 steps to the 15-minute slot of D at T in the grid shown
  (scrolling it into view as the auto-scroll does) and releases; waits for the save as after a drop.
- "I hold the event X over D at T for N ms": picks X up and moves in 10 steps to the horizontal middle of D's day column
  at the height of T, then keeps the pointer there for N ms (still down).
- "I hold the all-day event X at the right edge of the all-day row for N ms": the same as the time grid step, with X's
  chip in the all-day row and the pointer 6 px inside the right side of that row. "I drop the dragged item in the all-day
  row on D": moves to the `week-allday-cell` of D (in the day view its `day-allday-area`) and releases; waits for the save.
- The other drag steps ("I move the dragged event to the middle of the time grid", "I drop the dragged event", "the
  event X starts at the time the drop indicator showed") also act on a drag begun by these steps.

## Events side by side (`@overlap`; settings `settings-day-side-by-side`, `settings-week-side-by-side`, prefs `daySideBySide`, `weekSideBySide`)

```
the day view shows up to {int} events side by side
the week view shows up to {int} events side by side
I choose up to {int} events side by side in the day view
I choose up to {int} events side by side in the week view
the settings show up to {int} events side by side in the day view
the settings show up to {int} events side by side in the week view
the entries {string} each take one of {int} equal columns
the entries are drawn {string}
the event {string} has a {int} px entry border
the event {string} has the narrow block padding
the event {string} has the normal block padding
the event {string} stays inside its day column
```

- "the day/week view shows up to N events side by side": patches the pref `daySideBySide` (2, 3 or 4; default 4) or
  `weekSideBySide` (2 or 3; default 2) through the API.
- "I choose up to N ... in the day/week view": on the settings screen picks the option `settings-day-side-by-side-N` /
  `settings-week-side-by-side-N` of that segmented button (labels "Up to N") and waits for the `PATCH /api/prefs`
  response (status 200). "the settings show up to N ...": that option is the selected one (`aria-pressed="true"`).
- "the entries "A, B, …" each take one of N equal columns": the event chips / task list cards with those `data-title`s
  (one segment each, on the day shown or the same day of the week) all overlap one another in time on screen, no two of
  their boxes intersect, and each one's width is the day column's width / N within 4 px.
- "the entries are drawn S" (`solid`, `tinted` or `outline`): `PATCH /api/prefs/theme { overrides: { entries: S } }`.
- "has a N px entry border": the computed left plus right border width of X's block is N px (the style was applied).
- "has the narrow block padding": X's time grid block (`event-chip`) is at most 84 px wide (border box), its computed
  padding is 3 px left, 2 px right, its title (`event-chip-title`) is 11 px and no duration (`.dur`) is visible. "has the normal block padding": wider than
  84 px, padding 6 px left, 5 px right, title 13 px. "stays inside its day column": X's chip box ends at or before its day column's right edge (0.5 px
  tolerance) and starts at or after its left edge.
- "the event X is stacked on the event Y" (feature event-display) also checks that both blocks share a column: X's left
  edge lies inside Y's width (a cascade lies over the column, indented from the left; on a narrow phone column a block's
  minimum width may reach past the column on the right).

## Drawing on the time grid (`@crud`, owner 2026-10-25)

```
I draw a block on {date} from {time} to {time}
I draw a block from {date} {time} to {date} {time}
I hold a drawn block on {date} from {time} to {time}
the drawn block is shown on {date} from {time} to {time}
no drawn block is shown
I swipe up on the empty time grid of {date}
the time grid has scrolled
I long-press the empty time grid on {date} at {time} and let go
```

- "I draw a block on D from T1 to T2": scrolls T1 of D into view, presses on empty grid space of D's day column at T1
  (mouse press; on the phone a finger held 500 ms), moves in 10 steps to T2 (auto-scrolling as needed) and releases.
  The times are exact grid positions, so T1 later than T2 draws upwards and off-quarter times test the snapping.
  "I draw a block from D1 T1 to D2 T2" is the same across day columns (week view). "I hold a drawn block ..." does the
  same without releasing; the world's cleanup releases it.
- "the drawn block is shown on D from T1 to T2": the visible `draw-block` segment in D's day column has
  `data-start-time` T1 and `data-end-time` T2 (`24:00` = end of day) and its top/height match the grid within ±3 px.
  "no drawn block is shown": no `draw-block` is on the page.
- "I long-press the empty time grid on D at T and let go": a finger held 500 ms on empty space of D's day column at T,
  released without moving (phone).
- "I swipe up on the empty time grid of D": a finger swipe (no hold: touch start, 10 moves 200 px up within 200 ms,
  touch end) on empty space of D's day column. "the time grid has scrolled": the time grid's scroll container's
  `scrollTop` differs from its value before the swipe.
- "Google contains an event X from D1 T1 to D2 T2": like the one-day step, for a timed event ending on another day.
## Places for an event's location (`@location`; `@id:event-location`)

The device asks the place search and the map pictures directly, at the addresses `/api/config` hands it
(`placeSearchUrl`, `mapTileUrl`). In TEST_MODE those addresses point at the test server itself, so a test never reaches
the real hosts: `POST /api/__test/places` (`{ places: { name, address, lat, lon }[] }`, cleared by reset) sets the places
its fake search knows (Photon's GeoJSON answer shape), and its fake tile route answers plain generated pictures. As a
second guard the Chromium projects resolve no host other than the test server's (`--host-resolver-rules` in
`playwright.config.ts`; a `context.route` guard would turn off the HTTP cache for every scenario), so any request to
another host fails.

```
the place search knows:
I type {string} in the event field {string}
I see the place suggestions:
I see no place suggestions
the suggestions credit OpenStreetMap
I pick the place suggestion {string}
I press Arrow down in the event field {string}
the event dialog shows a map with a pin on {string}
the event dialog shows no map
the event dialog shows a map placeholder for {string}
the map credits OpenStreetMap
the event dialog shows no error
the calendar contains an event {string} on {date} from {time} to {time} at the place {string}
the calendar {string} contains an event {string} on {date} from {time} to {time} at the place {string}
I have seen the map of the event {string}
Google changes the location of the event {string} to {string}
I tap the map
the OpenStreetMap page of the place {string} opens in a new tab
the phone is asked to show the place {string} in a maps app
I ask to find the location on the map
the event form starts with the fields {string}
the location's address line says {string}
the location has no address line
the map is shown without scrolling the event dialog
```

- "the place search knows:" (table `name`, `address`, `latitude`, `longitude`): `POST /api/__test/places`. The fake
  answers the places whose name or address contains every typed word (case-insensitive), in table order, at most 5.
- "I type T in the event field F": focuses the field, clears it and types T key by key (as a person does, so the
  suggestions' pause applies), then waits 1 s or until `place-suggestions` shows, whichever is first.
- "I see the place suggestions:" (table `name`, `address`): the `place-suggestion` rows of `place-suggestions`, in
  order, each with `place-suggestion-name` and `place-suggestion-address`. "no place suggestions": `place-suggestions`
  is not visible (checked after the pause plus 1 s). "the suggestions credit OpenStreetMap": `place-suggestions-credit`
  is visible and contains `© OpenStreetMap`.
- "I pick the place suggestion N": taps the `place-suggestion` whose name is N. "I press Arrow down in the event field
  F": the `ArrowDown` key in that field (the first suggestion becomes `aria-selected`).
- "the event dialog shows a map with a pin on N": `event-map` is visible, its `data-lat`/`data-lon` equal the place N
  of the known places (4 decimals), `event-map-pin` is visible inside it and every map picture has loaded
  (`data-loaded="true"`). "no map": neither `event-map` nor `event-map-placeholder` exists. "a map placeholder for N":
  `event-map-placeholder` is visible, holds the pin and the text N, and no map picture is shown.
- "the map credits OpenStreetMap": `event-map-credit` is visible on the map (inside its box, not covered) and contains
  `© OpenStreetMap`.
- "the event dialog shows no error": `event-error` does not exist.
- "… at the place N": creates the event through the public API with the location `<name>, <address>` of the known place
  N and its place (`place: { name, lat, lon }`); "the calendar C contains …" inserts it into C as another Google client
  would, with the same private extended properties the app writes.
- "Google changes the location of the event T to L": patches the Google event's `location` as Google Calendar would,
  leaving its private extended properties as they are.
- "I have seen the map of the event T": opens the event, waits for "a map with a pin", then closes the dialog; the map
  pictures are then in the device's cache.
- "I tap the map": taps `event-map` (or the placeholder). "the OpenStreetMap page of the place N opens in a new tab":
  a new page opens whose URL is the OpenStreetMap page marking N's position.
- "the phone is asked to show the place N in a maps app": native, proven by the app's own tests (a `geo:` intent with
  N's position and name); `@backlog` for Playwright.
- "the location's address line says A": `event-location-address` (the small line right under the location field) is
  visible with exactly A; "has no address line": it does not exist. After a pick the location field holds only the
  place's name; Google gets `<name>, <address>` (check with "the Google event … has:").
- "the event form starts with the fields L" (comma-separated field names as in form tables): the first fields of the
  event form (`[data-field]`, in document order) are exactly these. "the map is shown without scrolling the event
  dialog": with the dialog's scroll position at the top, `event-map` lies fully inside the visible part of the dialog.
- "I ask to find the location on the map": taps `event-location-find` next to the location field; the suggestions for
  the field's text show.

## Android app and widgets (native, `@android-app`, `@phone-widget`)

```
the app runs inside the Android app
the morning overview is on at {time}
a notification {string} is planned for {date} {time}
a notification {string} saying {string} is planned for {date} {time}
the notification {string} planned for {date} {time} counts down to {date} {time}
from {date} {time} the notification {string} shows no countdown and goes away at {date} {time}
a {string} notification shows
its status bar icon is the {string}
the phone widget refreshes
the phone widget does not show the event {string}
the phone widget shows the event {string} on {date} at {time}
the app hands the widget an older copy of the week with {string} at {time}
the phone widget is not redrawn
I look at the day widget
the day widget shows the event {string} from {time} to {time}
I look at the clock widget
the clock widget says {string}
```

- "counts down to D T": the scheduled native reminder carries that start (`setWhen` + a counting-down chronometer).
  "from D T … shows no countdown and goes away at D2 T2": at the start an alarm re-posts it silently without the
  chronometer, and `setTimeoutAfter` removes it at the end (the event's end; wake-up for bedtime).
  "a K notification shows" / "its status bar icon is the I": the notification of kind K (event reminder, task list
  reminder, morning overview, bedtime reminder) uses the small icon I (`ic_stat_event` calendar page, `ic_stat_tasklist`
  checklist, `ic_stat_summary` sunrise, `ic_stat_bedtime` moon). Proven by `ReminderNotificationTest`.
- "the morning overview is on at T" also runs in the browser suite (Web Push): `PATCH /api/prefs { notify: { morning: true,
  morningTime: T } }`.
- These run on Android, not in the browser suite: the app's and the widget's own tests (`android/app/src/test`) or a
  device prove them. They stay `@backlog` for Playwright, which skips them.

## Header layout (`@id:header-layout`; setting `settings-header-layout`, pref `headerLayout`)

```
the header layout is set to {string}
the top bar is in one row
the top bar is in two rows
the top bar is at most {int} pixels tall
the period title is not cut short
the period title's font size is {int} pixels
the period title's chevron is shown
the Today button is an icon with the label {string}
the Today button shows the word {string}
the top bar's buttons are at least {int} by {int} pixels
the top bar's buttons other than the plant are at least {int} by {int} pixels
the plant's tap area is at least {int} by {int} pixels
the downloaded theme file has no header layout
the Today button shows that today is on screen
the Today button does not show that today is on screen
the day view shows no day header
the week view shows {int} day headers
the all-day row is shown
the all-day row is not shown
the tasks section switch is shown
the tasks section switch is not shown
I pick up the task list {string}
the top bar scene does not show the {string}
the Approaching card is off
I see the Approaching card
I switch off the time left in the Approaching card in the settings
the event {string} shows {string} after its time
the event {string} shows no time left
I see the sync icon
I do not see the sync icon
the sync icon shows a problem
the {string} switch in the settings is off
the sync indicator is on
I note where the top bar's controls are
I turn on left-handed mode
every control of the top bar is at the mirror image of where it was, within {int} pixel
the period title's text is aligned to the outer edge
the top bar's widgets are in reverse order
```

- Layout names are the pref values' old names: `Two rows` = pref `two-rows` (Expressive), `One row` = `one-row` (Compact); the default is `auto`. "the header
  layout is set to L" (Given) sends `PATCH /api/prefs { headerLayout }` through the API before the page is opened. The setting is
  now chosen with "I choose S as the top bar size" (see "UI redesign E").
- "the top bar is in one row": the visible `period-title`, `nav-today` and `settings-button` (and `nav-prev` / `nav-next`
  where shown: desktop with a mouse) have vertical centres within 6 px of each other. "in two rows" (Expressive): the `top-bar` is at least 80 px tall (one row of controls over the full scene, the scene's strip below).
- "the top bar is at most N pixels tall": the `top-bar` box height minus the top safe-area padding is at most N (1 px slack).
- "the period title is not cut short": the title text (`period-title .t`) has `scrollWidth <= clientWidth`. "the period
  title's font size is N pixels": the computed `font-size` of `period-title .t` is N px. "the period title's chevron is
  shown": the `svg` (the ⌄ expand icon) inside `period-title` is visible.
- "the Today button is an icon with the label L": `nav-today` has `aria-label` L, contains an `svg` and no visible text.
  "the Today button shows the word W": `nav-today`'s visible text is W.
- "the top bar's buttons are at least W by H pixels": for every visible `button` inside `top-bar` (title, arrows, Today,
  filter, settings, plant, install), `document.elementFromPoint` at the four edge midpoints 1 px inside a W x H box
  centred on the button (the middle of its top, bottom, left and right side) returns the button or a descendant (not the
  corners: hit testing follows a round button's rounded corners): the hit area is at least W x H even where the drawn control is
  smaller. The streak flame (`streak-flame`) and the sync icon (`sync-status`) are not buttons and are not checked.
  "... other than the plant ...": the same, leaving out `plant-button`. "the plant's tap area is at least W by H
  pixels": the same check for `plant-button` alone (W wide, H tall).
- "the downloaded theme file has no header layout": the JSON of the last downloaded theme file contains no key
  `headerLayout` (at any depth) and no key whose name contains `header` other than the scene keys.
- "the Today button shows that today is on screen": `nav-today` has `data-today-shown="true"` and is filled (the
  built-in tonal look: the computed background of its drawn shape, the `.pill` inside on phones and the button itself on
  wide screens, is the secondary container colour, no outline). "does not show":
  `data-today-shown="false"`, it has an outline (border at least 1 px wide) and its computed background is the surface
  colour with alpha 1 (solid, so the scene never shows through). "Today is on screen" means today is in the period the title names (the
  month's own days, not the neighbouring months' days in its grid; the week; the day; on the Labs timeline, the now
  marker inside the timeline's box). The views must have rendered (`month-cell`, `week-header`, `day-column` or
  `timeline-now` visible) before the check.
- "the day view shows no day header": the `day-view` is shown and there is no visible `day-header`. "the week view shows
  N day headers": N visible `week-header` elements.
- "the all-day row is shown": the all-day row of the first time grid (`day-allday-area`, or the `week-allday-cell`s)
  is visible and at least 18 px tall
  (one entry's height on a phone; the row is as tall as its entries). "is not shown": the all-day band (`.alldays` of the first time grid) is absent or
  0 px tall.
- "the tasks section switch is shown": `tasks-section-toggle` is visible; "is not shown": no visible `tasks-section-toggle`
  in the first time grid (it shows only when task lists are in the all-day row).
- "I pick up the task list X": scrolls X's card into view and presses and holds it (mouse press; on a phone a 500 ms
  long-press) until `data-dragging="true"`, then moves 10 px so the drag starts; the pointer stays down.
- "the top bar scene does not show the X": no visible element for part X (`hare` = `.tbs .hare`) in the scene.
- "the Approaching card is off"
  (Given): `PATCH /api/prefs { approachingCard: false }`. "I see the Approaching card": `now-card` is visible.
- "I switch off the time left in the Approaching card in the settings": opens the settings and turns
  `settings-approach-time-left` off (pref `approachTimeLeft`), waiting for the `PATCH /api/prefs` response.
- "the event X shows T after its time": X's `event-chip-time` text ends with `· T` (a middle dot, then T).
  "shows no time left": X's `event-chip-time` is visible and has no "left" part. The time left updates with the app clock.
- Sync icon (`sync-status`, pref `syncIndicator`, default off). The element always stays in the page with its
  `data-state` and `data-last-sync` (the sync waits above read it); what changes is whether it is drawn. "I see the sync
  icon": `sync-status` is visible. "I do not see the sync icon": `sync-status` is not visible (hidden, and it takes no
  room in the top bar). "the sync icon shows a problem": `sync-status` is visible with `data-state="error"`. The switch
  is `settings-sync-indicator` (label "Sync indicator", Settings › Calendar) and is turned on with the generic
  `I turn on {string} in the settings` step; "the X switch in the settings is off" = the switch labelled X on the open
  settings page has `aria-checked="false"`.
- Left-handed mirror (owner, 2026-10-26). "the sync indicator is on" (Given): `PATCH /api/prefs { syncIndicator: true }`.
  "I note where the top bar's controls are": records, for each visible control of `top-bar`, its box relative to the
  `top-bar` box: `period-title`, its text (`period-title .t`) and chevron `svg`, `nav-today`, `streak-flame`, `plant-button`, `sync-status`, `filter-button`, `settings-button`, and the top bar's width W. "I turn
  on left-handed mode": `PATCH /api/prefs { leftHanded: true }`, then reloads the same page and waits for the
  calendar. "every control of the top bar is at the mirror image of where it was, within N pixel": for each noted
  control, its left-handed box (relative to `top-bar`) has the same top, width and height and a left of W − (old left +
  old width), each within N px (phones have no ‹ › arrows to compare). "the period title's text is aligned to the outer edge": the right edge of
  `period-title .t` is at the right edge of `period-title`'s content box (within 1 px), with no free room to its right.
  "the top bar's widgets are in reverse order": the visible widgets (`streak-flame` / `plant-button`, `sync-status`)
  are ordered right to left as they were left to right.
- The `@visual` region `top bar` is `top-bar` (scene and controls, the top safe area excluded); baselines are named
  `expressive-<scene>-<size>-<scheme>` (feature header-expressive).
- Scene hooks: heroes are the `data-part`s `cat`, `hare`, `mordor-eye`, `mordor-tower`, `moon`, `sun`, `sunrise`, `xmas-tree`, `snowman`,
  `beach-umbrella` (always drawn, inside the bar within 2.5 px, never under a drawn control); the other large props `autumn-tree`,
  `snowy-tree`, `bare-tree`, `sprouting-tree`, `jack-o-lantern`, `sledge`, `leaf-pile` are decoration and are not judged (owner 2026-10-30:
  they stay where they are, even partly under a control or cut by the bar). A control's drawn box is its text, its icon's shapes or the Today `.pill`. The sunflower field has no cat.


## Security, secrets at rest and privacy (`@security`, `@secrets`, `@privacy`; features security-hardening, secrets-at-rest, privacy, shared-lists)

These scenarios describe behaviour that is already built. Two groups (the HTTP steps are in `e2e/steps/security.steps.ts`):

- **HTTP steps (the scenarios without `@unit`)**: run against the TEST_MODE server through Playwright `request`
  (no browser), keeping the last response like `I request {string}`.
- **Server-start and file steps (the scenarios tagged `@unit`)**: they need a server started with other environment
  settings or a look into the data folder, which the e2e server cannot do. Each scenario names the unit test that
  covers it in a comment, so these steps have no e2e implementation. If e2e ever grows a "fresh server with these
  settings" helper (see "I request ... on a fresh server" under Performance), they can be built on it and lose the tag.

```
the response header {string} is {string}
the response header {string} contains {string}
the Content-Security-Policy allows the inline script of the page by its fingerprint
I send {string} with the header {string} set to {string}
I send {string} with the body {string} as {string}
I send {string} with a body of {int} kilobytes
the response status is not {int}
I request {string} with the cookie {string}
the response text contains {string}
the page is the privacy policy
the calendar is not shown
the privacy policy names {string} and says what it sees: {string}
the privacy policy names the map picture service and says what it sees: {string}
the privacy policy names the place search and says what it sees: {string}
the privacy policy says the device, not the server, asks it
the privacy policy says there is no advertising, tracking or analytics
the privacy policy says the only outside parties are Google and the two map services
```

- "the response header X is Y" / "contains Y": the header of the last response (name case-insensitive), compared exactly
  or as a substring. The security headers are the ones `server/src/lib/securityHeaders.ts` sets (spec/API.md, "Sign-in").
- "the Content-Security-Policy allows the inline script of the page by its fingerprint": requests `GET /index.html`,
  computes `'sha256-<base64 of the SHA-256 of the text>'` for every `<script>` without `src`, and checks each is in the
  `script-src` part of the last response's policy.
- "I send "METHOD /path" with the header H set to V": a request without body but with that header, last response kept. The
  header `origin` is sent as given (`null` is the text "null").
- "I send "METHOD /path" with the body B as T": body text B with `Content-Type: T`; "with a body of N kilobytes": a JSON
  object `{ "pad": "x..." }` of N KB with `Content-Type: application/json`.
- "I request "METHOD /path" with the cookie "name=value"": the request carries that `Cookie` header and no other session.
- "the response text contains T": the body of the last response as text includes T.
- "the page is the privacy policy": the browser page shows a heading "Privacy policy" (`h1`). "the calendar is not shown": no
  `week-view`, `month-view` or `signin-google` test hook, and the document is not the app shell (`#app` absent).
- Privacy text checks use the last `GET /privacy.html` response. "names X and says what it sees: "a, b"": the page text
  has X and every comma-separated phrase. "the map picture service" is the tile host and "the place search" the Photon
  host named on the page. "the device, not the server, asks it" = the page text says the device (not the server) contacts
  them. "no advertising, tracking or analytics" = those three words are in the "What is not done" list. "the only outside
  parties are Google and the two map services" = the same list says apart from Google the only third parties are the two
  map services.
```
the server has a valid encryption key
the server is set up for real Google sign-in
the encryption key is {string}
the server starts
the server restarts
the server keeps running
it starts
it refuses to start
it tells the operator that the encryption key must be 32 bytes in base64
{string} has a Google connection stored unencrypted from before
{string} has a Google connection stored encrypted
the server next uses the Google connection of {string}
the stored Google connection of {string} is {string}
the stored Google connection of {string} does not contain the connection in readable form
the stored Google connection of {string} can be read by the server's own user only
{string} is connected to Google
{string} is not connected to Google
{string} is not asked to sign in again
{string} is asked to sign in with Google again
the stored sessions hold a fingerprint of the sign-in cookie and not the cookie value itself
{string} has a session stored in the old readable form
{string} is still signed in
the server runs as the demo, without Google sign-in
the server is set up for {string}
the operator allows running open on purpose
it tells the operator to turn on Google sign-in or to run open on purpose
the server is set up with the default place search and map picture services
the Content-Security-Policy lets the page reach outside only the place search and the map picture services
the operator set the place search address to {string}
the place search address is the public default
the server is set up with a public address and one other allowed address
a write from the public address is accepted
a write from the other allowed address is accepted
a write from a foreign website is refused
{string} shares the task list {string} with {string}
a second shared list file on the server is damaged because {string}
the damaged file is left out and noted in the server log
the Drive backup of {string} holds the shared list {string} and one damaged shared list
{string} restores from the Drive backup
the shared list {string} is back
the damaged shared list is left out and noted in the server log
```

- These steps are unit-level (see the unit test named above each scenario); they are not implemented in `e2e/steps/` and
  their scenarios are skipped by the `@unit` filter. Meaning of the setup phrases, for whoever builds them: "the server is set up
  for "an https public address" / "production mode" / "a local http address" / "development mode" / "no address at all""
  = `PUBLIC_URL=https://...` / `NODE_ENV=production` / `PUBLIC_URL=http://localhost:3000` / `NODE_ENV=development` / neither;
  "runs as the demo" = `PROVIDER=mock` (or unset); "allows running open on purpose" = `ALLOW_INSECURE_MOCK=1`; "the
  encryption key is missing / too short / 32 bytes in base64" = `TOKEN_ENC_KEY` unset / 16 bytes / 32 bytes;
  "damaged because ..." = the shapes listed in `server/test/hardening-shared.test.ts`.

## Settings per person (`@settings`, `@unit`; ADR 0035)

Server-file scenarios, covered by unit tests (`server/test/settings-per-person.test.ts`); not run by the browser suite.
"the server kept one set of settings for everybody" = the retired `DATA_DIR/settings.json`; "had signed in before" =
their entries in `people.json`; "the updated server starts" = the start-up split (`server/src/services/personSplit.ts`).

```
{string} chooses the default view {string}, Calm mode, no animations, sounds, the theme mode {string} and the full sunflower field
{string} checks in
{string} has the default settings: the default view {string}, Calm mode off, full animations, no sounds, the theme mode {string} and growing sunflowers
the categories of {string} are {string}
the streak of {string} is {int} days
the server kept one set of settings for everybody with the default view {string} and the category {string}
{string} and {string} had signed in before
the updated server starts
{string} has the default view {string} and the categories {string}
the old settings file is kept as {string}
```

## Damaged data files (`@data`, `@unit`; feature damaged-files)

Server-file scenarios, covered by unit tests (`server/test/personJsonStore.test.ts`); not run by the browser suite.

```
the stored preferences of {string} are damaged
{string} changes a preference
{string} has the default preferences plus the change
the damaged file is kept as {string} with its old content
```

## UI redesign E, Material 3 Expressive (`@id:ui-expressive`, `@id:nav-expressive`, `@id:header-expressive`, `@id:tasks-toolbar`; ADR 0032)

Built so far: the bottom bar, side menu, top bar size and scene steps (`e2e/steps/nav-expressive.steps.ts`, `header-expressive.steps.ts`) and the
filled-button, icon-label and theme-corner steps (`ui-expressive.steps.ts`); the rest (dialogs, settings, overflow, button group, lint gate, tasks toolbar). "filled" = the button's drawn background (the Today `.pill`) is the `--md-sys-color-primary` or `--md-sys-color-primary-container` colour; "fully round" is checked for the bottom bar and the icon and view buttons of both bars (not the date title, a text button, nor the + button, an M3 rounded square). Prefs: `bottomBarSize` `auto|expressive|compact` (auto = Compact on phones, Expressive elsewhere); `headerLayout`
`auto|two-rows|one-row` (`two-rows` = Expressive, `one-row` = Compact, same auto rule); `navPhone` gains `drawer` = "Side menu".
Desktop and tablets keep one rail size. "the bottom bar size S is the default" / "the top bar size S is the default" check that the
pref is still `auto` and that `bottom-bar` / `top-bar` carry `data-size` S.

```
the surface has one filled {string}
every other button of the surface is tonal, outlined or text
the dialog has one filled {string}
every other button of the dialog is tonal, outlined or text
no button of the settings screen is filled
the {string} is an icon with the label {string}
every icon-only button of the screen has an accessible label
I open the overflow menu of the task list {string}
the overflow menu lists {string}
the task list {string} shows one overflow button and no other action button
the button group shows {string} as one connected group
exactly one of them is selected
I press {string} in the button group
the {string} button of the group is selected
a component outside {string} contains a raw button element
the lint gate runs
the lint gate fails and names that component
a button element inside {string} passes the lint gate
the theme is {string}
the bottom bar, the top bar and every button are drawn with fully round corners
the bottom bar size is set to {string}
I choose {string} as the bottom bar size
the bottom bar size {string} is the default
the bottom bar floats above the calendar
the bottom bar shows the open tasks {string} with the names {string}
the bottom bar has no open tasks row
the open tasks row is hidden
the open tasks row is shown
the bottom bar floats {int} pixels from the edges of the screen
the calendar continues behind the bottom bar
the calendar ends above the bottom bar
nothing is reserved at the bottom of the screen
the bottom bar is {int} pixels tall
every item of the bottom bar shows an icon and a label
only the open view of the bottom bar shows a label
the create button is beside the bottom bar
the settings offer no rail size
I scroll the calendar down by {int} pixels
I scroll the calendar up by {int} pixels
the bottom bar is hidden
the bottom bar is shown
the create button is shown
the add button covers no hour of the time grid
the menu button is on the {string} side of the top bar
I open the side menu
I close the side menu
the side menu lists {string}
the side menu has the {string} entry at its bottom
I choose {string} in the side menu
the side menu is closed
the side menu shows the calendars {string} with a colour checkbox each
I untick the calendar {string} in the side menu
the top bar has no filter button and no settings button
the top bar has no filter button
the top bar size is set to {string}
I choose {string} as the top bar size
the top bar size {string} is selected
the top bar size {string} is the default
the top bar scene is drawn at its full {int} pixels height
the Today button is the only filled button of the top bar
the top bar icons have no see-through background
I tap the period title
the support cat is fully visible in the top bar scene
every large element of the top bar scene is fully visible
no control covers any part of the top bar scene's large elements
the Mordor eye and tower sit between the period title and the top bar's icons
no visitor of the top bar scene is ever drawn under a control
the floating toolbar offers {string}
the floating toolbar is beside the create button
the tools of the floating toolbar are tonal icon buttons with labels
I press {string} in the floating toolbar
I choose {string} as the sort order
the Tasks view lists {string} in that order
the floating toolbar is hidden
the floating toolbar is shown
```

- "the bottom bar floats N pixels from the edges of the screen": the `bottom-bar` box has N px left, right and below it (the
  test viewport has no safe-area inset). "the calendar ends above the bottom bar": the bottom of every visible
  `[data-scroll-area]` and of `task-tray` is at or above the top of the bar. "nothing is reserved at the bottom of the
  screen": the lowest of the visible `[data-scroll-area]` and `task-tray` boxes ends within 1 px of `innerHeight` (the room
  of a slid-away bar is given back). "the calendar continues behind the bottom bar": the same lowest box ends within 1 px of
  `innerHeight`, i.e. under the floating phone bar.
- Open tasks row (tray option C, feature open-tasks-in-sight): on a phone the open tasks are the row `task-tray-toggle` inside
  the `bottom-bar` element: `task-tray-count` ("3 open") and one `task-tray-chip` per open list in tray order (their texts joined
  by ", " are the names). "the bottom bar shows the open tasks C with the names N": the count text is C and the chip texts joined
  are N, both inside `bottom-bar`. "has no open tasks row": no `task-tray-toggle` inside `bottom-bar`. "the open tasks row is
  hidden / shown": the row's box is out of / inside the viewport (it slides with the bar). Hooks: `task-tray-toggle`, `task-tray-count`, `task-tray-chip`.
- Meaning, for the builder: "filled" = a solid primary-coloured container (M3 filled button, FAB); "tonal" = secondary
  container; icon-only buttons are judged by their `aria-label`. "fully round corners" = computed radius at least half the
  shorter side. "the bottom bar is N pixels tall" is the `bottom-bar` box without the safe-area inset. "hidden" = moved out of
  the viewport (`data-hidden="true"`), "shown" = fully inside it. "the surface" is the visible screen without an open dialog.
- "no raw buttons outside m3": the lint gate (`vue/no-restricted-html-elements` in `eslint.config.js`, run by `pnpm verify`; its message says
  "no raw buttons outside m3") rejects a bare `<button>` in `web/src/**` outside `web/src/components/m3`. Proven by a unit
  test; the scenario is `@unit` and skipped by e2e.
- "the Mordor eye and tower sit between ...": the `data-part` boxes `mordor-eye` and `mordor-tower` lie horizontally between
  the right edge of `period-title` and the left edge of the first icon.
- Side menu hooks: `menu-button`, `side-menu` (`data-open`), `side-menu-view-<year|month|week|day|tasks>`,
  `side-menu-calendar` (`data-name`, checkbox), `side-menu-settings`; floating toolbar `tasks-floating-toolbar` with
  `tasks-filter-open|tasks-sort-open|tasks-collapse-all`; overflow `tasklist-overflow` (menu items `tasklist-edit|duplicate|archive|save-template|delete`); group = the `role=group` named "Tasks".
## Handwritten lists (`@id:handwritten-lists`, Labs; the `@backlog` scenarios are not built yet)

```
the Labs switch {string} is on
the checkbox of the item number {int} is right of its grip handle
the writing of the item number {int} starts at least {int} pixels right of its grip handle
the Labs switch {string} is off
the device reports pen support
the device reports no pen support
the device is an Android tablet that reports pen support
the writing mode is {string}
the calendar contains a task list {string} on {date} with the ink items {string}
the calendar contains a task list {string} on {date} with the ink items {string} in the colour {string}
the calendar contains a task list {string} on {date} at {time} for {int} minutes with the text item {string} and the ink item {string}
"jo@example.com" has an undated task list {string} with the ink items {string}
the expanded task list {string} has more ink items than fit the screen
I open the new task list form
I open the new task list form on a screen {int} pixels wide
I press the writing mode switch
the new list form has no writing mode switch
the new list form shows the writing mode switch with the pen icon
the writing mode is {string} and the switch shows the pen icon
the writing mode is {string} and the switch shows the keyboard icon
the item writing area offers no writing mode switch
I write an ink item with the pen
I write an ink item on the note {string} with the pen
I draw a stroke with the pen
I drag with the mouse over the writing area
I click the ink item number {int} with the mouse
I click the next empty line and type {string}
I drag the grip handle of the item number {int} above the item number {int} with the pen
I long-press the item number {int} with the mouse and drag it above the item number {int}
I long-press the item number {int} with a finger and drag it above the item number {int}
the dialog shows no ruled lines to write on
typing in the item field works as without the feature
I swipe up on the writing area with a finger
I rest my palm on the writing area and draw a stroke with the pen
I tap the ink item number {int} with a finger
the stroke is drawn on the line
the stroke is drawn on the line, thicker where I pressed harder
I draw a stroke with the pen at the pressure {float}
the harder stroke is thicker, but at most {float} times as thick as the lighter one
I draw a stroke {int} pixels downwards with the pen on the ink item number {int}
the list has not scrolled
I hold the pen over the ink item number {int}
I move the pen away from the writing area
the writing area does not let the browser pan
the writing area lets a finger pan the list up and down
I touch the ink item number {int} with a finger
I switch the Labs setting {string} on
I drag one finger along the writing area
I drag one broad finger along the writing area
I drag one finger along the writing area after resting it for {int} ms
I drag one finger along the ink item number {int}
I drag one finger along the ink item number {int} after resting it for {int} ms
only the pen stroke is drawn
nothing is drawn
the list scrolls
a pen stroke on the card draws nothing
the expanded task list has {int} items
I tick the item number {int}
the item number {int} is ticked
the item number {int} is ticked and nothing is drawn
I can still tick the item number {int}
I drag the item number {int} above the item number {int}
I delete the item number {int}
the ink items are in the order {string}
the card of {string} shows {int} ink items, scaled down
the ink of the card of {string} reads on the card
the ink of the card of the untitled task list is as tall as the card's text
the checkbox of every item of the card of {string} is centred on its row
the card of the untitled task list shows the ink as its title
the task list {string} shows {int} ink items, scaled down
the note {string} shows {int} ink items
the dialog is larger than without the feature
the dialog is as large as without the feature
the dialog shows ruled lines to write on
the item fields are ruled, ordinary text fields
the form has no button that turns ink into text
the device's handwriting recognition enters the text {string} in the item field
the collapsed task list shows the items {string}
the backup to Drive runs
the backup holds the ink of the task list {string}
the Labs setting {string} is on
the Labs setting {string} is off
the dialog fits the window
I draw a stroke with a finger
I swipe up on the writing area with two fingers
I draw {int} stroke(s) with the pen
I have drawn {int} stroke(s) with the pen
I press the undo button
the writing area shows {int} stroke(s)
the device passes the pen double tap on
I double tap the pen
I touch the first stroke with the eraser end of the pen
I touch the first stroke with the pen
I press the eraser button
the task list {string} holds about 200 KB of ink
the app says the list is full and suggests starting a new list
the stroke has the theme's text colour
I choose the ink colour preset {string}
the stroke is red
I choose the custom ink colour {string} in the colour picker
I choose the custom ink colour {string}
the stroke has the colour {string}
the theme is dark
the stroke is adjusted so it is readable on the dark background
the chosen ink colour is {string}
I add the text item {string}
the item number {int} is an ink item
the item number {int} is a text item
I draw a stroke with the pen on the ink item number {int}
the ink item number {int} has one more stroke
the template {string} has the ink items {string}
I create a task list from the template {string}
the new task list shows {int} ink items, scaled down
the calendar contains a repeating task list {string} with the ink items {string}
the next occurrence of the task list {string} is created
the next occurrence shows {int} ink items, scaled down
the home-screen widget lists the task list {string}
the widget shows {string} {int} times for the task list {string}
a screen reader reads the item number {int} as {string}
the calendar contains a task list {string} finished on {date} with the ink items {string}
the title field is an ordinary text field
the title field is not a writing area
two devices have the task list {string} open
the first device writes an ink item while offline
the first device erases the ink item number {int} while offline
the second device draws a stroke on the ink item number {int} while offline
both devices reconnect
both devices show {int} items in the task list {string}
both devices show the ink item number {int} with {int} stroke(s)
the ink item number {int} has the same strike line as the text item number {int}
the ink item number {int} is faded to about half
I note where the writing tools are
every writing tool is at the mirror image of where it was, within {int} pixel
I expand the task list {string} on a screen {int} pixels wide
the ink of the item number {int} has the same proportions to its line as on a {int} pixel wide screen
the ink of the item number {int} is not cut off
I delete the task list {string}
the server holds {int} ink item(s) for the task list {string}
the server holds no ink for the task list {string}
```

- Ink items are created through the public API with a stroke list per item (`{ strokes: [[x, y, pressure]…] }`); the
  Google description of an ink item is `☐/☑ Handwritten item` (assumption A3 of the feature).
- "the Labs switch X is on/off": the switch `settings-labs-handwriting` in Settings > Labs (pref `labsHandwriting`).
- Pen and finger strokes are dispatched as Pointer Events with the matching `pointerType`; a mouse drag (`pointerType` mouse) over the writing area must leave the ink unchanged (decision R1); the grip handle is the item's drag handle (`Drag <item> to reorder`), a pen drag on it moves the item, a pen drag elsewhere on the line draws (R3); "pen support" is the
  `maxTouchPoints`/`PointerEvent` pen capability the device reports; "palm" is a simultaneous `touch` pointer.
- "the ink items are in the order X": the ink items' ids, in list order, as the comma-separated names given at creation
  (the n-th ink item of the creating step is named by the n-th word).
- "the add button covers no control of the writing area" is an added panel name of the existing step.
- "the Labs setting X is on/off": the setting row of Settings > Labs (`settings-labs-draw-with-finger` for "Draw with
  finger", pref `labsDrawWithFinger`), set through `PATCH /api/prefs` before the page opens. With it on, a finger stroke
  is a `touch` pointer drawing; "two fingers" scroll is two simultaneous `touch` pointers moving.
- Pen width and panning (Windows pen): "at the pressure P" is a synthetic `pen` stroke with that constant pressure; "the harder stroke
  is thicker, but at most R times as thick as the lighter one" measures each stroke path across its middle (`isPointInFill`, line
  heights). "I draw a stroke D pixels downwards with the pen on the ink item N" and "I hold the pen over / move the pen away from"
  use the browser's own pen input (CDP `Input.dispatchMouseEvent` with `pointerType: 'pen'`, hover = `mouseMoved`); "the list has not
  scrolled" compares the scroll container's `scrollTop` with its value before the stroke; "does not let the browser pan" /
  "lets a finger pan the list up and down" are the computed `touch-action` of the item's `ink-line` (`none` / `pan-y`). "I touch the ink item N with a finger" sends one synthetic `touch` `pointerdown` to the line.
- "I drag one finger along the writing area" is a real touch (CDP) of 12 moves of 12 px; "broad" has a contact radius of 24 px; "after resting it for N ms" first creeps 1 px and waits N ms (a hesitant start), then drags.
- Undo, eraser, colour: `ink-undo`, `ink-eraser` (toggle), `ink-color-<preset>` and `ink-color-custom` (colour picker).
  "the eraser end of the pen" is a `pen` pointer with `buttons` 32 (eraser) per Pointer Events; "double tap the pen" is
  the `pointerrawupdate`/`squeeze`-style pen event the browser passes on (best effort, only where the device does).
- "holds about 200 KB of ink" creates strokes through the API until the list is just under the 200 KB limit.
- "the dialog … without the feature": compared with the dialog size measured with the switch off.
- Offline / sync (G1): "the network connection is lost / restored" are the existing steps; the ink is written into the
  device outbox and pushed on reconnect. "two devices" = two browser contexts of the same person; "the first / second
  device ... while offline" sets that context offline, acts, and keeps it offline until "both devices reconnect", which
  restores both in the order first, second and waits for both to have synced. Steps are applied in the order written, so
  "later" means the later step. A seeded ink item holds one stroke (A9); "erases the ink item" removes all its strokes.
- Widget (G2): `@unit`, proven by the Android unit test named in the scenario (`WeekDataTest`); the widget is native and
  cannot be driven from a browser. An ink item is the text "Handwritten item" there. Notifications never show item text
  and the door board is deactivated (owner 2026-10-30).
- Screen reader (G3): "a screen reader reads the item number N as T" = the accessible name of the Nth item (`aria-label`)
  equals T; "Handwritten item N of M" with ", ticked" appended when ticked. The search of ink lists uses the existing
  Archive steps ("I search the Archive for", "the Archive lists"); "finished on {date} with the ink items" creates the
  ink list and ticks every item while the test clock stands on that date.
- Title (G4): "an ordinary text field" = the title `input` is a text input without an ink canvas; "not a writing area" = no
  `ink-writing-area` inside the title field's row.
- Strike and fade (G6): "the same strike line" = the computed `text-decoration-line`/colour/thickness of the ink item's
  strike layer equals the text item's; "faded to about half" = computed opacity between 0.4 and 0.6.
- Left-handed writing tools (G7): "I note where the writing tools are" records the boxes of the mode switch, `ink-undo`,
  `ink-eraser` and the colour control relative to the writing dialog; the mirror check works like the top bar's, with
  the dialog's width W.
- Scale (G8): the ink's bounding box divided by its line height is compared with the 1280 px run (tolerance 2 %); "not cut
  off" = the ink's box lies inside the line's box.
- Deletion (A8): "the server holds N ink item(s) / no ink for the task list" asks the public API for the list's ink.

