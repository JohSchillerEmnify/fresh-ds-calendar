# A smaller header: two rows or one row

Owner, 2026-10-26, on the canvas "Smaller header" (https://claude.ai/artifact/BVYrE9CcKQgm86w8GPGCMx; frames H0–H3,
T1–T3, H1E/L/A, H2E/L/A, S1, E1–E4, SC-dark/light and 15 comment threads) plus the final decisions forwarded the same
day; second round of owner decisions 2026-10-26 (streak choice, one row with a streak, Today look, sync indicator,
desktop day header) recorded below. Spec gate: scenarios and this file only; nothing is built yet.

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
  `server/src/services/prefsStore.ts`, one file per person).
- Streak flame and plant: two switches "Streak flame" and "Plant" in Settings › Focus & motivation
  (`settings-streak-flame`, `settings-plant`), both default on. They are **not** person prefs: they are
  `Settings.streakFlame` / `Settings.plant` in the shared settings (`server/src/services/settingsStore.ts`, one
  `settings.json` for the whole server, `GET/PATCH /api/settings`, `web/src/stores/settings.ts`), validated in
  `server/src/lib/validation.ts`. `AppTopBar.vue` passes them to `LeadingWidgets.vue`, which shows `StreakFlame` (a
  `span`, not a button) and the plant (`plant-button`, a button that opens the plant card). The check-in message toast
  (`StreakToast`, "Checked in, day N") is shown only with the flame on. The check-ins and the plant's points live in the
  server-wide motivation state and are counted whatever the switches say.
- Sync icon: `SyncStatus.vue` (`sync-status`, a `span role="status"`, 28 x 44 px, not a button) always shows in the
  top bar: sync arrows (spinning while syncing), a red problem icon when syncing fails. The e2e harness
  (`world.settled()`, `I wait for the automatic sync`, `the server has answered`) reads its `data-state` and
  `data-last-sync` and needs the element in the page.
- Desktop day view: the same 36 px day header "Mon 26" above the grid; desktop top bar one row with the full date.
- The Today button looks the same whether or not today is shown.
- Scenes (`TopBarScene` and the scene components) are laid out for the 96 px bar.

## To Be

- Settings › Calendar gets "Header layout": **Two rows** (default) | **One row** (segmented button, right before the
  Approaching card switches; frame S1). Personal pref `headerLayout`, kept per person, not theming: a theme, preset or
  scene change keeps it; theme files and import/export never carry it.
- **Two rows** (H2): 84 px. Title row 48 px, title 18 px, full date. Compact nav row 32 px visuals: ‹ Today › chip and
  the streak (if chosen) / sync (if shown) at the right.
- **One row** (H1): 52 px. Title 18 px with the short date in the day view ("Mon, 26 Oct"; "Di., 13. Okt." in German);
  ‹ [Today icon pill] › right after it; the streak (flame or plant, if chosen) / sync (if shown) / filter / settings
  at the right. Week, month and year
  titles unchanged.
- Hit areas of buttons stay at least 44 x 44 px; the visuals may be smaller. Exception: the plant in one row, 44 x 32
  (owner; see "One row with a streak on").
- The date is shown once: the day view has no "Mon 26" header (all widths). Its today highlight moves to the Today
  button (see "Today" below; `data-today-shown="true"` whenever today is on screen, in every view). Week view keeps
  its weekday headers.
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
- **Streak** (owner, 2026-10-26): one choice "Streak" in Settings › Focus & motivation, Off | Flame | Plant
  (segmented button `settings-streak`), replacing the two switches. Personal pref `streak` (`off` | `flame` | `plant`),
  default Off, not part of the theme. Off for everyone after the change ("Off for everyone"): the old switches are not
  carried over (migration below). Counting stays: check-ins and plant points are recorded whatever is chosen; only
  what the top bar shows changes. The check-in message ("Checked in, day N", "Welcome back!") always shows, whatever
  is chosen, Off included (owner, 2026-10-26; as built it came only with the flame, `StreakToast` in
  `LeadingWidgets.vue` gated by `streakFlame`).
- **Streak migration** (one-time, server): `Settings.streakFlame` / `Settings.plant` are retired. On load the server
  drops both keys from `settings.json` (the next save writes the file without them); `GET /api/settings` no longer
  returns them and `PATCH /api/settings` rejects them (400, like the retired `garden`). Nothing is copied into the
  person prefs, so every person (existing and new) reads the default `streak = 'off'`. No marker is needed: the pref
  is only ever written by the person's own choice. A restored older backup with the keys is cleaned the same way on
  load. The web app ignores the two fields in a cached copy of the settings (last known state) and, until the prefs
  arrive, treats `streak` as Off (no flash of a flame or plant).
- **One row with a streak on** (owner): the row stays one row. The plant (the only streak widget that is a button) gets
  a tap area 44 px tall x 32 px wide; every other button keeps 44 x 44. The flame and the sync icon are not buttons
  and need no tap area (the flame is drawn in a 32 px wide slot). With a streak on **and** syncing failing (the problem
  icon showing) the short date would be cut by about 22 px on a 390 px phone, so in one row the date's ⌄ chevron is
  hidden only while that lasts and the date fits in full (owner, 2026-10-26, Q11). The title stays tappable.
- **Today** (owner): the Today button is the today mark. Filled (the built-in tonal look, secondary container) while
  today is in the shown period; outlined on a solid surface fill (the scene never shows through) when it is not. It
  replaces the today circle of the "Mon 26" day header. Same in both layouts and on desktop.
- **Sync indicator** (owner): new switch "Sync indicator" in Settings › Calendar (`settings-sync-indicator`, personal
  pref `syncIndicator`), **off** by default. Off: the sync icon is hidden (takes no room) except while syncing fails;
  the problem icon always shows. On: as built (always shown). It applies at every width. The `sync-status` element
  stays in the page when hidden, with its data attributes (the e2e sync waits read them).
- **Desktop** (owner): the desktop day view drops the day header too; the grid starts 36 px higher. The desktop top
  bar keeps its one row with the full date; the header layout setting is for phones only (Q4 answered).
- **Left-handed is an exact mirror** (owner, 2026-10-26): in left-handed mode (`html[data-hand='left'][data-touch]`) the
  top bar's boxes are the mirror image of the right-handed bar's, in both layouts, so a season scene can simply be
  flipped: the period title's text is aligned to the outer (right) edge, the widgets (flame or plant, sync) come in
  reverse order, and ‹ Today › keeps its order (back stays on the left; the group is symmetric, so the mirror of the ‹
  box is the › box). Desktop (≥ 768 px) is not affected.
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
- **Streak and Approaching card are personal switches, not themed** (owner, decided): like the header layout, they are
  about how a person uses the app. Decision (owner, 2026-10-26): the streak choice is **per person**; it moves from
  the shared `Settings` (today the two switches are shared by everyone on the server) to the person prefs, like the
  other personal switches. On a server with several people each chooses their own.
- **Check-in message always** (owner, 2026-10-26): the message is the reward of the check-in, not of the flame, so it
  shows whatever the streak choice is.
- **Chevron gives way to a sync problem** (owner, Q11): the chevron is the least needed glyph (the title stays a
  button); hiding it only while both a streak and a sync problem show keeps one row and the full date.
- **One streak choice instead of two switches** (owner): the flame and the plant never both fit the one-row budget; one
  choice keeps the row to at most one 32 px widget. **Off by default and for everyone** (owner): the top bar starts as
  quiet as possible; who wants a streak picks one. Alternative weighed: keep each person's old switches (rejected by
  the owner: "Off for everyone").
- **Plant tap area 32 px wide** (owner): keeps one row one row; 32 px is above the WCAG 2.5.8 minimum of 24 px.
- **Sync icon only on problems by default** (owner): while all is well it carries no information; it frees 28 px.
- **Left-handed as an exact mirror** (owner, 2026-10-26): a scene arranged for the right-handed bar only needs to be
  flipped, not re-arranged a third time; ‹ Today › keeps its reading order because "back" on the right would be
  confusing, and the group's symmetry keeps the mirror exact anyway.
- **Today button as the today mark** (owner): the date is shown once, so the highlight needs a new home; the solid
  fill when outlined keeps it readable over every scene.

## Requirements

1. R1 Setting "Header layout" in Settings › Calendar, options Two rows (default) and One row; person pref
   `headerLayout` (`two-rows` | `one-row`), validated by the server (400 otherwise), synced like the other prefs and part
   of the last known state.
2. R2 The pref is not theming: not written by `PATCH /api/prefs/theme`, not in theme files, export or import, kept
   across theme, preset and scene changes.
3. R3 Two rows: top bar ≤ 84 px, title 18 px full date, nav row with ‹ Today chip › and the widgets.
4. R4 One row: top bar ≤ 52 px, one row, title 18 px, short date in the day view only, Today as an icon pill labelled
   "Today", widgets and actions at the right.
5. R5 Every top-bar button has a hit area ≥ 44 x 44 px in both layouts (except the plant in one row, R17); the flame
   and the sync icon are not buttons; the mobile touch-target step
   (`mobile.steps.ts:101-113`) is changed to measure the hit area, not the drawn box.
6. R6 Left-handed one row: settings and the other icons left, date, ‹ Today › right (recommendation, Q5).
7. R7 Phones only (< 768 px); desktop and tablets keep their one row and full date (owner, 2026-10-26; Q4).
8. R8 Day view: no day header at any width; the Today button shows when today is on screen (all views; R18).
9. R9 All-day row only when something is in it (week: any day), as today with its switch; shown during a drag; gone after.
10. R10 Approaching card gone when nothing is on or ahead today (a night band on the track keeps it, Q8); not during a gesture.
11. R11 "Time left" switch (pref `approachTimeLeft`, default on) under the Approaching card.
12. R12 The running entry shows "· N min left" after its time when the card does not show it; never both.
13. R13 Scenes: every scene in both layouts, light and dark: full-size parts, no character under a control,
    left out where it cannot fit; calm mode and reduced motion unchanged; theme tokens only.
14. R14 The title is never cut short for the dates in the scenarios (see Q6 for the longest dates; and Q11: streak on
    plus a sync problem in one row).
15. R15 Streak choice "Streak" (Off | Flame | Plant) in Settings › Focus & motivation; person pref `streak`
    (`off` | `flame` | `plant`, default `off`), validated by the server (400 otherwise), synced like the other prefs,
    not part of the theme, per person. Flame shows `streak-flame`, Plant shows `plant-button`, Off neither. Check-ins
    and plant points are counted and the check-in message shows whatever is chosen.
16. R16 Migration: `Settings.streakFlame` and `Settings.plant` retired (not served, `PATCH /api/settings` 400, dropped
    from `settings.json` on load, also from a restored backup); not copied to anyone's prefs, so everyone is Off.
17. R17 One row with a streak on stays one row: `plant-button` tap area at least 44 tall x 32 wide; every other top-bar
    button at least 44 x 44; the flame and the sync icon are not buttons. Supersedes R5 for the plant only. While the
    sync problem icon shows next to a streak in one row, the title's chevron is hidden and the date is not cut (Q11).
18. R18 Today button: `data-today-shown="true"` and filled (tonal, secondary container) while today is in the shown
    period; otherwise outlined with an opaque surface background. Both layouts and desktop. (Refines R8.)
19. R19 Sync indicator: person pref `syncIndicator` (boolean, default `false`, 400 otherwise), switch
    `settings-sync-indicator` in Settings › Calendar. Off: `sync-status` hidden (no room taken) unless
    `data-state="error"`; on: always shown. The element stays in the page in both cases.
20. R20 Desktop day view: no day header; the grid starts 36 px higher; top bar unchanged (one row, full date).
21. R21 Left-handed mirror (phones, both layouts): every top-bar control's box in left-handed mode is the mirror image
    (about the bar's vertical centre line) of its right-handed box within 1 px; ‹ Today › keeps its order (the ‹ box
    mirrors to the › box and back); the title's text is aligned to the outer edge; the widgets are in reverse order.
    Refines R6 (owner, 2026-10-26).

## Acceptance Criteria

- AC1 (R1) header-layout "The choice is made in the settings and follows the person"; server unit: default, valid,
  invalid → 400; web unit: prefs store apply/current/rollback.
- AC2 (R2) header-layout "Choosing a theme keeps the header layout", "A theme file does not carry the header layout";
  server unit: `PATCH /api/prefs/theme` ignores/rejects `headerLayout`.
- AC3 (R3) header-layout "A phone shows the two-row header by default".
- AC4 (R4) header-layout "The one-row header puts …", "Only the day view's title is shortened in one row" (4 rows),
  "German shows the short date in German in one row".
- AC5 (R5) header-layout "Every button in the header keeps a 44 px hit area" (both layouts, streak Off); mobile.feature
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
- AC14 (R14) "the period title is not cut short" in AC3/AC4 and in the two streak scenarios of AC17.
- AC15 (R15) plant.feature "The streak choice decides what the top bar shows" (Off, Flame, Plant), "Nobody sees a
  streak until they choose one", "The streak choice follows the person to another device", "The plant keeps growing
  while it is not shown"; streak.feature "The check-in counts and its message shows whatever the streak choice is"
  (Off, Plant); sunflowers.feature "The
  field shows whatever the streak choice is" (3); server unit: `streak` default `off`, valid values, invalid → 400;
  web unit: prefs store default and rollback.
- AC16 (R16) server unit: a `settings.json` with `streakFlame: true, plant: true` loads without them, the next save
  drops them, `GET /api/settings` has neither, `PATCH /api/settings { streakFlame }` / `{ plant }` → 400, and every
  person's `GET /api/prefs` says `streak: 'off'`; web unit: a cached settings copy with the old keys does not show a
  flame or plant.
- AC17 (R17) header-layout "With the plant on, the one row keeps its date and gives the plant a narrower tap area",
  "With the flame on, the one row keeps its date", "In one row with a streak on, a sync problem hides the date's
  chevron so the date fits".
- AC18 (R18) header-layout "The Today button marks today in both layouts" (4); navigation.feature Today-button scenarios
  (AC8) with the filled / outlined-on-solid looks in STEPS.md.
- AC19 (R19) header-layout rule "The sync icon shows only when syncing fails, unless the person turns it on" (3);
  google/sync.feature and last-known-state.feature stay green (they wait on `sync-status` while it is hidden); server
  unit: `syncIndicator` default false, non-boolean → 400.
- AC20 (R20) header-layout "@desktop On desktop the day view has no day header either"; the 36 px is checked in the
  desktop day-view visual (the grid's top moves up by the old header's 36 px).

- AC21 (R21) header-layout "In left-handed mode the top bar is the mirror image of the right-handed one" (Two rows,
  One row); AC6 stays.

## Changed existing scenarios (verified one by one)

- navigation.feature "The today button returns to the period containing today": day row removed (the day view has no
  day header to highlight); new "The today button returns to today's day view" keeps the URL check.
- navigation.feature "The current day is highlighted in every view" and "No day is highlighted when today is not
  visible": day rows removed; the day view is covered by the new Today-button outlines (@backlog).
- timeline.feature "The Now card when nothing else is scheduled today" ("Nothing else today"): replaced by the two
  @backlog scenarios above.
- labs-approach.feature: description extended (card gone when nothing is on or ahead, Time left switch, time left on
  the chip); "The Approaching card can be switched off" unchanged; four new @backlog scenarios.
- plant.feature: description (one Streak choice, Off by default and for everyone); "The streak flame setting decides
  whether the flame is shown" and "The plant setting decides whether the plant is shown" replaced by the @backlog
  outline "The streak choice decides what the top bar shows"; "The plant and the sunflowers are on by default" became
  "The sunflowers grow with points by default" (the plant line goes with `Settings.plant`); the scenarios that show
  the plant or its card got `Given the streak is set to "Plant"`; three more @backlog scenarios.
- streak.feature: Background `And the streak is set to "Flame"` (its scenarios check the count on the flame);
  description: the message shows whatever the choice; one @backlog outline (count and message with Off and Plant).
- sunflowers.feature: "The field shows whatever the plant setting is" replaced by the @backlog outline "The field
  shows whatever the streak choice is".
- These non-@backlog scenarios now use the new step `the streak is set to X`, which the build adds (step 1b); until
  then they cannot run. Existing @visual baselines that include the top bar change with the build (no flame, plant or
  sync icon by default) and must be re-recorded and looked at.
- Checked and unchanged (the default Two rows keeps their behaviour): mobile.feature:53 (touch targets), left-handed
  .feature:41 and :73, navigation.feature:56 and the deep-link outline (:61, full date), language.feature:48 (German
  full date), timeline.feature:102 and :115 (an entry is still ahead, so the card stays), theme-menu.feature (has no
  header-layout or fine-tuning header lines: the theme proposal never landed, so nothing to remove).

## Testing Plan

- Unit (vitest): prefs store and server prefs (`headerLayout`, `approachTimeLeft`, `streak`, `syncIndicator` defaults,
  validation, merge); settings store migration (old keys dropped on load and from a restored backup, `PATCH` 400); theme
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
1b. Streak: pref `streak` + migration (settings store drops `streakFlame`/`plant`, validation rejects them, types,
   web settings/prefs stores, `AppTopBar` → `LeadingWidgets` from `prefs.streak`, `StreakToast` no longer gated by
   the flame), Settings › Focus & motivation
   segmented `settings-streak` replacing the two switches, step `the streak is set to X` → unit tests, then the
   plant/streak/sunflowers scenarios. Independent of the header work: can ship first as its own PR.
1c. Sync indicator: pref `syncIndicator`, `settings-sync-indicator`, `SyncStatus` hidden unless error or on → unit +
   the sync-indicator rule; google/sync.feature as a regression guard.
2. Settings rows: "Header layout" segmented (`settings-header-layout`) before "Approaching card"; "Time left" switch
   (`settings-approach-time-left`) under it → e2e "The choice is made in the settings …".
3. Top bar: `data-layout` on `top-bar`; Two rows CSS (18 px title, 32 px nav visuals with 44 px hit areas); One row
   grid + Today icon pill + short day title; plant tap area 32 x 44 and flame slot 32 px in one row; title chevron
   hidden while a streak and the sync problem icon both show; left-handed
   one-row mirror and the exact box mirror of R21 in both layouts (title text at the outer edge, widgets reversed,
   ‹ Today › in order); ≥ 768 px unchanged → header-layout layout scenarios.
   **PR 1 — header layouts** (steps 1–3): independently mergeable; the default Two rows already saves 12 px of bar height.
4. (PR 1 also changes `mobile.steps.ts` to measure hit areas.) Day view: drop the day header at every width (desktop
   grid 36 px higher); Today button `data-today-shown` + filled / outlined-on-solid look in all views and both layouts
   → navigation scenarios and the Today rule.
5. All-day row on demand (+ appear while dragging; a page-level drag flag or `:has()` on the shell) → all-day rule.
6. Approaching card gone when nothing is on or ahead; time left on the running chip when the card does not show it →
   timeline + labs-approach scenarios.
   **PR 2 — date once, rows on demand, card** (steps 4–6): independent of PR 1 (works with the as-built bar).
7. Scenes: per-layout arrangement for every scene (layer boxes at 96 px on the bottom edge, sky moves, character
   placement table per layout and width, hare out in one row at 390 px), light and dark → scene outline + baselines.
   **PR 3 — scenes for both layouts**: must land with or right after PR 1 (until then One row shows the scenes cut
   as-is). If the owner prefers, PR 1 + PR 3 ship together as one PR (recommended: one PR, atomic commits).

**PR 0 — streak choice and sync indicator** (steps 1b, 1c): independent of the header layouts and mergeable first;
it re-records the top-bar @visual baselines once.

Effort: PR 0 ≈ 0.5 day; PR 1 ≈ 0.5–1 day; PR 2 ≈ 1 day; PR 3 ≈ 1–1.5 days (12 scenes x 2 layouts x 2 schemes, measured placement, 48
baselines to look at). About 3.5–4 days in all.

## Open questions (with a recommendation each)

- Q1 **Hit areas vs the bar heights and widths.** *Width part answered (owner, 2026-10-26):* one row stays one row;
  the plant gets a 44 x 32 tap area, everything else 44 x 44; the flame and the sync icon are not buttons; the sync
  icon is hidden unless syncing fails (or the Sync indicator is on); the streak is one widget at most (R15, R17). The
  streak-plus-sync-problem case is Q11. *Still open:* the two-row vertical overlap below (recommendation unchanged).
  Original analysis: Two rows: 84 px = 2 + 48 title row + 32 nav row
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
- Q2 **Where the today highlight goes.** *Answered (owner, 2026-10-26):* the Today button, filled (tonal) while today
  is in the shown period, outlined on a solid surface fill otherwise, both layouts (R18). Original recommendation: the Today control looks pressed (secondary-container fill)
  whenever today is on screen, in every view and both layouts; outlined when it is not. Alternative: only in the day
  view, or a dot under the date in the title.
- Q3 **Sync-indicator switch.** *Answered (owner, 2026-10-26):* yes, "Sync indicator" in Settings › Calendar, **off**
  by default (not on as recommended); off = only on problems (R19). Original recommendation: yes, in Settings › Calendar after the Approaching rows, on by default;
  off = the icon shows only while syncing fails (problems always show). It also helps Q1.
- Q4 **Desktop (≥ 768 px).** *Answered (owner, 2026-10-26):* the desktop top bar keeps its one row with the full
  date; the desktop day view drops the day header, its grid starts 36 px higher (R7, R20). Original: it already has one row with the full date and the Today word. Recommendation: the setting
  applies to phones only (the hint says "On phones"); desktop unchanged except the day header going (date once).
- Q5 **Left-handed in one row.** *Answered (owner, 2026-10-26):* an exact mirror of the right-handed boxes in both
  layouts, ‹ Today › in its order (R21). Original recommendation: mirror like two rows: settings, filter, sync, plant, flame at the left,
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
- Q11 **One row with a streak on and syncing failing.** *Answered (owner, 2026-10-26):* the date's ⌄ chevron is
  hidden only while that lasts, so the date fits in full (R17). Original analysis: at 390 px the row has
  384 px: short date ≈ 131 px + ‹ Today › 132 + filter and settings 88 + flame or plant 32 = 383 px. When the sync
  problem icon also shows (28 px), the date gets about 22 px less than it needs and is cut (options seen before the
  decision: accept the ellipsis while the problem lasts; hide the streak widget
  while the problem icon shows; let the banner carry the problem and keep the icon out of one row).

## Assumptions

- "Time left" switch: decision 3 names a time-left line among the personal switches; there is no such switch today, so
  it is new, under "Approaching card", default on.
- The time left on the chip shows only for timed events (the card's "running" rule, `nowCardModel`), not task lists.
- "Nothing ahead" is scoped to today, like the card's "Next" line (tomorrow's entries do not keep the card).
- The settings preview under the Header layout choice (frame S1) is a proposal; without it the row is the plain
  segmented button.
- The streak choice is a segmented button labelled "Streak" with the options "Off", "Flame", "Plant" (German labels
  come with the build's i18n); "Settings › Motivation" in the decision is the section "Focus & motivation".
- The sync indicator switch applies at every width (desktop too); the decision names no limit.
