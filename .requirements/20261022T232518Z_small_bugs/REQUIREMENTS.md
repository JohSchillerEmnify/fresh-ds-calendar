# Small bugs from the backlog (night run 2026-10-23)

Three bugs from `docs/BACKLOG.md`, each its own commit on `fix/small-bugs`. The owner is asleep; assumptions are
recorded here and in the final report.

## 1. Deep-link return after sign-in is sometimes lost

### As Is
Opening `/week/2026-10-12` while signed out: `main.ts` registers the 401 listener (`useAuthStore().listen()`), then
fires `auth.check()` plus config/settings/theme loads and waits for all of them before it creates the router. The
`/api/auth/me` 401 makes the listener call `location.assign('/signin')` (a full page load) at once. The router guard
that stashes the deep link in `sessionStorage[RETURN_KEY]` only runs after the other loads settle; if the `/signin`
document commits first, the page unloads without the key and the post-sign-in `/` redirect falls back to the default
view (~1 in 8 runs of "An allowed person signs in with Google and sees their calendar").

Root cause evidence:
- Trace of a failing run: `GET /api/auth/me 401` at t=67805.8 ms, `GET /signin` (document) at t=67817.7 ms, i.e. the
  listener's full-page jump, before the router existed. Callback lands on `/` as expected (falsifies "lands elsewhere").
- Probe (temporary, reverted): delaying `/api/settings` by 800 ms made the failure deterministic (4/4), and
  `sessionStorage['signin-return']` was `null` already on the sign-in page, so the key is never written (falsifies
  "written, then consumed/cleared before the callback"). With the fix the same probe shows `/week/2026-10-12` and 4/4 pass.

### To Be
Whoever sends the person to `/signin` stashes the page being left first. The 401 listener writes
`pathname + search + hash` to `RETURN_KEY` before `location.assign('/signin')` (except for `/`, like the router guard).

### Requirements
1. R1: a 401 (`UNAUTHENTICATED`) answer on a page other than `/` and `/signin` stores that page in `RETURN_KEY` before
   leaving for `/signin`.
2. R2: on `/` nothing is stored (the default view is the default anyway).

### Acceptance Criteria
- R1: unit test "remembers the page it leaves for the sign-in page, before leaving" (value read at `assign` time).
- R1: `e2e-locked --grep "and sees their calendar" --repeat-each 8` 8/8 and `--repeat-each 16` 16/16 green.
- R2: unit test "remembers nothing for the start page".

### Testing Plan
Unit tests in `web/test/stores.test.ts` (red first), then the repeated e2e scenario.

### Implementation Plan
1. Failing unit tests → 2. stash in `listen()` → 3. unit green, e2e repeat runs green. One commit.

### Assumption
A 401 in the middle of a session (session expired while using the app) now also returns to the page that was open,
after signing in again. This follows the backlog's intent ("opening a specific page while signed out should return
there after sign-in"); before, that case always landed on the default view.

## 2. Desktop month-picker swipe fails

### As Is
"Arrows and swipes change the month inside the picker" on `--project=desktop` fails intermittently (4/12 with
`--repeat-each 12`; it passed once on a single run). `MonthPicker.vue` has a mouse-drag counterpart of the touch swipe
with the same thresholds: |dx| >= 60, |dx| > 1.5 |dy|, and at most 600 ms from `pointerdown` to `pointerup`. The step
`swipePicker` drags with `mouse.move(..., { steps: 10 })`, one CDP round trip per step.

Root cause evidence (traces of the 4 failing runs, `mouseDown` -> `mouseUp`): 602, 627, 609, 808 ms, all over the
600 ms limit; the passing runs show a fast desktop drag does change the month. Hypotheses falsified: the drag starts
outside the grid (the same coordinates pass in 8/12 runs), the release clicks a day and closes the picker (the failing
screenshot/assert shows the picker open with the unchanged month), the direction is inverted (passing runs reach the
expected months).

### To Be
The app is right (a swipe = a quick flick, as on touch); the test step drags quickly: `steps: 2`.

### Requirements / Acceptance Criteria
1. R1: the step performs a real mouse flick well under 600 ms. AC: the scenario passes 16/16 with
   `--project=desktop --repeat-each 16`.

### Assumption
The 600 ms limit also for the mouse drag is intended ("same thresholds" in the code comment, the spec says "swipe");
slow mouse drags are not meant to change the month. Not changed.

## 3. Zooming is broken on the month overview: STOPPED, owner decision needed

Findings (no code changed):
- The spec has no zoom for the month view. Zoom exists only for the time grid (`mobile.feature` "Pinching the week
  zooms the time grid ...", `tasklists-expand.feature` @expand-zoom), the Canvas (Ctrl+wheel) and the Labs zoom month.
- The month view has never had an app zoom: no pinch/wheel handler in `MonthView.vue` in any commit
  (`git log -S pinch / -S wheel`); `bindGridZoom` (`useHourHeight.ts`) is bound only by `TimeGrid.vue`.
- What the person gets today on the month view: on touch, `SwipeCarousel.vue` `.main { touch-action: pan-y }` blocks
  the browser's own pinch-zoom (pan-y without `pinch-zoom`), so a pinch does nothing; on desktop, Ctrl+wheel is the
  browser's whole-page zoom (nothing in the app handles it there); inside the Android app there is no page zoom at all.
- So "broken" can mean: (a) an app zoom on the month like the zoom month Lab (a new feature that needs a spec), (b) let
  the browser's page pinch-zoom work (`touch-action: pan-y pinch-zoom`; zooms the whole page incl. bars, not the
  month), or (c) make the zoom month Lab the month view. Which one is the owner's call.

## 4. Left-handed mode on a tablet: the open tasks tray moves to the left (owner decision via coordinator)

### As Is
`left-handed.feature` prose: on a tablet "the side tray moves next to the navigation rail at the left". No scenario
checked it, and `TaskTray.vue` only mirrored the phone bar; on a tablet (820x1180, touch) the panel stayed at the right.

### To Be
With `html[data-hand='left'][data-touch]` and width >= 768 px the tray panel is first in the row (right of the rail,
left of the calendar), its border is on its right edge and the fold chevron mirrors (open points left, collapsed
points right). Desktop (no `data-touch`) does not change.

### Requirements / Acceptance Criteria
1. R1: tablet + left-handed: the tray is on the left. AC: new @tablet scenario "On an iPad in left-handed mode the open
   tasks tray sits next to the navigation rail at the left" (red before, green after).
2. R2: desktop unchanged. AC: "The desktop layout does not change" also asserts the tray is on the right.
3. AC: all "Left-handed mode" scenarios green on mobile, tablet and desktop; tablet screenshots looked at.

### Note (not changed)
On a tablet in left-handed mode the add button (already at the left, next to the rail, per the existing @tablet
scenario) now sits over the bottom of the open tray panel instead of over the calendar. Moving it beside the tray would
need the tray width in `CreateFab`; left for the owner to judge.

## 5. Labs views follow the "Task categories" switch (owner decision via coordinator)

### As Is
With task categories off, a list shows its calendar's colour everywhere (`categories.ts` `listColor`/`itemColor`), but
the Labs views were not specified. Audit: clock, timeline, strip and horizontal draw items through `ItemView` /
`cats.itemColor` (already right; the clock's wedge and now line only use events, which have no category). The zoom
month's density dots used `s.item.color` directly, i.e. the category colour.

### To Be
The zoom month dots use `useTaskCategories().itemColor`, like every other item.

### Requirements / Acceptance Criteria
1. R1: with categories off, no Labs view draws a list in its category colour. AC: new Scenario Outline "The Labs views
   draw no category colour while task categories are off" (clock, timeline, strip, zoom month, horizontal): the list
   is drawn in its calendar colour (non-vacuous) and the category colour is drawn nowhere in the view. Red before the fix
   for the zoom month only, 5/5 green after; the existing switch scenarios stay green.
