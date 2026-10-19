# Backlog and known bugs

Tracked here so it survives across sessions. Newest first within each section. Move an item out when it ships.

## Bugs

- **Desktop month-picker swipe fails** (2026-10-18). `month-picker.feature` "Arrows and swipes change the month
  inside the picker" fails on `--project=desktop` (mouse-drag branch of `swipePicker` in `year.steps.ts`,
  `expect(...).not.toHaveText` on the month). Pre-existing (fails on main), not from the dedup work. Investigate the
  desktop drag-swipe in the picker.

- **Zooming is broken on the month overview** (2026-10-16, owner). The pinch/Ctrl-wheel zoom on the month view is
  broken; investigate and fix. (Separate from the zoom-month lab.)
- **Deep-link return after sign-in is sometimes lost** (2026-10-16, owner chose backlog). Opening a specific page while
  signed out should return there after sign-in; ~1 in 8 it lands on the default month view instead. Pre-existing, cosmetic
  (you are signed in correctly, just on the wrong starting page). The return is stashed in `sessionStorage` (`RETURN_KEY`)
  by the router `beforeEach` and read by the `/` redirect (`takeReturn`, `web/src/router/index.ts`); the two cross during
  the sign-in redirect. Reproduce: `e2e/run.sh --grep "and sees their calendar" --repeat-each 8` (fails ~1/8 on main).
- **Android back gesture fix: verify on the phone** (branch `android-back-notify`, needs an APK build). Back should
  close the open overlay, then go to the previous view, and leave the app only with no history left.
- **Canvas: long press on an item row does not pick up the note** (2026-10-13, owner, phone). Not reproducible in
  Chromium mobile emulation; a defensive fix (`touch-action`, `user-select`, `-webkit-touch-callout`, prevented
  `contextmenu`/`selectstart`) shipped. Owner to retest on the phone; if it still fails, capture a remote-debug log of the
  pointer/touch events on one row.

## Waiting for the real Google login (branches on sauron and GitHub, in the preview)

- `shared-lists` — share task lists with the partner (per list and per category), server storage.
- `drive-backup` — back up all server data to the hidden Google Drive app folder; restore (contains `shared-lists`).
- `perf-budget2` — first-load JS 167 → 135 KB, Lighthouse budget = median of 3 runs ≥ 70.

Prerequisites (owner): HTTPS on a real domain (Cloudflare DNS + token in `~/docker-compose/traefik/.env.cloudflare`),
Google Cloud OAuth client (values in `~/projects/calendar/deploy/.env`). See [DEPLOYMENT.md](DEPLOYMENT.md).

## Tech debt

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
  low-value cases, and see whether some belong as unit tests instead. Goal: a leaner, faster suite.
- **Clean up the spec** (owner, 2026-10-19: "wir müssen echt den spec mal aufräumen"). Scenarios and prose that
  predate later owner decisions contradict them without failing: `tasklists-expand.feature` "A long title wraps and
  stays fully readable in the grown card" (a 30-minute list) now shows a tight one-line pill with an ellipsis, as decided
  on 2026-10-19 ("Pille = Blockhöhe, Titel mit Ellipsis"); `ARCHITECTURE.md` carried an invented "item rows run on
  across both" rule until it was corrected the same day. Go feature by feature with the owner (requirements step, one
  scenario at a time): drop or reword scenarios whose name no longer matches their steps, make every `Then` say what is
  seen, and dedupe the union-merged sections of `STEPS.md` and `ARCHITECTURE.md`. Pairs with the e2e pruning above.

## Features

- Canvas performance on the phone (owner, 2026-10-14): pan/zoom/drag are already one transform and save on release; the
  cost is re-layerizing all notes each frame (~40 notes, about half the frames dropped at 8x CPU throttle). Real fix:
  render only the notes in the viewport (or `content-visibility`), needs a spec decision and a real-device trace. Idle
  frames also drop, so check the ambient scene/top-bar animations with remote debugging on the phone.
- Push notifications in the PWA (Web Push, needs HTTPS). The Android app shows the bedtime reminder as a notification
  (branch `android-back-notify`; needs an APK build and a check on the phone).
- Tags (shelved earlier).
- iOS home-screen widget (needs a native shell; a PWA cannot provide widgets on iOS).
- Android widget: verify on a real device (drawn as a bitmap of the week view, never rendered on a device yet).
- Two-row week overview (owner, 2026-10-16): instead of 7 narrow day columns, lay the week out in two rows — the first
  four days on top, the rest below — to use the width better and read as a nicer overview. A layout option/view for the
  week.
- Finish migrating `spec/ARCHITECTURE.md` into the LikeC4 model under `docs/architecture/` (owner,
  2026-10-19; see ADR 0001). Started with the two-row week overview slice; port the rest part by
  part as each is touched.
- Phone UI feels overwhelming and too small (owner, 2026-10-14). Clarify with the owner first which part bothers most.
  Candidates: a larger "comfortable" density on phones; a month view with dots per day plus the selected day's list
  below; fewer toolbar controls; a day/agenda start view on phones.

## Dropped

- Tasks board (Kanban) — owner, 2026-10-13.
- Google Keep sync — the Keep API is Workspace-only; an unofficial client was rejected.
