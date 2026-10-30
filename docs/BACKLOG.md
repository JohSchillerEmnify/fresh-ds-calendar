# Backlog and known bugs

Tracked here so it survives across sessions. Newest first within each section. Move an item out when it ships.

## Bugs

- **Flaky in a batch: "Someone else signing in on this device does not get my templates"** (2026-10-30, merged
  device store): red once in a `@last-known-state|@sync|@crud` run, green 2/2 alone. Likely state left by the scenario
  before it; find the leak (falsify) and fix the test or the wipe.

- **Scene visitor leaves the top bar at the top edge** (2026-10-30, red on main 0b65029 and on the clock fix):
  theme-scenes "The visitor flies across the top bar scene" fails on mobile: at 20 % of the flight the visitor's top edge
  is 1.8 px above the bar (`Expected >= 0, Received -1.76`). Root-cause first (header/scene layout changes since 10-26?).

- **Labs Timeline: no way back to today after scrolling** (owner, 2026-10-26). After scrolling a while there is no
  Today button to jump back. The date-less Labs views (Now, Timeline) hide the top bar's date/prev/next/Today since
  2026-10-23; the Timeline needs a Today control again (spec + canvas mockup first: where it sits, maybe only once today
  is out of view).

- **Left-handed tablet: the + button covers the open tray** (2026-10-23, owner to decide). In left-handed mode on a
  tablet the add button sits over the open task tray. Moving it right of the tray puts it past the middle of an 820 px
  tablet, which breaks the owner's scenario "On an iPad in left-handed mode the add button sits on the left" (checked:
  red). Owner to choose: keep it over the tray, move it right of the tray and change that scenario, or another place.
- **Android: the widget's own week fetch still shows category colours while categories are off** (2026-10-23; being
  fixed on `fix/notification-icons`). The widget snapshot was fixed (`listColor(l, categoriesOn)`), but the native week
  fetch (`WeekData.java`, `it.optString("color")` from `/api/items`) still draws task lists in their category colour.
  Needs the switch on the Java side and an APK build to verify.
- **Zooming on the month overview** (2026-10-16, owner; findings 2026-10-23, owner to decide). There never was a zoom
  in the month view, so nothing broke: on the phone, pinch is blocked because the swipe area sets `touch-action: pan-y`
  (`SwipeCarousel.vue`); on the desktop, Ctrl+wheel is the browser's own page zoom. Owner to choose: (a) an app zoom
  like the zoom-month Labs view, (b) allow the browser's pinch zoom, or (c) the zoom month becomes the month view.
- **Android back gesture fix: verify on the phone** (branch `android-back-notify`, needs an APK build). Back should
  close the open overlay, then go to the previous view, and leave the app only with no history left.
- **Canvas: long press on an item row does not pick up the note** (2026-10-13, owner, phone). Not reproducible in
  Chromium mobile emulation; a defensive fix (`touch-action`, `user-select`, `-webkit-touch-callout`, prevented
  `contextmenu`/`selectstart`) shipped. Owner to retest on the phone; if it still fails, capture a remote-debug log of the
  pointer/touch events on one row.

## Tech debt

- **Handwritten lists, left-handed: test with a left-handed person** (owner, 2026-10-30). Today only the tool row (and
  Save/Cancel) mirror; if writing on the rows is harder for a left-hander, mirror the rows too.

- **Accessibility audit** (owner, 2026-10-26: "we anyway need an accessibility audit at some point"). Go through the app
  with screen readers (VoiceOver on iPhone, TalkBack on Android), keyboard only, 200–400 % zoom, reduced motion and
  high contrast: labels and roles, focus order and visible focus, tap target sizes (44 px is our comfort target, WCAG 2.2
  AA asks 24), colour contrast of themes and scenes, gestures that need an alternative (swipe periods, drag and drop,
  long press, draw to create), live regions (sync status, check-in toast). Output: a findings list by severity, then
  fixes slice by slice. Known items: the touch screens' period arrows are screen-reader-only (2026-10-26) and show no
  focus ring when a keyboard user tabs to them (WCAG 2.4.7).

- **Simplification & reuse audit of the overview item components** (owner, 2026-10-16: "why do we have so many variants
  of what should be one dynamic component?"). `TaskListCard` alone carries variants card/allday/chip/block/dot plus grown,
  mini, collapsed, titles modes, and `EventItem`/`EventBar`/`BasicItem` overlap too. Audit whether these can collapse into
  one dynamic component driven by size/space (measured) rather than hard-coded variant branches, and consolidate the
  per-variant CSS. Reduce the branch count and the places a change like "titleless shows its first item" has to be made.
  Tooling is now wired: `pnpm dedup` (jscpd) reports clones; baseline 2026-10-16 is 23 clones / 0.78% of lines, flagging
  HorizontalTimeView↔ZoomMonthView, ExpandedTaskList↔TaskListView, DayView↔WeekView, SettingsView↔ThemeView,
  TaskTray↔TasksView. (jscpd catches literal copy-paste; the TaskListCard variant sprawl is structural, so also eyeball it.)
- **Review and prune the e2e suite** (owner, 2026-10-16: "169 tests for just a task list seems a lot; check if all of
  them are really necessary"). The task-list features alone match ~169 scenarios; the whole suite is large and slow
  (workers=1, one shared server). Audit for redundant/overlapping scenarios, collapse Scenario Outlines, drop
  low-value cases, and see whether some belong as unit tests instead. Goal: a leaner, faster suite. The
  coverage-preserving part is done (2026-10-23); the rest waits for the owner's tick in
  [proposals/2026-10-23-spec-e2e-cleanup.md](proposals/2026-10-23-spec-e2e-cleanup.md).
- **Clean up the spec** (owner, 2026-10-19: "wir müssen echt den spec mal aufräumen"). Scenarios and prose that
  predate later owner decisions contradict them without failing: `tasklists-expand.feature` "A long title wraps and
  stays fully readable in the grown card" (a 30-minute list) now shows a tight one-line pill with an ellipsis, as decided
  on 2026-10-19 ("Pille = Blockhöhe, Titel mit Ellipsis"); the architecture prose carried an invented "item rows run on
  across both" rule until it was corrected the same day. Go feature by feature with the owner (requirements step, one
  scenario at a time): drop or reword scenarios whose name no longer matches their steps, make every `Then` say what is
  seen, and dedupe the union-merged sections of `e2e/STEPS.md`. Pairs with the e2e pruning above. The safe part is done
  (2026-10-23); the contradictions, duplicates and rewordings wait for the owner in
  [proposals/2026-10-23-spec-e2e-cleanup.md](proposals/2026-10-23-spec-e2e-cleanup.md).

## Features

- **Birthdays (create, edit) through the offline queue** (ADR 0031). Still online-only via `optimisticItem`; needs a scenario.
- **In-app: should a session expiring mid-use return to the open page?** (2026-10-23, owner to confirm). The 401
  listener remembers the open page before it leaves for sign-in (unit-tested in `web/test/stores.test.ts`), but no
  scenario specifies it.
- **Android 16 lock-screen countdown (Live Update)** (2026-10-23). See
  [proposals/2026-10-23-calendar-view-ideas.md](proposals/2026-10-23-calendar-view-ideas.md), idea 3.
- **Reorder list items by drag and drop** (owner, 2026-10-23; needs its own slice + spec first). Inside a task list,
  pick up an item and drop it at another place in the list. Today items move only with the up/down buttons
  (`tasklist-items` "Reorder items", `@optional`).
- **Day view: drag an entry to the next or previous day at the screen edge** (owner, 2026-10-23; needs its own slice +
  spec first). In the day view, dragging an entry against the right edge moves it to the next day, against the left
  edge to the previous day (time kept). Today the edge hold only works at the time grid's top and bottom (`dnd`).
- **Confirm a new list item with a check button** (owner, 2026-10-23; needs its own slice + spec first). A small check
  mark / button at the right end of the new-item field adds the item, as an alternative to pressing Enter.
- **Turn a calendar off on a schedule or for a while** (owner, 2026-10-26; needs its own slice + spec first, with
  canvas mockups). (a) Schedule: a calendar shows only on chosen days/times, e.g. the work calendar only Monday to
  Friday. (b) Temporarily off: hide a calendar for a few days, and it comes back by itself afterwards. Both from a long
  press on the calendar's chip (owner: at least the temporary one must be a long press); the schedule may also live in
  Settings. "Off" means exactly what switching a calendar off by hand does today (same hiding, same look, same sync);
  this feature only switches it automatically (owner: "the behavior is already there, just currently manual").
- Canvas performance on the phone (owner, 2026-10-14): pan/zoom/drag are already one transform and save on release; the
  cost is re-layerizing all notes each frame (~40 notes, about half the frames dropped at 8x CPU throttle). Real fix:
  render only the notes in the viewport (or `content-visibility`), needs a spec decision and a real-device trace. Idle
  frames also drop, so check the ambient scene/top-bar animations with remote debugging on the phone.
- Tags (shelved earlier).
- iOS home-screen widget (needs a native shell; a PWA cannot provide widgets on iOS).
- Android widget: verify on a real device (drawn as a bitmap of the week view, never rendered on a device yet).
- Phone UI feels overwhelming and too small (owner, 2026-10-14). Clarify with the owner first which part bothers most.
  Candidates: a larger "comfortable" density on phones; a month view with dots per day plus the selected day's list
  below; fewer toolbar controls; a day/agenda start view on phones.

## Dropped

- Tasks board (Kanban) — owner, 2026-10-13.
- Google Keep sync — the Keep API is Workspace-only; an unofficial client was rejected.
