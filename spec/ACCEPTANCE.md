# Acceptance criteria

Each criterion is met when the listed scenarios pass in **both** Playwright projects (`mobile` first, then `desktop`;
`@mobile` and `@perf` scenarios run only in `mobile`, `@desktop` only in `desktop`) or when the listed check passes.
Feature files are under `spec/features/`; scenario names are quoted exactly.

## Navigation and views

| AC | Criterion | Verified by |
|---|---|---|
| AC-01 | Opening `/` shows the current month at `/month/YYYY-MM`. | navigation: "Opening the app shows the current month" |
| AC-02 | Month grid starts on Monday, contains whole weeks incl. adjacent-month days (marked), 5 or 6 rows. | navigation: "Month grid weeks start on Monday and include adjacent-month days", "Month grid grows to six weeks when needed" |
| AC-03 | Week view shows Monday to Sunday; week URLs are normalised to Monday; titles handle month/year boundaries. | navigation: "Week view shows Monday to Sunday", "A week URL with a non-Monday date is normalised to its Monday", "Week titles across month and year boundaries" |
| AC-04 | Day view shows one day with a full title. | navigation: "Day view shows a single day" |
| AC-05 | Deep links `/month/YYYY-MM`, `/week/YYYY-MM-DD`, `/day/YYYY-MM-DD` open directly (also on a cold load); invalid links redirect to the current month. | navigation: "Deep links open the right view directly", "Invalid deep links redirect to the current month"; health: "Deep links are served by the single-page app" |
| AC-06 | Previous/next move by exactly one period, across year boundaries. | navigation: "Previous and next move by exactly one period"; mobile: "Navigation buttons work as an alternative to swiping" |
| AC-07 | Today button returns to the period containing today. | navigation: "The today button returns to the period containing today" |
| AC-08 | Today is highlighted (exactly once) when visible, nowhere otherwise. | navigation: "The current day is highlighted in every view", "No day is highlighted when today is not visible" |
| AC-09 | View switching keeps the focused date; day numbers / week headers open the day view; browser back works. | navigation: "Switching views keeps today when today is visible", "Switching views keeps the focused date when today is not visible", "Switching from a day view to the week view shows the week containing that day", "Browser back returns to the previous period", "Clicking a day number in the month view opens that day", "Tapping a week column header opens that day" |
| AC-10 | "Today" honours the test clock (`/api/config`). | health: "The config endpoint honours the test clock"; every scenario with "Given today is" |

## Events

| AC | Criterion | Verified by |
|---|---|---|
| AC-11 | Timed events appear in all three views on the right day, with start time, at the right vertical position, and not outside their period (also after DST change). | events-display: "A timed event appears in every view", "A timed event shows its start time", "A timed event chip in the desktop month view shows its start time", "A timed event is placed in its weekday column at its time", "A timed event is placed at its time in the day view", "Events outside the visible period are not shown", "Events after the end of daylight saving time keep their wall-clock time" |
| AC-12 | All-day and multi-day events (all-day and timed across midnight) are shown on every covered day. | events-display: "An all-day event is shown in the all-day area", "A multi-day all-day event is shown on every day it covers in the month view", "A multi-day all-day event crossing a week boundary is split per week", "A timed event crossing midnight is shown on both days" |
| AC-13 | Overlapping events are laid out side by side without visual overlap; back-to-back events use full width. | events-display: "Overlapping events are shown side by side in the week view", "Three mutually overlapping events are all visible in the day view", "Back-to-back events do not count as overlapping" |
| AC-14 | Day entries are ordered (all-day, then by time); crowded month cells show `+N more` linking to the day. | events-display: "Items of a day are ordered all-day first, then by time", "A crowded day in the month view shows an overflow link" |
| AC-15 | Events use their calendar's color; calendar can be chosen. | events-display: "Events take the color of their calendar"; events-crud: "Create an event with description, location and calendar" |
| AC-16 | Create timed, all-day, multi-day and overnight events via "+" or a time slot, with sensible defaults; they persist and reach Google. | events-crud: "Create a timed event with the add button", "A created event is still there after a reload", "The new event form is prefilled with the next full hour of today", "The new event form uses 09:00 on the focused day when it is not today", "Tapping an empty time slot starts an event at that hour", "Changing the start time keeps the event duration", "Create an all-day event", "Create a multi-day all-day event", "Create a timed event spanning two days", "Create an event with description, location and calendar"; mobile: "Create an event on a phone" |
| AC-17 | Validation: end must be after start, title required and ≤ 200 chars; invalid events are not saved. | events-crud: "Invalid events cannot be saved", "An event needs a non-blank title", "An all-day event cannot end before it starts", "A too long title is rejected", "Editing cannot make the end earlier than the start" |
| AC-18 | Edit title, time, date, all-day flag; changes persist in Google. | events-crud: "Edit an event's title and time", "Move an event to another day by editing its date", "Turn a timed event into an all-day event", "Open an event from the desktop month view" |
| AC-19 | Delete with confirmation. | events-crud: "Delete an event", "Cancelling the delete confirmation keeps the event" |
| AC-20 | Cancel / Escape never changes data. | events-crud: "Cancelling the new event dialog creates nothing", "Escape closes the new event dialog without saving", "Cancelling an edit leaves the event unchanged" |

## Task lists

| AC | Criterion | Verified by |
|---|---|---|
| AC-21 | Task lists appear in month, week and day view on their date (untimed in the all-day area, timed at their time). | tasklists-display: "A task list appears in every view", "A task list without a time is shown in the all-day area", "A task list with a time is placed in the time grid", "A task list on another day is not shown in the day view" |
| AC-22 | Collapsed display: title, item titles (compact), done count `x/y`; empty lists show `0/0` and "No items". | tasklists-display: "A collapsed task list shows title, item titles and done count", "A collapsed task list in the desktop month view shows items and done count", "An empty task list shows a zero count and a placeholder" |
| AC-23 | Tap expands; collapse via close or Escape. | tasklists-display: "Tapping a collapsed task list expands it", "Expanding a task list from the desktop month view", "Escape collapses an expanded task list" |
| AC-24 | Create a task list with date, optional time and initial items; validation; cancel. | tasklists-crud: "Create a task list on a date", "Create a task list with a time", "Create an empty task list", "The new task list form defaults to the focused day without a time", "A created task list is still there after a reload", "A task list needs a non-blank title", "Cancelling the new task list dialog creates nothing" |
| AC-25 | Rename, move/re-time, delete task lists (with confirmation); cancel keeps data. | tasklists-crud: "Rename a task list", "Move a task list to another date and give it a time", "Remove the time from a task list", "Cancelling the task list details dialog keeps the task list unchanged", "Delete a task list", "Cancelling the delete confirmation keeps the task list" |
| AC-26 | Tick/untick, add, rename, remove items; blank input ignored; changes persist after reload. | tasklists-items: "Tick an item", "Untick an item", "Ticks persist after a reload", "The collapsed view reflects changes made while expanded", "Add an item", "Blank items are not added", "Rename an item", "Escape cancels renaming an item", "Renaming an item to a blank title keeps the old title", "Remove an item", "Removing the last item leaves an empty list"; mobile: "Expand a task list and tick an item on a phone" |
| AC-27 | (Optional) Reorder items. | tasklists-items: "Reorder items" (`@optional`; may be skipped with a recorded reason) |
| AC-28 | Google mapping per BRIEF: `extendedProperties.private.kind = "tasklist"`, items JSON chunked above 1024 chars, `☐`/`☑` description mirror, all-day vs. 30-min timed event; description-only lists are readable. | tasklists-crud: "Create a task list on a date", "Create a task list with a time", "Move a task list to another date and give it a time", "Remove the time from a task list", "A task list with many items is stored in chunks and survives a reload"; tasklists-items: "Tick an item", "Rename an item"; tasklists-display: "A task list created in Google with only a description is still readable"; server unit tests for `TaskListCodec` |

## Sync

| AC | Criterion | Verified by |
|---|---|---|
| AC-29 | Data comes from the provider; changes made in Google (add, rename, move, delete events; tick/rename/add task lists) appear after reload, automatic polling or focus. | sync: "An event added in Google appears after a reload", "An event added in Google appears through automatic sync", "Changes in Google appear when the app regains focus", "An event moved in Google moves in the app", "An event deleted in Google disappears", "A task list changed in Google is updated in the app", "A task list added in Google appears in the app" |
| AC-30 | Polling does not disturb UI state or in-flight changes. | sync: "Automatic sync does not collapse an expanded task list or lose a tick" |
| AC-31 | Google/network outage shows a non-blocking error banner with Retry; last data stays usable; banner clears on recovery. | sync: "Google outage shows a non-blocking error banner while browsing", "Retry clears the banner once Google is back", "The banner disappears by itself after the next successful sync", "Opening the app while Google is unavailable shows the banner instead of failing", "Losing the network connection shows the banner, regaining it recovers"; health: "Health reports an unavailable provider without failing" |
| AC-32 | Failed writes: dialogs stay open with an error; optimistic item changes roll back; conflicting edits are rejected with a clear message. | sync: "Saving an event while Google is unavailable keeps the dialog open with an error", "Ticking an item while Google is unavailable is rolled back", "Editing an event that was changed in Google in the meantime" |
| AC-33 | Polling interval 30 s by default, plus on focus/visibility/online; paused while hidden. | ARCHITECTURE §4; web unit tests for the sync store (fake timers) |

## Mobile (primary target)

| AC | Criterion | Verified by |
|---|---|---|
| AC-34 | At 375 px width no view has horizontal page scroll, even with long titles. | mobile: "No horizontal page scroll in any view" |
| AC-35 | Bottom view switcher and floating "+" are within thumb reach; touch targets ≥ 44×44 px. | mobile: "The view switcher sits in a bottom bar within thumb reach", "Touch targets are at least 44 by 44 pixels" |
| AC-36 | Swipe left/right changes period in all views; vertical swipes do not. | mobile: "Swiping left shows the next period, swiping right the previous one", "A vertical swipe scrolls and does not change the period" |
| AC-37 | Phone month view shows compact chips; tapping a day opens its agenda (day view). | mobile: "The phone month view shows compact chips and tapping a day opens its agenda" |
| AC-38 | Dialogs and the expanded task list are bottom sheets on phones and fit the viewport. | mobile: "Dialogs are bottom sheets on phones", "Expand a task list and tick an item on a phone" |
| AC-39 | Safe-area insets respected (`viewport-fit=cover`, bottom bar padding). | mobile: "The layout respects safe-area insets" |
| AC-40 | Desktop (1280×800) remains fully usable: all non-`@mobile` scenarios pass in the `desktop` project. | `npx playwright test --project=desktop` |

## PWA / installability

| AC | Criterion | Verified by |
|---|---|---|
| AC-41 | Valid manifest (name, short_name, start_url, scope, standalone, theme/background color, 192/512/maskable PNG icons). | pwa: "The page links a valid web app manifest" |
| AC-42 | iOS meta tags and 180 px apple-touch-icon present. | pwa: "iOS home screen meta tags are present" |
| AC-43 | In a secure context a service worker is registered, the app shell loads offline, API responses are never served from cache. | pwa: "A service worker is registered in a secure context", "The app shell loads offline after the first visit", "API requests are never served from the service worker cache" |
| AC-44 | Android: in-app "Install app" button after `beforeinstallprompt`; iOS Safari: dismissible "Share → Add to Home Screen" hint; neither when already installed. | pwa: "Android shows an in-app install button when the browser offers installation", "iOS Safari shows an \"Add to Home Screen\" hint", "No install hint when already running as an installed app", "No iOS hint on other browsers" |
| AC-45 | **When served over HTTPS** (owner action, ARCHITECTURE §9.1): the app installs as a standalone app on Android Chrome (install prompt) and iOS Safari (Add to Home Screen) and opens its shell offline. Over plain `http://cal.mordor.local` the app works without service worker and is not required to be installable. | Manual check by the owner on both phones after HTTPS is live (ARCHITECTURE §9.2) |

## Non-functional

| AC | Criterion | Verified by |
|---|---|---|
| AC-46 | Load time: month view with data rendered ≤ 2000 ms after navigation start (localhost/LAN, cold cache); initial JS ≤ 150 kB compressed (tightened by owner). | performance: "The first load stays within the JavaScript budget" |
| AC-47 | All tests green: `server` Vitest, `web` Vitest, `vue-tsc`/`tsc --noEmit`, e2e (both projects, all 247 expanded scenarios except documented `@optional` skips), `spec/scripts/check-steps.py`. | CI script `npm test` at the repo root |
| AC-48 | Test-only endpoints exist only with `TEST_MODE=true`; production returns 404 for `/api/__test/*`. | server integration test; `curl -s -o /dev/null -w '%{http_code}' http://cal.mordor.local/api/__test/reset -X POST` → `404` |
| AC-49 | Deployment reachable at `http://cal.mordor.local` via Traefik: `/` serves the app, `/api/health` returns 200 `{"status":"ok"}`; container restarts automatically and persists data in `./data`. | health: "The health endpoint reports ok", "The app loads and shows the month view", "The config endpoint exposes the week start and time zone" (all `@smoke`, run with `E2E_BASE_URL=http://cal.mordor.local`); `docker compose ps` healthy |
| AC-50 | No hardcoded host: base URL and allowed origins come from `PUBLIC_URL` / `ALLOWED_ORIGINS`; switching to the HTTPS name needs only env + Traefik label changes. | `grep -r "mordor.local" server/src web/src` returns nothing; config unit test |
| AC-51 | Provider switch: `PROVIDER=mock` (default) and `PROVIDER=google` select the implementation; `GoogleProvider` passes its unit tests against mocked HTTP. | server unit tests |
| AC-52 | Mock provider persists to `DATA_DIR` and survives restarts; seeds demo data when empty unless `SEED=false`. | server integration test |
| AC-53 | Every UI element used by tests has the `data-testid` from ARCHITECTURE §5. | e2e suite passes; no CSS/text selectors except where a step says so |
| AC-54 | Accessibility basics: buttons have accessible names, dialogs trap focus and close on Escape, checkboxes are real checkboxes, color is not the only state signal (ticked items are struck through). | component tests + "Escape ..." scenarios |

## Material 3 design

| AC | Criterion | Verified by |
|---|---|---|
| AC-55 | M3 color roles exist as tokens (`--md-sys-color-*`) generated from one seed color, in a light and a dark scheme. | theme: "Material color role tokens are defined in both themes" |
| AC-56 | Light/dark follows the system setting, also live; browser theme color matches the surface. | theme: "The theme follows the system color scheme", "Switching the system color scheme while the app is open updates the theme" |
| AC-57 | Text contrast ≥ 4.5:1 in both themes (titles and event chips). | theme: "Text stays readable in both themes" |
| AC-58 | M3 components: top app bar, navigation bar on phones (rail allowed on desktop), FAB, bottom sheets, chips, state layers, M3 type scale; looks native enough on iOS (system font, safe areas). | theme: "Pressing a button shows a state layer"; mobile: "The view switcher sits in a bottom bar within thumb reach", "Dialogs are bottom sheets on phones"; owner visual review on an Android and an iOS phone |

## Resource efficiency and memory (hard requirements)

| AC | Criterion | Verified by |
|---|---|---|
| AC-59 | No frontend leaks: after 50× view cycles, 50× dialog open/close and 50× task list expand/collapse, JS heap, DOM node and event listener counts grow < 10 % (after forced GC) and closed dialogs leave no detached DOM. | performance: "Switching views and opening dialogs repeatedly does not leak memory" |
| AC-60 | Timers and listeners are released: one polling timer app-wide regardless of navigation; polling pauses while hidden and resumes on return; components clean up on unmount. | performance: "Navigating many periods does not accumulate polling timers", "Polling stops while the app is hidden", "Returning to the calendar after a hidden period syncs once and resumes polling"; web unit tests mounting/unmounting views with fake timers and listener spies |
| AC-61 | Server memory: idle RSS ≤ 80 MB; RSS growth < 20 MB after 5 000 reads + 500 task item writes (after GC). | performance: "The server stays small when idle", "The server does not leak memory under load" |
| AC-62 | Lighthouse mobile performance score ≥ 90 for the production build on localhost. | performance: "The app scores well in a phone performance audit" |

## Settings, categories and colors

| AC | Criterion | Verified by |
|---|---|---|
| AC-63 | Settings screen reachable from the top app bar and at `/settings`; defaults on first run. | settings: "The settings screen is reachable from the top app bar", "Default settings on first run" |
| AC-64 | Theme mode System/Light/Dark overrides the system scheme and persists. | settings: "The theme mode overrides the system color scheme" |
| AC-65 | Seed color (8 presets or valid custom hex) recolors the whole UI via generated M3 tonal palettes, in light and dark mode; invalid hex is rejected. | settings: "Choosing a seed color preset recolors the whole UI", "A custom seed color recolors the UI in light and dark mode", "An invalid custom seed color is rejected" |
| AC-66 | Settings are stored on the server and apply on other devices and after focus. | settings: "Settings are stored on the server and apply on another device", "Settings changes made on another device appear after the app regains focus" |
| AC-67 | Default view and default event color settings work. | settings: "The default view decides where the app opens", "The default event color is used for new events" |
| AC-68 | Categories: four defaults on first run; add (with/without emoji), rename, recolor, delete with confirmation; validation of name and color. | categories: "Add a category", "Add a category without an icon", "Invalid categories are rejected", "Rename a category", "Recoloring a category recolors its task lists", "Deleting a category leaves its task lists without a category", "Cancelling the category deletion keeps the category"; settings: "Default settings on first run" |
| AC-69 | A task list has at most one category (color + icon) and optional tags, settable on create and edit; uncategorized lists use the calendar color. | categories: "Create a task list with a category and tags", "A task list without a category uses the calendar color", "Change the category of a task list", "Remove the category and tags from a task list" |
| AC-70 | Google mapping: `categoryId` and `tags` in private extended properties; `colorId` = nearest Google color of the category color. | categories: "Create a task list with a category and tags", "Change the category of a task list", "Category colors map to the nearest Google event color"; server unit tests for nearest color |
| AC-71 | Filter chips filter task lists by category (OR), "No category", tag, and category AND tag; events stay visible; filters are in the URL, survive navigation, can be cleared; the chip row never causes page scroll on phones. | categories: "Filter the calendar by one category", "Several selected categories are combined with \"or\"", "Filter by task lists without a category", "Filter by tag, and combine a tag with a category", "Clearing the filters shows all task lists again", "Filters are deep-linkable and survive navigation", "The tag filter offers only tags that are in use", "The filter chip row scrolls on its own on a phone" |
| AC-72 | Events can use one of the 11 Google colors or the calendar color; colors round-trip with Google. | event-colors: "Create an event with a color", "New events default to the calendar color", "Change the color of an existing event and reset it", "A color set in Google is shown in the app", "The event color picker shows all Google colors" |
