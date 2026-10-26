# A smaller header: two rows or one row

Owner, 2026-10-26, on the canvas "Smaller header" (https://claude.ai/artifact/BVYrE9CcKQgm86w8GPGCMx; frames H0–H3,
T1–T3, H1E/L/A, H2E/L/A, S1, E1–E4, SC-dark/light and 15 comment threads) plus the final decisions forwarded the same
day. Spec gate: scenarios and this file only; nothing is built yet.

## As Is (measured at 390 x 844, day view, an entry running)

- Top bar 96 px: title row 48 (title-large 22 px: "Monday, 26 October 2026" truncates on phones) + nav row 44
  (‹ Today › at the left, streak flame / plant / sync at the right) + 2 + 2 padding (`AppTopBar.vue` `.grid`).
  Desktop and tablets (≥ 768 px) already use one row: title, nav, widgets, actions, title 24 px.
- Approaching card 84 px with the track (+4 margin above and below); with nothing ahead it still shows a 28 px
  "Nothing else today" card (`NowCard.vue`, `timeline.ts` `nowCardModel`).
- Day view: a 36 px day header "Mon 26" (`TimeGrid.vue` `.head`, `day-header`) repeats the title; it only carries the
  today highlight (`data-today`).
- All-day band 45 px on every day, even when empty: the 44 px tasks-section switch in the gutter sets its height
  (`TimeGrid.vue:175/219`); the day cells are only `min-height: 6px`. A timed task list can be dropped into it (it loses
  its time; `dnd.ts:181-186`); timed events cannot. There is no page-level "dragging" flag: CSS uses
  `.tg:has([data-dragging='true'])` and the `carrying` class.
- The hour grid starts at 269 px.
- Personal display switches live in Settings › Calendar (`approachingCard`, `approachBar`, `approachWindowHours`,
  `navPhone`, `navDesktop`, …; per person prefs, `GET/PATCH /api/prefs`, `web/src/stores/prefs.ts`,
  `server/src/services/prefsStore.ts`) and Settings › Motivation (`streakFlame`, `plant`; account settings).
- Scenes (`TopBarScene` and the scene components) are laid out for the 96 px bar.

## To Be

- Settings › Calendar gets "Header layout": **Two rows** (default) | **One row** (segmented button, right before the
  Approaching card switches; frame S1). Personal pref `headerLayout`, kept per person, not theming: a theme, preset or
  scene change keeps it; theme files and import/export never carry it.
- **Two rows** (H2): 84 px. Title row 48 px, title 18 px, full date. Compact nav row 32 px visuals: ‹ Today › chip and
  flame / plant / sync at the right.
- **One row** (H1): 52 px. Title 18 px with the short date in the day view ("Mon, 26 Oct"; "Di., 13. Okt." in German);
  ‹ [Today icon pill] › right after it; flame / plant / sync / filter / settings at the right. Week, month and year
  titles unchanged.
- Hit areas stay at least 44 x 44 px; the visuals may be smaller (see Q1: the one-row width budget).
- The date is shown once: the day view has no "Mon 26" header (all widths). Its today highlight moves to the Today
  control, which looks "pressed" (secondary-container fill, `data-today-shown="true"`) whenever today is on screen, in
  every view (recommendation, Q2). Week view keeps its weekday headers.
- All-day row: only when it has something to show (an all-day event, a multi-day bar or a task list without a time on
  that day; week view: on any of the 7 days), then exactly as today with its switch. Otherwise it is gone (0 px). While
  something is dragged it appears over the top of the grid (an overlay: the grid does not move under the finger, so the
  drop cells stay valid) so a task list can still be dropped there; after the drag it goes again.
- Approaching card: gone (0 px) when nothing is running and nothing timed is still ahead today (a night band on the
  track, which exists only with the track on, keeps it: Q8); this replaces "Nothing else today". It collapses with its
  existing leave animation, and not during an active drag or scroll gesture (it waits until the gesture ends, so the
  grid does not jump under the finger). The i18n key `calendar.now.nothingElse` stays (the Labs clock uses it). New personal switch "Time left" (pref `approachTimeLeft`, default on) for
  its "Title · 30 min left" line (off: the card's line is just "Title"). Whenever the card does not show the time left
  (card off or line off), the running entry shows "· 30 min left" after its time ("09:00–10:00 · 30 min left", in
  place of the "· 1 h" duration), updating with the clock. Where the block has no time line (too short, or a phone week
  column): Q9. The switch lives in `NowCard.vue`; `nowCardModel` stays as it is (Now/Next and the clock read it).
- Streak flame and plant stay where they are (Settings › Motivation). Sync-indicator switch: proposal only (Q3).
- Scenes: every scene re-arranged for each layout, light and dark. Every part keeps its as-built size (the 96 px scene
  box sits on the bar's bottom edge, sky parts move down by 96 − bar height, taller props are cut only at the bottom
  edge). Characters (cat, hare, ghost) never under or behind a control: measured against every control glyph and moved
  at full size to the nearest free spot; where none exists at that width the character is left out (Easter hare in one
  row at 390 px). Scene props keep using the theme tokens. Calm mode / reduced motion unchanged. The approach that the
  canvas strips used (CSS on the layer containers + per-layout moves, `~/.local/share/calendar-tools/mockups/scenes.cjs`)
  is the reference.
- Grid start (day view, an entry running, nothing all-day): as built 269 px; Two rows 84 + 92 = 176 px (saves 93);
  One row 52 + 92 = 144 px (saves 125); with the card gone or off a further 92 px.

### Why (decisions and the alternatives weighed)

- **Personal setting, not theming** (owner, final): the layout is about how a person uses their phone, not about the
  look; a theme change must not move the controls under the thumb. The earlier proposal (Theme › Fine-tuning, saved with
  the theme, frame S1/E1 round 3) was rejected. Consequence: every scene must look right in both layouts.
- **Two rows default** (owner): keeps the full date and today's arrangement; one row is opt-in for the most room.
- **Card gone instead of "Nothing else today"** (owner comment on T2): an empty card costs 36 px for no information.
- **Time left on the chip** (owner comment on H1: "it should be visible from the chip"): nothing is lost when the card
  is off.
- **All-day row on demand** (owner): an empty row costs 45 px; it must still accept drops, hence the drag rule.

## Requirements

1. R1 Setting "Header layout" in Settings › Calendar, options Two rows (default) and One row; person pref
   `headerLayout` (`two-rows` | `one-row`), validated by the server (400 otherwise), synced like the other prefs and part
   of the last known state.
2. R2 The pref is not theming: not written by `PATCH /api/prefs/theme`, not in theme files, export or import, kept
   across theme, preset and scene changes.
3. R3 Two rows: top bar ≤ 84 px, title 18 px full date, nav row with ‹ Today chip › and the widgets.
4. R4 One row: top bar ≤ 52 px, one row, title 18 px, short date in the day view only, Today as an icon pill labelled
   "Today", widgets and actions at the right.
5. R5 Every top-bar control has a hit area ≥ 44 x 44 px in both layouts (subject to Q1); the mobile touch-target step
   (`mobile.steps.ts:101-113`) is changed to measure the hit area, not the drawn box.
6. R6 Left-handed one row: settings and the other icons left, date, ‹ Today › right (recommendation, Q5).
7. R7 Phones only (< 768 px); desktop and tablets keep their one row and full date (recommendation, Q4).
8. R8 Day view: no day header at any width; the Today control shows when today is on screen (all views, Q2).
9. R9 All-day row only when something is in it (week: any day), as today with its switch; shown during a drag; gone after.
10. R10 Approaching card gone when nothing is on or ahead today (a night band on the track keeps it, Q8); not during a gesture.
11. R11 "Time left" switch (pref `approachTimeLeft`, default on) under the Approaching card.
12. R12 The running entry shows "· N min left" after its time when the card does not show it; never both.
13. R13 Scenes: every scene in both layouts, light and dark: full-size parts, no character under a control,
    left out where it cannot fit; calm mode and reduced motion unchanged; theme tokens only.
14. R14 The title is never cut short for the dates in the scenarios (see Q6 for the longest dates).

## Acceptance Criteria

- AC1 (R1) header-layout "The choice is made in the settings and follows the person"; server unit: default, valid,
  invalid → 400; web unit: prefs store apply/current/rollback.
- AC2 (R2) header-layout "Choosing a theme keeps the header layout", "A theme file does not carry the header layout";
  server unit: `PATCH /api/prefs/theme` ignores/rejects `headerLayout`.
- AC3 (R3) header-layout "A phone shows the two-row header by default".
- AC4 (R4) header-layout "The one-row header puts …", "Only the day view's title is shortened in one row" (4 rows),
  "German shows the short date in German in one row".
- AC5 (R5) header-layout "Every control in the header keeps a 44 px hit area" (both layouts); mobile.feature
  "Touch targets are at least 44 by 44 pixels" stays green.
- AC6 (R6) header-layout "In left-handed mode the one row is mirrored"; left-handed.feature:41/73 stay green.
- AC7 (R7) header-layout "@desktop Desktop keeps its one row with the full date whatever the phone layout is".
- AC8 (R8) header-layout "The day view shows the date only in the title", "The week view keeps its day headers";
  navigation.feature "The Today button shows when today is on screen" (3), "… does not show it …" (3), "Going to today
  in the day view lights up the Today button", "The today button returns to today's day view".
- AC9 (R9) header-layout rule "The all-day row is there only when it has something to show" (6 scenarios).
- AC10 (R10) timeline.feature "The Approaching card is gone when nothing is on or ahead today" (3), "… goes when the
  last entry of the day ends".
- AC11/12 (R11, R12) labs-approach.feature: "With the Approaching card off the running entry shows the time left"
  (day, week; updates after 5 min), "With the Approaching card on the running entry does not repeat the time left",
  "Switching off the time left moves it from the card onto the running entry", "An entry that is not running shows no
  time left".
- AC13 (R13) header-layout "No scene character sits under a control and every part keeps its size" (12 scenes x 2
  layouts x 2 schemes = 48 visual baselines `scene-<scene>-<layout>-<scheme>`), "The Easter hare is left out …",
  "With reduced motion the one-row scene is still from the start"; theme-scenes.feature stays green.
- AC14 (R14) "the period title is not cut short" in AC3/AC4.

## Changed existing scenarios (verified one by one)

- navigation.feature "The today button returns to the period containing today": day row removed (the day view has no
  day header to highlight); new "The today button returns to today's day view" keeps the URL check.
- navigation.feature "The current day is highlighted in every view" and "No day is highlighted when today is not
  visible": day rows removed; the day view is covered by the new Today-button outlines (@backlog).
- timeline.feature "The Now card when nothing else is scheduled today" ("Nothing else today"): replaced by the two
  @backlog scenarios above.
- labs-approach.feature: description extended (card gone when nothing is on or ahead, Time left switch, time left on
  the chip); "The Approaching card can be switched off" unchanged; four new @backlog scenarios.
- Checked and unchanged (the default Two rows keeps their behaviour): mobile.feature:53 (touch targets), left-handed
  .feature:41 and :73, navigation.feature:56 and the deep-link outline (:61, full date), language.feature:48 (German
  full date), timeline.feature:102 and :115 (an entry is still ahead, so the card stays), theme-menu.feature (has no
  header-layout or fine-tuning header lines: the theme proposal never landed, so nothing to remove).

## Testing Plan

- Unit (vitest): prefs store and server prefs (`headerLayout`, `approachTimeLeft` defaults, validation, merge); theme
  export/import strips nothing because the key never enters the theme; `nowCardModel`/card visibility rule (running,
  ahead, night band); the chip's time-left text; the all-day row visibility rule (pure function over the band items +
  drag state); the short day title per locale (`Intl` `weekday: 'short', day: 'numeric', month: 'short'`).
- e2e (targeted, `--grep` per scenario name; mobile + desktop where tagged): the scenarios listed in the AC, the
  changed navigation/timeline/labs-approach scenarios, and the unchanged ones listed above as regression guards; dnd
  all-day scenarios (dnd.feature:356/365) and tasklists-display all-day scenarios as regression guards.
- Visual: `@visual` top-bar baselines per scene x layout x scheme (48), plus the day view at phone size in both layouts
  with and without the all-day row; LOOK at every PNG at phone size before calling it done.

## Implementation Plan (smallest steps; PR boundaries marked)

1. Pref `headerLayout` + `approachTimeLeft` (server store, routes validation, API.md, types, prefs store, last known
   state) → unit tests.
2. Settings rows: "Header layout" segmented (`settings-header-layout`) before "Approaching card"; "Time left" switch
   (`settings-approach-time-left`) under it → e2e "The choice is made in the settings …".
3. Top bar: `data-layout` on `top-bar`; Two rows CSS (18 px title, 32 px nav visuals with 44 px hit areas); One row
   grid + Today icon pill + short day title; left-handed one-row mirror; ≥ 768 px unchanged → header-layout layout
   scenarios.
   **PR 1 — header layouts** (steps 1–3): independently mergeable; the default Two rows already saves 12 px of bar height.
4. (PR 1 also changes `mobile.steps.ts` to measure hit areas.) Day view: drop the day header; Today control `data-today-shown` + pressed look in all views → navigation scenarios.
5. All-day row on demand (+ appear while dragging; a page-level drag flag or `:has()` on the shell) → all-day rule.
6. Approaching card gone when nothing is on or ahead; time left on the running chip when the card does not show it →
   timeline + labs-approach scenarios.
   **PR 2 — date once, rows on demand, card** (steps 4–6): independent of PR 1 (works with the as-built bar).
7. Scenes: per-layout arrangement for every scene (layer boxes at 96 px on the bottom edge, sky moves, character
   placement table per layout and width, hare out in one row at 390 px), light and dark → scene outline + baselines.
   **PR 3 — scenes for both layouts**: must land with or right after PR 1 (until then One row shows the scenes cut
   as-is). If the owner prefers, PR 1 + PR 3 ship together as one PR (recommended: one PR, atomic commits).

Effort: PR 1 ≈ 0.5–1 day; PR 2 ≈ 1 day; PR 3 ≈ 1–1.5 days (12 scenes x 2 layouts x 2 schemes, measured placement, 48
baselines to look at). About 3–3.5 days in all.

## Open questions (with a recommendation each)

- Q1 **Hit areas vs the bar heights and widths (blocking for R5).** Two rows: 84 px = 2 + 48 title row + 32 nav row
  + 2, so a 44 px tall nav hit area reaches 6 px above into the title row or 6 px below the bar over the card/grid.
  Recommendation: the nav row's hit areas reach 6 px down over the content (the bar is stacked above it), the title
  row keeps its 48. One row: the width budget below. At 390 px the row has 384 px. The short date at
  18 px is 99 px ("Mon, 26 Oct", measured), with chevron and padding ≈ 131 px. ‹ Today › flame plant sync filter
  settings at 44 px each = 352 px → 483 px in all; even with the plant off and the sync icon hidden it is 395 px.
  So one row cannot give every control a 44 px wide hit area (not yet counted: the install button and plug-in
  widgets when they show). Recommendation: 44 px tall hit areas for all, 44 px wide
  for ‹ Today › filter settings; in one row the sync icon shows only while syncing fails (Q3's "off" behaviour) and the
  flame and plant get ≥ 32 px wide hit areas (WCAG 2.5.8 asks 24 px); alternatively the title chevron goes in one row
  (the title stays tappable), which frees 20 px.
- Q2 **Where the today highlight goes.** Recommendation: the Today control looks pressed (secondary-container fill)
  whenever today is on screen, in every view and both layouts; outlined when it is not. Alternative: only in the day
  view, or a dot under the date in the title.
- Q3 **Sync-indicator switch.** Recommendation: yes, in Settings › Calendar after the Approaching rows, on by default;
  off = the icon shows only while syncing fails (problems always show). It also helps Q1.
- Q4 **Desktop (≥ 768 px).** It already has one row with the full date and the Today word. Recommendation: the setting
  applies to phones only (the hint says "On phones"); desktop unchanged except the day header going (date once).
- Q5 **Left-handed in one row.** Recommendation: mirror like two rows: settings, filter, sync, plant, flame at the left,
  then the date, ‹ Today › at the right (matches the existing left-handed rule: settings left, Today right).
- Q6 **Longest dates in two rows.** "Wednesday, 30 September 2026" is 262 px at 18 px; with the chevron, padding and
  filter + settings it needs ≈ 400 px, so it still truncates at 390 px by about 10–20 px. Recommendation: accept the ellipsis for
  the few longest dates, or tighten the title's padding and chevron (8 + 20 px) so it fits; the scenarios use dates
  that fit.
- Q7 The all-day row's switch: today it shows whenever the row shows. The canvas note proposed showing it only when
  task lists are in the row. Recommendation: keep as today (decision 5 says "as today").
- Q8 A night band (bedtime mode) on the track counts as "something ahead" and keeps the card (only with the track
  on: the bands are computed only then). Recommendation: yes; then add a scenario (bedtime on, nothing ahead, track on
  → card shown).
- Q9 Time left where the running block has no time line (a short block, or a phone's narrow week column: the time line
  needs the block's height budget). Recommendation: for the running entry the time line takes priority over the second
  title line; a block too short for two lines shows "30 min left" after its title. Until decided, the week example of
  that scenario runs on desktop only.
- Q10 Which bars follow the layout: the Tasks view and the date-less Labs views (Now, Timeline) use the same top bar
  without ‹ Today ›. Recommendation: they follow it too (one row: title + widgets/actions in 52 px; two rows: the title
  row alone, 52 px, as there is no nav row). Narrowest phone: 360 px (budget in Q1 is then 30 px tighter; the title
  ellipsis is the fallback).

## Assumptions

- "Time left" switch: decision 3 names a time-left line among the personal switches; there is no such switch today, so
  it is new, under "Approaching card", default on.
- The time left on the chip shows only for timed events (the card's "running" rule, `nowCardModel`), not task lists.
- "Nothing ahead" is scoped to today, like the card's "Next" line (tomorrow's entries do not keep the card).
- The settings preview under the Header layout choice (frame S1) is a proposal; without it the row is the plain
  segmented button.
