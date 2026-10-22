# Spec and e2e cleanup: proposals for the owner (2026-10-23)

Backlog items "Review and prune the e2e suite" and "Clean up the spec". Tonight only coverage-preserving changes were
applied (branch `chore/spec-e2e-cleanup`, listed at the end). Everything below changes coverage, wording or behaviour
and waits for your tick. One line of reason each; "runs" = scenario runs, one per project (most scenarios run twice:
mobile and desktop).

Not reviewed tonight (other tracks change them): `reminders.feature`, `android-app.feature`, `bedtime.feature`,
`dnd.feature`. @backlog scenarios are left as they are.

## Contradictions with later owner decisions

- [ ] `tasklists-expand.feature` "A long title wraps and stays fully readable in the grown card": a 30-minute list now
  grows to a one-line pill with an ellipsis (owner 2026-10-19 "Pille = Blockhöhe, Titel mit Ellipsis"; drawn by
  `visual.feature` "The normal week's tight pill keeps its title on one line"). Reword to the pill rule or drop.
- [ ] `tasklists-expand.feature` feature text "the title wrapping instead of being cut": same decision, reword.
- [ ] `settings.feature` feature text says the Settings screen chooses theme mode and seed colour, but "Every setting
  appears once, in its section" says the settings page has none (they moved to the theme menu). Reword the prose; the
  scenarios "Default settings on first run", "The theme mode overrides…" and "Choosing a seed color preset…" open
  `/settings` and then act in the theme menu, which reads wrong.
- [ ] `adhd-support.feature` "Calm mode reduces clutter" sets up its list "with the tags "weekend"", but tags are shelved
  (owner 2026-10-13, `categories.feature`). Use the plain category fixture.
- [ ] `pwa.feature` "A new build offers a reload" will contradict the @backlog rule "An installed app updates itself"
  once that is built; decide then which one the browser (not installed) case follows.
- [ ] `timeline.feature` "The phone month view opens the proportional day timeline, not an equal-height list" has no
  `@mobile`, so it also runs on desktop where it is not a phone; and it repeats `mobile.feature` "The phone month view
  shows compact chips and tapping a day opens its agenda". Drop it (or tag it `@mobile`).

## Duplicates and overlaps (drop or merge, coverage kept elsewhere)

### task-lists
- [ ] `tasks-archive` "A finished list moves to the Archive" + "A finished undated list shows on the finished day by
  default": same setup and action, merge into one scenario with both checks (−1 scenario, −2 runs).
- [ ] `tasklists-display` "Escape collapses an expanded task list": `tasklists-expand` "Escape collapses it and gives
  the focus back to the card" checks the same and more (−2 runs).
- [ ] `tasklists-display` "Expanding a task list from the desktop month view": `tasklists-expand` "The grown card is
  read-only in the month view" taps and checks the same (−1 run).
- [ ] `tasklists-display` "A short timed task list in a wide column shows its items next to the title": "…shows only
  its open items next to the title" checks the same with one more item (−1 run).
- [ ] `tasklists-display` Outline "Tapping a collapsed task list expands it" (week, day): with the grown card on, the
  `tasklists-expand` read-only and collapse scenarios cover it; drop or keep one example (−2 to −4 runs).
- [ ] `tasklists-expand` "The grown card is read-only in the day view too" + "…in the week view": one Outline (the day
  example gains the items check) (−0 runs, −1 scenario) or drop the day one (−2 runs).
- [ ] `tasklists-expand` "After the grown card closes with Escape, one tap grows it again" + "…with a tap elsewhere…":
  the re-open logic is the same; keep one (−1 run, @mobile).

### events
- [ ] `events-display` "Overlapping multi-day events are stacked in separate lanes": "A day's entries fill the free slot
  above a bar" has the same two bars and the same lane checks plus one more (−2 runs; rename the kept one to mention
  lanes).
- [ ] `events-crud` "A created event is still there after a reload": add the reload to "Create a timed event with the
  add button" (−2 runs).
- [ ] `events-display` "A crowded day in the month view fades out what does not fit" also clicks empty space and checks
  the day opens, which `navigation` "Clicking empty space in a month day cell opens that day" covers; drop the click
  part (shorter, not fewer runs).

### views
- [ ] `mobile` "The view switcher sits in a bottom bar within thumb reach" + `nav-position` "The phone keeps the bottom
  bar by default": the same check; keep one (add the create-button check to it) (−1 run).
- [ ] `mobile` "Navigation buttons work as an alternative to swiping": `navigation` Outlines "Previous and next…" and
  "The today button…" run on mobile too (−1 run).
- [ ] `mobile` "Create an event on a phone": `events-crud` "Create a timed event with the add button" runs on mobile
  too (−1 run).

### google
- [ ] `sync` "Google outage shows a non-blocking error banner while browsing" + "The banner disappears by itself after
  the next successful sync": the same first five steps; one scenario (−2 runs).
- [ ] `sync` "An event added in Google appears after a reload": automatic sync, focus and `pwa` "API requests are never
  served from the service worker cache" (Google change + reload) cover it (−2 runs).

### app
- [ ] `pwa` "A service worker is registered in a secure context": "The app shell loads offline after the first visit"
  runs the same check first (−2 runs).

### labs
- [ ] `labs-clock` "Strip is off by default": put "the view switcher does not offer "Strip"" into "Choosing which Labs
  views appear" before Strip is switched on (−2 runs).
- [ ] `labs-clock` "The clock names each event": add the label check to "The clock shows the day as a 24-hour circle"
  (−2 runs).
- [ ] `labs-approach` "A longer window reaches further ahead": "A window of my own number of hours" sets a window
  through the settings and checks the same (−2 runs).

### themes
- [ ] `theme-menu` "Choosing a theme from the gallery applies it at once": "A preset with my own colour, and back to
  the preset" does the same first and checks the same (−2 runs).
- [ ] `theme-menu` "Choosing Neon keeps the seasonal header" + "Choosing a preset steps Header + colours down to Header
  only": same setup and action, one scenario (−2 runs).
- [ ] `theme-menu` "A fixed theme shows its own name in the settings": the Outline "The settings show what follows the
  calendar" row `Off | Neon` checks it (−2 runs).

### Kept apart on purpose (tick to merge anyway)
- [ ] `min-event-length` "A short event is drawn as long as the minimum" + "An entry already longer than the minimum
  keeps its real length": the same steps with other values, but two rules; an Outline would hide one of them.

## Better as unit or server tests (keep one e2e example)

The value is a pure function (colour mapping, date rules, validation, date arithmetic) or a server API without UI:
repeating it through the whole UI per example is slow.

- [ ] `theme-menu` Outline "With Header + colours the colours and the header follow the calendar": 12 dates → unit-test
  the day→theme priority, keep Halloween, Christmas and New Year's Eve (−18 runs).
- [ ] `theme-menu` Outline "The Advent timeline lights a candle…": 6 dates → unit-test, keep 1st Advent and 24 Dec
  (−8 runs).
- [ ] `settings` Outline "Choosing a seed color preset recolors the whole UI": 8 presets → unit-test the scheme
  generation, keep Blue and one other (−12 runs).
- [ ] `settings` Outline "An invalid custom seed color is rejected": 3 values → unit-test, keep one (−4 runs).
- [ ] `categories` Outline "Category colors map to the nearest Google event color": 5 colours → unit-test the mapping,
  keep one (−8 runs).
- [ ] `categories` Outline "Invalid categories are rejected": 3 → unit-test the validation, keep one (−4 runs).
- [ ] `events-crud` Outlines "Invalid events cannot be saved" (3), "An event needs a non-blank title" (2), "A too long
  title is rejected", "An all-day event cannot end before it starts": unit-test the validator, keep one e2e that the
  dialog shows the error and stays open (−12 runs).
- [ ] `navigation` Outline "Previous and next move by exactly one period": 6 → keep one per view (−6 runs).
- [ ] `navigation` Outline "Invalid deep links redirect to the current month": 4 → unit-test the route parser, keep
  one (−6 runs); Outline "Week titles across month and year boundaries" → unit-test the title format (−4 runs).
- [ ] `plant` Outline "Without activity the plant rests gently but never dies": 5 API-only examples → server test
  (−10 runs).
- [ ] `plant` Outline "The plant card shows the plant larger with a friendly line": 5 stages → unit-test the
  thresholds, keep two (−6 runs).
- [ ] `streak` "The check-in API is idempotent per day", `signin` "An exchange code works once only" and "A code caught
  by another app is useless": server API tests (−6 runs).
- [ ] `event-colors` "The event color picker shows all Google colors": a static list → unit test (−2 runs).
- [ ] `theme` Outline "Material color role tokens are defined in both themes": the contrast and fill scenarios already
  fail without the tokens; unit-test the token list (−4 runs).

## Run API-only scenarios once, not per viewport

- [ ] Scenarios that open no page (most of `door-board`, `health` config/health, the API-only examples above,
  `events-readonly` "The server refuses to change an event that is not mine", `plant` "The plant and the sunflowers are
  on by default") run in both the mobile and the desktop project. Tag them so only one project runs them (e.g. make
  `@api` mobile-only in `playwright.config.ts`) (about −15 runs).

## Slow scenarios to move out of the default run

- [ ] `performance` "The app scores well in a phone performance audit" (three Lighthouse runs) and "The server does not
  leak memory under load" (6000 requests): a separate `@slow` stage run before a release, not on every change.
- [ ] `performance` request-counting scenarios wait 10 s, 6 s and 5 s of real time; with the test clock they could
  count timer ticks instead.

## `Then` steps that state a verdict instead of what is seen

Reword so the step says what the person sees (the check behind it stays):

- [ ] "the app uses the dark/light theme" (theme, settings, theme-menu, theme-scenes): say what is seen, e.g. "the
  calendar is drawn in the dark colours" (checks `data-theme`).
- [ ] "the clock fills the available space" (labs-clock): "the dial is almost as wide as the view" (≥ 90 %).
- [ ] "the list of the expanded task list stands out from the grid behind it" (visual): say how (its own background
  and border over the grid).
- [ ] "the task list X shows its title without overlap" (tasklists-display): "the title of the task list X is not
  covered", the wording `events-display` already uses.
- [ ] "the app runs the new version" (pwa): "the corner/settings show the new version" after the reload.
- [ ] "the zoom month is zoomed in" (zoom-month), "the horizontal view has panned" (horizontal-time): say what moved
  (bigger day cells; another hour in view).
- [ ] `events-crud` "Enter in the last single-line field moves on to the description…" checks
  "the event field "description" has focus" inside the When block; move it to Then.

## Estimate

About 70 scenarios are named above. Ticking everything removes roughly 160–170 scenario runs of the 1 511 in a full
run (`playwright test --list`: 784 mobile + 727 desktop). Measured tonight, a light UI scenario takes
about 3–6 s, so the suite gets about 10–15 minutes shorter, plus 1–2 minutes from moving the Lighthouse and load
scenarios to a slow stage. The unit tests that replace e2e examples run in milliseconds.

## Applied tonight (coverage kept)

- `e2e/STEPS.md`: the theme-import notes existed twice (one copy stranded under "Tasks view" by a union merge); one
  copy, the newer wording, now in "Theme import". check-steps: 0 unused, 0 problems.
- `e2e/scripts/check-steps-impl.py` reads `\'`, double-quoted and regular-expression step definitions; the dead step "I do not see the now
  card" (dropped from the spec in 0712a5d) is removed. 90 missing / 6 extra → 65 missing / 0 extra; the 65 are used only by @backlog scenarios (bddgen, which skips @backlog and fails on a missing step, passes).
- `tasks-view` "An undated list finished today shows in the calendar today" removed: `tasks-archive` "A finished
  undated list shows on the finished day by default" has the same setup and action and checks the same and more.
- Outlines: `navigation` "Switching views keeps today when it is visible, otherwise the focused date" (was two),
  `timeline` "The Now card is shown in the month and year views of today and in another week" (was two: month/year and another week),
  `labs-clock` "Today the middle says what is running or comes next and shades the time until then" (was two).
- Renamed to say what the steps check: `tasklists-expand` "With the setting "inline" a tap grows the card in place"
  (was "By default…", but it sets the setting), "Tapping a titleless list expands it over the calendar in the day view too" (was
  "opens it"), "The first item of the grown card is below its header" (the top edge was not checked), "A long press
  shows the resize handles and does not grow the card" (was "still does what it did"); `labs-clock` "Turning Labs on
  offers the experimental views" (was "appear only with Labs on", the off case is not checked); `theme-scenes` "Each
  season and holiday scene has its own life and a cat" (the holiday examples have no butterflies).
