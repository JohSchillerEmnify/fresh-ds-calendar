# Grid gestures: turn the day/week while dragging, events side by side, draw to create

Owner decisions (2026-10-25, on design boards; background: `docs/HANDOFF-2026-10-25.md` sections 8–10 on
`origin/month-overnight`):

- **A** In the DAY view, holding a dragged item at the left/right edge shows a band with the target day ("Thu 15 ›" /
  "‹ Tue 13"); after ~0.6 s the view flips to that day and the drag continues there (like Google Calendar). Same in the
  WEEK view: previous/next week. Events and timed task lists, touch and mouse.
- **B** Settings › Calendar: "Day view: events side by side" Up to 2 / 3 / 4 (default Up to 4) and "Week view: events
  side by side" Up to 2 / 3 (default Up to 2). Overlapping events share the width up to that many columns; more overlap
  on top of the last column, slightly shifted, like today.
- **C** Draw to create (day + week time grid, not month): phone long-press on empty grid then drag (a plain swipe keeps
  scrolling); desktop press and drag. Snaps to 15 min. Week view: may cross into the next day column (overnight). On
  release the new dialog opens with start and end; switching to Task list keeps the time and uses the drawn length as
  the estimate. The drawn block stays visible behind the dialog and disappears on Cancel. A plain tap still opens the
  dialog at the tapped hour with the default length.

Owner answers (2026-10-25): all scenarios approved. Q1 extra column beyond the limit rather than a hidden title: yes.
Q2 the Android widget's week grid (`WeekLayout.packColumns`, `WeekLayoutTest`) follows "Week view: events side by side"
in this same change. Q3 a long press let go without moving opens the 15-min block: yes (scenario added). Q4 band label
"19–25 Oct ›" and all-day items turn the day/week too: yes (scenario added).

Status: B in build; A and C after `fix/touch-drag` is merged into main. The touch-drag fix for iOS/Android runs
separately on `fix/touch-drag`; A and C build on top of it and must not touch that fix.

## As Is

- Drag: `web/src/motion/drag.ts` `useDraggable` (idle → pending → dragging → dropping; touch long press 350 ms, slop
  8 px; auto-scroll when resting in the top/bottom edge zone of `scrollEl`). `web/src/features/calendar/dnd.ts`
  `useCalendarDrag` hit-tests month cells, the all-day row, and the time grid via `createSlotGrid` (15-min slots per
  day column). The day view grid has one column, so a drag cannot leave the day; nothing reacts to the side edges.
- Overlap layout: `packColumns` in `web/src/lib/items.ts`. Entries starting less than `max(15 min, one title row)`
  apart (title row = `TITLE_ROW_PX` 18 px, ~22–25 min at the default 44/48 px per hour) share equal columns, without a
  limit; a later overlapping start opens a cascade group one level deeper (indent `STACK_INDENT_PX` 10 px, 6 px on a
  phone; up to `MAX_STACK_DEPTH` 3, beyond that it joins the last group's columns). A block widens into free columns to
  its right. Callers: `TimeGrid.vue` (day/week and the two-row overview), Labs `StripView`, `ZoomTimeline`,
  `TimelineView`, `runway.ts`; the Android widget has a Java port (`WeekLayout.packColumns`).
- Prefs: per person in `web/src/stores/prefs.ts` / `server/src/services/prefsStore.ts`, `GET/PATCH /api/prefs`;
  latest example `minEventMinutes` with a segmented button in Settings › Calendar (`SettingsView.vue`).
- Create: `TimeGrid.vue` has one `time-slot` button per hour; a click calls `openNew(date, hour)` (in the two-row
  overview, `fit`, it opens the day instead). The new dialog (switch Event | Task list | Birthday) takes a start only:
  events default to 1 h, task lists to their estimate (else 30 min).

## To Be

### A · Turning the day or week while dragging

- While an event or task list is dragged in the day or week view, strips at the left and right side of the day columns
  area are edge zones: the outer 24 px in both views (owner 2026-10-25). Entering one shows a band (`drag-edge-band`) along that side: day view "‹ Tue 13" /
  "Thu 15 ›" (short weekday + day of month), week view "‹ 5–11 Oct" / "19–25 Oct ›" (the target week's range).
- After 600 ms (day view) or 1 s (week view) in the zone the view navigates to the previous/next day or week; the drag
  continues on the new grid. Staying in the zone turns again after each such wait. Leaving the zone earlier hides the band and cancels the turn.
- A drop always lands on the 15-min slot under the pointer in the grid shown (a quick drop on the outermost column
  is unaffected because the turn needs the rest in the zone; the week view waits 1 s so Sunday stays a drop target).

### B · Events side by side

- Prefs `daySideBySide` 2|3|4 (default 4), `weekSideBySide` 2|3 (default 2); two segmented buttons in Settings ›
  Calendar ("Day view: events side by side", "Week view: events side by side", options "Up to N"), all locales.
- New `packColumns` rule in stack mode with limit N (see feature text in `events-display.feature`): place entries in
  start order (same start: longer first; same start and end: the day's usual order). Each takes the leftmost column
  free at its start; if none is free and fewer than N columns are used, it opens a new column. If all columns are busy
  it is laid over the last column, one cascade level above the topmost block there (max 3 levels; deeper ones stay at
  level 3), and that column stays busy until everything over it has ended. Exception (title rule): if the topmost block
  of the last column starts less than `max(15 min, one title row)` before the entry, the entry gets one more column
  instead (beyond N), so no title is ever covered. The overlap cluster shares the width in as many equal columns as it
  uses; a block still widens into free columns to its right.
- `stack = false` (Labs horizontal view) unchanged; the Labs views keep today's layout (no limit passed).

### C · Draw to create

- On empty grid space of a day/week time grid (not month, not the two-row overview): mouse press + move beyond the
  slop starts drawing; on touch a 350 ms long press (haptic tick) starts it, a move before that is a scroll.
- The block (`draw-block`) runs from the press to the pointer, each end rounded to the nearest quarter hour, at least
  15 min; drawn upwards it runs from the pointer to the press. In the week view it may reach the next (or previous)
  day column; further columns are clamped to that neighbour. Top/bottom auto-scroll works as for dragging.
- On release the new dialog opens with start date/time and end date/time; the block stays drawn behind it. Cancel
  removes it; Save replaces it with the entry. Switching to Task list keeps date and start time and sets the estimate
  to the drawn length (capped at the task list maximum of 12 h).
- A tap (no drag) is unchanged: dialog at the tapped hour, default length.

## Requirements and acceptance criteria

| # | Requirement | Acceptance (scenarios) |
|---|---|---|
| R1 | Edge band (24 px) + turn after 600 ms (day) or 1 s (week), day and week, events and timed task lists, touch and mouse | `dnd.feature` Rule "Holding a dragged entry at the side edge …": day/week outlines, keeps turning, task list, leaving the edge, quick drop on Sunday (phone), long hold in the middle of Sunday. Mobile project = touch, desktop project = mouse. |
| R2 | Two side-by-side settings with defaults 4 / 2 | `settings.feature` "Default settings on first run"; `events-display.feature` "Choosing up to …" ×2 |
| R3 | Column packing up to N, overflow cascades on the last column, freed columns refilled, title rule | `events-display.feature` Rule "Overlapping entries sit side by side …" (6 layout scenarios); the two old cascade scenarios were replaced. |
| R4 | Draw to create with snapping, upwards, overnight, preview, cancel, save | `events-crud.feature` Rule "Drawing on the empty time grid …" (9 scenarios) |
| R5 | Drawn block to task list with drawn length as estimate (≤ 12 h) | `tasklists-crud.feature` two "drawn block" scenarios |
| R6 | Prefs validated by the server | `spec/API.md` Prefs "Events side by side" (400 on other values); unit tests at build time |

## Assumptions (agent, to confirm)

1. Edge zone 24 px; turn after 600 ms in the day view, 1 s in the week view (owner), repeating while held; band texts as above (en-GB
   formats, localised per language).
2. The edge turn applies to every drag in the day/week time grid and all-day row, not only timed entries; month view
   and two-row overview unchanged. It does not apply while drawing (C) or resizing.
3. Side-by-side limits apply on every screen size, the two-row week overview counts as the week view, Labs views keep
   today's layout. The Android widget's week grid follows `weekSideBySide` (owner Q2), handed over in the widget
   snapshot like `minEventMinutes`.
4. Overflow beyond N obeys the existing "a title is never covered" rule (owner 2026-10-20): a near-same start gets an
   extra column rather than covering a title. Cascade depth stays capped at 3.
5. Draw snapping rounds each end to the nearest quarter (like move/resize), minimum 15 min. A long press released
   without moving opens the dialog with that 15-min block (what was shown).
6. Drawing across days reaches at most the neighbouring day column. Drawing starts only on empty grid; the block may
   pass over existing entries. Escape cancels a drawing in progress.
7. No architecture change: A and C extend `useDraggable`/`useCalendarDrag` and `TimeGrid.vue`; B extends
   `packColumns` and prefs. LikeC4 untouched (unless the widget follows B).

## Testing plan

- Unit (vitest): `packColumns` with limits 2/3/4 — the board example (starts 0, 15, 30, 60 min), freed column,
  overflow levels, title-rule extra column, widening, `stack=false` unchanged; prefs validation (server); edge-zone
  timer and band label (pure function); draw range from press/pointer (rounding, upwards, min 15, neighbour clamp).
- e2e (targeted, both projects): the new scenarios above by name; re-run existing `@overlap`, `@dnd` and the visual
  "title readable" scenarios; `@visual` pictures of the day/week grid with 4 overlapping entries at phone size.
- `python3 e2e/scripts/check-steps.py` 0 problems (done for the spec), `pnpm --silent verify`.

## Implementation plan (after the owner's OK)

1. B: `packColumns` limit + unit tests → prefs + server validation + Settings UI + i18n → TimeGrid wiring → e2e
   `@overlap`. **PR boundary 1** (independent of the touch fix).
2. A: edge zone + band + timer in the drag layer, view turn in `useCalendarDrag` → e2e dnd edge scenarios. Needs
   `fix/touch-drag` merged first.
3. C: draw gesture on empty grid (reusing `useDraggable` long press/slop/auto-scroll and `createSlotGrid`), new dialog
   takes an end / estimate, `draw-block` preview → e2e draw scenarios. **PR boundary 2** (A + C, gestures).
