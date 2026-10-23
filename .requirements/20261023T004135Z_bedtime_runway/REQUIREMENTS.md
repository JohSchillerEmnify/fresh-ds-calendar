# Labs: bedtime runway (night run 2026-10-23)

Idea #4 "Bedtime runway" of `docs/proposals/2026-10-23-calendar-view-ideas.md` (recommended experiment #3), built as a
new Labs view, default off. The owner is asleep; every assumption is listed below (A1–A14) and in the final report.

## As Is

- Bedtime mode (feature `bedtime`, pref `prefs.bedtime`, off by default) turns the bedtime preference into night
  windows (`features/bedtime/bedtime.ts`: `bedtimeWindows`, `tonight`); the time views draw a night band, the
  Approaching track a band, a snackbar reminds before bedtime.
- The Labs registry (`features/labs/labs.ts`, `LABS_VIEWS`) lists the experimental views; each entry gives one switch in
  the settings and one tab in the view switcher (with Labs on). Routes live in `router/index.ts`; `useNav.switchView`
  names each Labs id by hand.
- Nothing shows "how much evening is left" as one picture: the time grid scrolls, the Approaching track shows a fixed
  window (1–6 h) and not the end of the day.
- The app clock (`stores/clock.ts`) ticks once per minute, aligned, paused while the page is hidden.

## To Be

A Labs view **Runway** (`/runway`, default off). It shows one fixed-height vertical bar from **now** (top) to
**tonight's bedtime** (bottom), filling the screen whatever the length of the evening, so it *shrinks* (the scale grows)
as the evening goes on. Tonight's timed entries are drawn to scale inside it and open on a tap like elsewhere. Above
it, one line: "8 h 30 min until bed · 6 h 30 min free". With bedtime mode off, or during the night, a calm one-line
explanation replaces the bar.

## Assumptions (owner asleep)

- A1 **Id, route, label**: id `runway`, route `/runway` (no date: the view is always about now, like the Timeline),
  label "Runway" (de "Bis ins Bett"). The id must equal the lower-cased English label for the shared switcher steps.
- A2 **What is drawn**: events and task lists with a time (also an open list carried over to today that has a time,
  as on the Approaching track), of today and of tomorrow when bedtime is after midnight, that overlap [now, bedtime).
  All-day events and task lists without a time are not drawn. Hidden calendars are left out (like every view).
- A3 **Clipping**: an entry that is already running starts at now on the bar (shows only the time it has left); one
  that runs past bedtime ends at bedtime. A multi-day event is one block.
- A4 **Minimum event length**: an entry shorter than the setting is laid out as that long (feature min-event-length),
  before clipping. Real times are untouched (the dialog shows them).
- A5 **Free time** = the runway minus the union of the entries *as laid out* (minimum length included), so the number
  matches the picture. Alternative (real durations) rejected: the free stretch next to a 5-min pill drawn as 30 min
  would not add up.
- A6 **Overlaps** sit side by side (lanes, like the horizontal Labs view: `packColumns` without cascade); a bar this
  narrow has no room for a cascade indent.
- A7 **Bedtime passed** = now lies inside a night window (between bedtime and wake-up): "Bedtime was at 23:00". After
  wake-up the runway runs to the next bedtime. Exactly at bedtime counts as passed.
- A8 **Off**: "Bedtime is off — set it in the settings" with a button that opens the settings. A bedtime equal to the
  wake-up time (no night) is treated as off.
- A9 **One timer**: the view reads the clock store's minute tick (`nowTick`); no timer of its own. The tick already
  pauses while hidden and catches up on return.
- A10 **Loading**: the view makes today and tomorrow the visible range of the items store (`setVisible(today,
  today+2)`); in dynamic bedtime mode the bedtime feature already prefetches the next day.
- A11 **No day swipe** on this view (`meta.noSwipe`): it has no date to move through.
- A12 **Labels on the bar**: "Now 14:00" at the top and "Bed 22:30" at the bottom (from the mock-up). Not built (left
  for later, the owner did not ask for them in the task): the "2 h free" labels per gap, the wind-down marker (R27),
  hour ticks, the widget.
- A13 **Desktop**: the same single bar, centred, at most 560 px wide.
- A14 **Merge with the Now/Next track**: the registry entry, the route and the `views.runway` locale keys are separate
  lines; all other strings live in a `runway` block of the bedtime locale modules. `switchView` becomes registry-driven
  (any `LABS_VIEWS` id) instead of a hand-written list, so a later Labs view needs no edit there — a small conflict with
  the other track's line is expected.

## Requirements

1. R1 The registry has an entry `runway` (default off); with Labs on and the switch on, the view switcher offers it.
2. R2 With bedtime mode on and now before tonight's bedtime, the view shows a bar from now to bedtime that fills the
   available height, whatever the time left.
3. R3 Entries (A2–A4, A6) are drawn inside the bar at their time, as tall as they last on the bar's scale.
4. R4 A header line says the time until bed and the free time (A5), as `formatDuration` texts.
5. R5 The bar, header and entries follow the app clock's minute tick (A9).
6. R6 A tap on an entry opens it like elsewhere (`ItemView`).
7. R7 With bedtime mode off: "Bedtime is off — set it in the settings" and a settings button (A8).
8. R8 During the night: "Bedtime was at HH:MM" (A7).
9. R9 All texts in en, de, de-x-mainfr, de-x-coldmirror.

## Acceptance Criteria

- R1: unit test — `visibleLabsViews(true, {})` excludes `runway`, `{ runway: true }` includes it; e2e "The runway is a
  Labs view, off by default".
- R2/R4: e2e at 14:00 with bedtime 22:30, "Call Mia" 15:00–16:00 and the task list "Dinner" 19:00 for 60 min: header
  "8 h 30 min until bed · 6 h 30 min free"; unit tests of the model for total and free.
- R3: e2e "Call Mia" (60 min) is about 2× as tall as "Pills" (20:00–20:05 with a 30-min minimum), header free
  "7 h free"; unit tests for clipping, carried-over lists, all-day exclusion, the minimum, lanes, after-midnight bedtime.
- R5: e2e with a running clock: after 60 minutes the header reads "7 h 30 min until bed · 6 h 30 min free" and
  "Call Mia" is taller than before.
- R6: e2e tapping "Call Mia" opens the event dialog.
- R7: e2e message with bedtime off; unit test `off` state.
- R8: e2e at 23:30 with bedtime 23:00: "Bedtime was at 23:00"; unit test exactly at bedtime.
- R9: `pnpm --silent verify` (the de catalogue is type-checked against en; the dialect catalogues by the i18n tests).

## Testing Plan

- Unit (vitest, `web/test/labs-runway.test.ts`): the pure model `runwayModel` — off, passed, total/free, clipping of
  running and past-bedtime entries, minimum length before clipping, overlapping lanes, carried-over timed list, all-day
  and untimed excluded, bedtime after midnight takes tomorrow's entries, multi-day event merged. Registry test extended.
- e2e (`spec/features/labs/labs-bedtime-runway.feature`, 6 scenarios), mobile and desktop, targeted by name.
- Regression: the Labs switch scenarios of `labs-clock.feature`, the `@visual` scenarios; phone screenshots of the
  runway in light and dark looked at.

## Implementation Plan

1. Spec: feature file + STEPS.md entries; `check-steps.py` 0 problems. → verify: script.
2. LikeC4: `labsRunway` component + relations. → verify: `likec4 validate`.
3. Unit tests for the model (red), `features/labs/runway/runway.ts` (green). → verify: vitest.
4. Registry entry + route + switchView + i18n (registry unit test). → verify: vitest, typecheck.
5. `RunwayView.vue`. → verify: build, e2e steps file, targeted e2e mobile + desktop.
6. Visual check (light/dark PNGs), `@visual`, Labs switch scenarios, `pnpm --silent verify`.

PR boundary: the whole slice (steps 1–6) is one reviewable, independently mergeable PR on `feat/bedtime-runway`.

## Implementation notes

- Review (code-reviewer subagent) fixes applied: the "is above" step waits for the bar to be measured; the view reloads
  today+tomorrow when the day changes while open; the minimum length applies once per merged multi-day item, and the
  merged segment ends like its last piece.
- Known, left as is: an entry that ended shortly before now but is laid out longer by the minimum still shows its rest
  at the top of the bar (consistent with "laid out as that long everywhere"). The app's floating + button covers the
  bottom-right corner of the bar, as it does in every view.
- e2e-locked runs both projects for a `--grep` on the feature tag: 12/12 (6 mobile + 6 desktop).
